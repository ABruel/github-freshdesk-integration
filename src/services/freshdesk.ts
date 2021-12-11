import _ from 'lodash';
import assert from 'assert';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { FreshdeskTicket } from './types';
export class FreshdeskApi {
  private _axios: AxiosInstance;
  constructor() {
    const auth: AxiosRequestConfig['auth'] = {
      username: this._getApiKey(),
      password: 'x',
    };
    const headers: AxiosRequestConfig['headers'] = {
      content: 'application/json',
    };
    const baseURL = this._getBaseURL();
    this._axios = axios.create({ auth, headers, baseURL });
  }

  private _getBaseURL = () => getRequiredFromEnv('FRESHDESK_BASE_URL');
  private _getApiKey = (): string => getRequiredFromEnv('FRESHDESK_API_KEY');

  private async _makeRequest<T, D = any>(
    arg0: () => Promise<AxiosResponse<T, D>>,
  ): Promise<AxiosResponse<T>> {
    let response = await arg0().catch((e) => {
      return e.response;
    });
    if (response.status === undefined) console.log('respose', response);
    while (response.status === 429) {
      const retry = response.headers['retry-after'];
      console.warn('Rate limit hit, retrying in a few seconds');
      await new Promise((r) => setTimeout(r, (parseInt(retry) + 1) * 1000));
      response = await arg0().catch((e) => e.response);
    }

    return response;
  }

  public listTickets = async (): Promise<AxiosResponse<FreshdeskTicket[]>> => {
    return this._makeRequest<FreshdeskTicket[]>(async () =>
      this._axios.get('/api/v2/tickets'),
    );
  };

  public listAgents = async (): Promise<AxiosResponse<FreshdeskTicket[]>> => {
    return this._makeRequest<FreshdeskTicket[]>(async () =>
      this._axios.get('/api/v2/agents'),
    );
  };

  public createTicket = async (
    ticket: FreshdeskTicket,
  ): Promise<AxiosResponse<FreshdeskTicket[]>> => {
    return this._makeRequest<FreshdeskTicket[]>(async () =>
      this._axios.post('/api/v2/tickets', ticket),
    );
  };
}

function getRequiredFromEnv(arg0: string) {
  const key = process.env[arg0];
  assert(key, `${arg0} não presente no env`);
  return key;
}
