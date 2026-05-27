import client, { type ApiResp } from './client';

export type ItemStatus = 'using' | 'retired' | 'sold';

export interface Item {
  id: number;
  name: string;
  category: string | null;
  acquisition_date: string;
  purchase_price: number;
  currency: string;
  status: ItemStatus;
  cover_image_id: number | null;
  cover_url?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // 仅列表接口返回
  days_owned?: number;
  daily_cost?: number;
  use_count?: number;
}

export type SortKey = 'updated' | 'acquisition' | 'price' | 'daily_cost';

export interface ListItemsParams {
  q?: string;
  category?: string;
  status?: ItemStatus | '';
  sort?: SortKey;
  page?: number;
  size?: number;
}

export interface ListItemsResp {
  rows: Item[];
  page: number;
  size: number;
  total: number;
}

export async function listItems(params: ListItemsParams = {}): Promise<ListItemsResp> {
  const { data } = await client.get<ApiResp<ListItemsResp>>('/api/items', { params });
  return data.data;
}

export async function getItem(id: number): Promise<Item & { images: any[] }> {
  const { data } = await client.get<ApiResp<Item & { images: any[] }>>(`/api/items/${id}`);
  return data.data;
}

export async function createItem(payload: Partial<Item>): Promise<Item> {
  const { data } = await client.post<ApiResp<Item>>('/api/items', payload);
  return data.data;
}

export async function updateItem(id: number, payload: Partial<Item>): Promise<Item> {
  const { data } = await client.patch<ApiResp<Item>>(`/api/items/${id}`, payload);
  return data.data;
}

export async function deleteItem(id: number): Promise<void> {
  await client.delete(`/api/items/${id}`);
}
