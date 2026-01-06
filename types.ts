
export enum LinkType {
  V2 = 'V2Ray',
  CLASH = 'Clash',
  UNKNOWN = '未知'
}

export enum LinkStatus {
  ACTIVE = '有效',
  TESTING = '检测中',
  EXPIRED = '已失效'
}

export interface SubscriptionLink {
  id: string;
  url: string;
  title: string;
  source: string;
  type: LinkType;
  status: LinkStatus;
  updatedAt: string;
  ping?: number;
}

export interface EmailDeliveryRecord {
  id: string;
  timestamp: string;
  recipient: string;
  status: 'SUCCESS' | 'FAILED';
  summary: string;
}
