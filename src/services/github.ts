import { Octokit } from 'octokit';
import _ from 'lodash';
import { ThenArg } from '../type-util';
import assert from 'assert';
import dayjs, { Dayjs } from 'dayjs';
import { GithubIssue } from './types';

const LABEL_PROCESSED = 'freshdesk-processed';

const RATE_LIMIT_REQUIRED_MESSAGE =
  'Rate limit is required by this point, make sure to call setRateLimit() after creating the api instance';
export class GithubApi {
  private _octokit: Octokit;
  private _rateLimit?: ThenArg<
    ReturnType<Octokit['rest']['rateLimit']['get']>
  >['data'];
  constructor() {
    this._octokit = new Octokit({ auth: process.env['GITHUB_TOKEN'] });
  }

  public setRateLimit = async (): Promise<void> => {
    const rateLimit = await this._octokit.rest.rateLimit.get();
    this._rateLimit = rateLimit.data;
  };

  private _assertRateLimit = () => {
    assert(Boolean(this._rateLimit), RATE_LIMIT_REQUIRED_MESSAGE);
  };

  private _updateRate = () => {
    assert(this._rateLimit, RATE_LIMIT_REQUIRED_MESSAGE);
    if (!this._rateLimit) throw Error('teste assert');
    this._rateLimit.rate.remaining -= 1;
    this._rateLimit.rate.used += 1;
  };

  private _waitForRateLimit = async () => {
    this._assertRateLimit();
    // pro eslint não ficar reclamando de while(true)
    const x = undefined;
    while (typeof x === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (this._rateLimit!.rate.remaining > 0) break;
      const now = dayjs().subtract(5, 'seconds');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const then = dayjs.unix(this._rateLimit!.rate.reset);
      if (now > then) {
        await this.setRateLimit();
      } else {
        then.add(5, 'seconds');
        now.subtract(5, 'seconds');
        await new Promise((e) =>
          setTimeout(e, Math.abs(then.diff(now, 'milliseconds'))),
        );
      }
    }
  };

  public setIssueSentToFreshdesk = async function (
    this: GithubApi,
    issue: GithubIssue,
  ): Promise<
    ThenArg<ReturnType<Octokit['rest']['issues']['update']>>['status']
  > {
    this._assertRateLimit();
    await this._waitForRateLimit();
    const response = await this._octokit.rest.issues.update({
      ...this._getRepo(),
      issue_number: issue.number,
      labels: [...issue.labels, LABEL_PROCESSED],
    });
    this._updateRate();
    return response.status;
  };

  public getIssue = async function (
    this: GithubApi,
    issue: number,
  ): Promise<ThenArg<ReturnType<Octokit['rest']['issues']['get']>>['data']> {
    this._assertRateLimit();
    await this._waitForRateLimit();

    const option = await this._octokit.rest.issues.get({
      ...this._getRepo(),
      issue_number: issue,
    });

    this._updateRate();

    return option.data;
  };

  private _getRepo = (): { owner: string; repo: string } => {
    const owner = process.env['REPO_OWNER'];
    assert(owner, 'REPO_OWNER não encontrado no env');

    const repo = process.env['REPO'];
    assert(repo, 'REPO não encontrado no env');

    const retorno = {
      owner,
      repo,
    };

    return retorno;
  };

  public getIssues = async function* (
    this: GithubApi,
    filter: IssuesFilter,
  ): AsyncGenerator<
    ThenArg<ReturnType<Octokit['rest']['issues']['listForRepo']>>['data'],
    [],
    undefined
  > {
    this._assertRateLimit();
    const { to, from, open } = filter;
    let page = 0;
    while (true) {
      await this._waitForRateLimit();
      page++;
      const options = await this._octokit.rest.issues.listForRepo({
        ...this._getRepo(),
        page,
        sort: 'created',
        state: open ? 'all' : 'closed',
        direction: 'asc',
      });
      this._updateRate();
      if (!options.data.length) break;
      const filtered = options.data
        .filter(notProcessed)
        .filter((e) => !from || dayjs(e.created_at) > from)
        .filter((e) => !to || dayjs(e.created_at) < to);
      // TODO inverter a ordem disso quando issues estiverem no freshdesk
      // já que a ordenação asc vai trazer as mais antigas primeiro,
      // fazendo o script processar coisas que já estarão no freshdesk.
      if (to && dayjs(options.data[options.data.length - 1].created_at) > to)
        break;
      yield filtered;
    }
    return [];
  };
}

export type IssuesFilter = {
  from?: Dayjs;
  to?: Dayjs;
  open: boolean;
};

export function notProcessed(issue: GithubIssue): boolean {
  if (!issue) return false;

  const labels = issue.labels.map((e) =>
    typeof e === 'string' ? e : e.name || '',
  );

  return (
    !labels.includes(LABEL_PROCESSED) &&
    issue.user?.login.toUpperCase() !== 'OPTZBOT'
  );
}
