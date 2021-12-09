import dayjs, { Dayjs } from 'dayjs';
import type { Arguments, CommandBuilder } from 'yargs';
import { GithubApi } from '../services/github';
import { Arg1, ConvertToCliArgs, ThenArg } from '../type-util';

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
function handleIssue(githubApi: GithubApi, issue: Options['issue']) {
  // throw new Error('Function not implemented.');
}

async function handleFiltered(
  githubApi: GithubApi,
  filter: Arg1<GithubApi['getIssues']>,
) {
  let i = 0;
  for await (const data of githubApi.getIssues(filter)) {
    if (i > 0) break;
    console.log(
      i,
      data.map((e) => e.id),
    );
    i += 1;
  }
  // throw new Error('Function not implemented.');
}
