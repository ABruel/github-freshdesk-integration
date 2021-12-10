import dayjs, { Dayjs } from 'dayjs';
import type { Arguments, CommandBuilder } from 'yargs';
import { Converter } from 'showdown';
import { GithubApi } from '../services/github';
import {
  Arg1,
  ArrayElement,
  ConvertToCliArgs,
  GeneratorReturnType,
} from '../type-util';
import { GithubIssue } from '../services/types';

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
  if (issue) {
    handleIssue(githubApi, issue);
    return;
  }
  handleFiltered(githubApi, {
    from: from ? dayjs(from) : undefined,
    to: to ? dayjs(to) : undefined,
    open,
  });
};

async function handleIssue(
  githubApi: GithubApi,
  issue: NonNullable<Options['issue'] | GithubIssue>,
) {
  if (typeof issue === 'string')
    issue = await githubApi.getIssue(parseInt(issue));
  await sendToFreshdesk(issue);
}

async function handleFiltered(
  githubApi: GithubApi,
  filter: Arg1<GithubApi['getIssues']>,
) {
  for await (const data of githubApi.getIssues(filter)) {
    for (const issue of data) {
      if (issue === undefined) continue;
      await handleIssue(githubApi, issue);
    }
    break;
  }
}

async function sendToFreshdesk(issue: GithubIssue) {
  const htmlBody = getHtmlBody(issue.body);
  const assignee = getAssignee(issue.assignee);
  const createdby = process.env['GITHUB_BOT_EMAIL'];

  //await githubApi.setIssueSentToFreshdesk(issue);
}

function getAssignee(assignee: GithubIssue['assignee']) {
  if (!assignee) return null;
  const mapped = process.env[`ASSIGNEE_MAP:${assignee.login}`];
  if (!mapped)
    throw new Error(`falta assignee map para usuario ${assignee.login}`);
  return mapped;
}

function getHtmlBody(body: string | null | undefined) {
  if (!body) return '';
  const converter = new Converter();
  converter.setFlavor('github');
  return converter.makeHtml(
    body.replace(/\\r\\n/g, '\\n').replace(/\\n/g, '\n'),
  );
}
