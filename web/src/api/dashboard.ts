import client, { type ApiResp } from './client';

export interface DashboardOverview {
  total_assets:  number;
  daily_cost:    number;
  total_count:   number;
  count_using:   number;
  count_retired: number;
  count_sold:    number;
}

export interface DashboardItem {
  id: number;
  name: string;
}

export interface DashboardResp {
  overview:    DashboardOverview;
  mostUsed:    Array<DashboardItem & { use_count: number }>;
  longestIdle: Array<DashboardItem & { last_used: string }>;
  bestValue:   Array<DashboardItem & { purchase_price: number; use_count: number }>;
}

export async function fetchDashboard(): Promise<DashboardResp> {
  const { data } = await client.get<ApiResp<DashboardResp>>('/api/dashboard');
  return data.data;
}
