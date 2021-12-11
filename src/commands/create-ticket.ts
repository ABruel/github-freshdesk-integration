import dayjs from 'dayjs';
import type { Arguments, CommandBuilder } from 'yargs';
import { Converter } from 'showdown';
import { GithubApi, notProcessed } from '../services/github';
import { Arg1, ConvertToCliArgs } from '../type-util';
import { GithubIssue, Priority, Source, Status } from '../services/types';
import { FreshdeskApi } from '../services/freshdesk';
import assert from 'assert';
import { parse } from 'node-html-parser';
type Options = Arg1<GithubApi['getIssues']> & {
  issue?: string;
};

export const command = 'create-ticket';
export const desc = 'Create freshdesk ticket from github issues';

export const builder: CommandBuilder<ConvertToCliArgs<Options>> = (yargs) =>
  yargs.options({
    from: {
      type: 'string',
      describe:
        'Create ticket from issues created after `from`, should be a valid date format',
    },
    to: {
      type: 'string',
      describe:
        'Create ticket from issues created before `to`, should be a valid date format',
    },
    open: {
      type: 'boolean',
      default: false,
      describe: 'If set, will create tickets for issues which are still open',
    },
    issue: {
      type: 'string',
      describe: 'Create ticket for a specific issue, will ignore other filters',
    },
  });

export const handler = async (
  argv: Arguments<ConvertToCliArgs<Options>>,
): Promise<void> => {
  const { issue, from, to, open } = argv;
  const githubApi = new GithubApi();
  await githubApi.setRateLimit();
  const freshdeskApi = new FreshdeskApi();
  if (issue) {
    handleIssue(githubApi, freshdeskApi, issue);
    return;
  }

  const optDjs = (s?: string) => (s ? dayjs(s) : undefined);
  const filter = { from: optDjs(from), to: optDjs(to), open };

  handleFiltered(githubApi, freshdeskApi, filter);
};

async function handleIssue(
  githubApi: GithubApi,
  freshdeskApi: FreshdeskApi,
  issue: NonNullable<Options['issue'] | GithubIssue>,
) {
  if (typeof issue === 'string')
    issue = await githubApi.getIssue(parseInt(issue));
  if (notProcessed(issue)) {
    const success = await sendToFreshdesk(issue, freshdeskApi);
    if (success) githubApi.setIssueSentToFreshdesk(issue);
    else console.warn(`Erro ao enviar issue ${issue.number} ao freshdesk`);
  }
}

async function handleFiltered(
  githubApi: GithubApi,
  freshdeskApi: FreshdeskApi,
  filter: Arg1<GithubApi['getIssues']>,
) {
  for await (const data of githubApi.getIssues(filter)) {
    for (const issue of data) {
      if (issue === undefined) continue;
      await handleIssue(githubApi, freshdeskApi, issue);
    }
    break;
  }
}

async function sendToFreshdesk(
  issue: GithubIssue,
  freshDeskApi: FreshdeskApi,
): Promise<boolean> {
  const htmlBody = getHtmlBody(issue.body);
  const assignee = getAssignee(issue.assignee);
  if (!assignee)
    console.warn(`SEM ASSIGNEE PARA ISSUE ${issue.number}, IGNORANDO`);
  const createdby = process.env['GITHUB_BOT_EMAIL'];
  assert(createdby, 'GITHUB_BOT_EMAIL não presente no env');

  const groupId =
    process.env['FRESHDESK_GROUP_ID'] &&
    parseInt(process.env['FRESHDESK_GROUP_ID']);
  assert(groupId, 'FRESHDESK_GROUP_ID ou não é um numero');
  const tags = ['github'];

  for (const label of issue.labels) {
    const name = typeof label === 'string' ? label : label?.name;
    if (!name) continue;

    tags.push(name);
  }
  const ticket: Arg1<FreshdeskApi['createTicket']> = {
    name: 'Optz bot',
    unique_external_id: createdby,
    type: 'Demanda Sistema',
    subject: `[Github#${issue.number}] - ${issue.title}`,
    tags: tags,
    status: Status.RESOLVED,
    priority: Priority.MEDIUM,
    description: htmlBody,
    responder_id: assignee,
    group_id: groupId,
    source: Source.PORTAL,
  };
  const response = await freshDeskApi.createTicket(ticket);
  return response.status === 201;
}

function getAssignee(assignee: GithubIssue['assignee']): number {
  if (!assignee) return NaN;
  const mapped = process.env[`ASSIGNEE_MAP_${assignee.login}`];
  if (!mapped)
    throw new Error(`falta assignee map para usuario ${assignee.login}`);
  return parseInt(mapped);
}

function getHtmlBody(body: string | null | undefined) {
  if (!body) return '';
  const converter = new Converter();
  converter.setFlavor('github');
  converter.setOption('tasklists', false);
  const parsed = parse(
    converter.makeHtml(body.replace(/\\r\\n/g, '\\n').replace(/\\n/g, '\n')),
  );

  parsed
    .getElementsByTagName('td')
    .forEach((e) =>
      e.setAttribute('style', 'padding-left:10px;padding-right:10px;'),
    );

  return parsed.toString();
}
