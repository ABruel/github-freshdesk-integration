import { Dayjs } from 'dayjs';
import { ArrayElement, GeneratorReturnType } from '../type-util';
import { GithubApi } from './github';

export type GithubIssue = ArrayElement<
  GeneratorReturnType<ReturnType<GithubApi['getIssues']>>
>;

export type FreshdeskTicket = {
  name: string;
  requester_id?: number;
  email?: string;
  facebook_id?: string;
  phone?: string;
  twitter_id?: string;
  unique_external_id?: string;
  subject: string;
  type: string;
  status: Status;
  priority: Priority;
  description: string;
  responder_id: number;
  attachments?: unknown[];
  cc_emails?: string[];
  custom_fields?: Record<string, unknown>;
  due_by?: Dayjs;
  email_config_id?: number;
  fr_due_by?: Dayjs;
  group_id: number;
  product_id?: number;
  source: Source;
  tags: string[];
  company_id?: number;
  internal_agent_id?: number;
  internal_group_id?: number;
};

export enum Status {
  OPEN = 2,
  PENDING = 3,
  RESOLVED = 4,
  CLOSED = 5,
}

export enum Source {
  EMAIL = 1,
  PORTAL = 2,
  PHONE = 3,
  CHAT = 7,
  FEEDBACK_WIDGET = 9,
  OUTBOUND_EMAIL = 10,
}

export enum Priority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4,
}
