import client, { type ApiResp } from './client';

export type EventType = 'purchase' | 'usage' | 'maintenance' | 'repair' | 'consumable' | 'sell';

export interface ItemEvent {
  id: number;
  item_id: number;
  type: EventType;
  occurred_at: string;
  amount: number;
  quantity: number;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EventInput {
  type: EventType;
  occurred_at?: string;
  amount?: number;
  quantity?: number;
  description?: string;
  metadata?: Record<string, any>;
}

/** 视觉元信息：标签、Vant 图标名、强调色 */
export const EVENT_META: Record<EventType, { label: string; icon: string; color: string }> = {
  purchase:    { label: '购入', icon: 'cart-o',         color: '#7b8cde' },
  usage:       { label: '使用', icon: 'thumb-circle-o', color: '#5cd28a' },
  maintenance: { label: '保养', icon: 'setting-o',      color: '#f0b860' },
  repair:      { label: '维修', icon: 'warning-o',      color: '#ed6f6f' },
  consumable:  { label: '消耗', icon: 'gift-o',         color: '#b07fd6' },
  sell:        { label: '出售', icon: 'exchange',       color: '#b4b8c2' },
};

export async function listEvents(itemId: number): Promise<ItemEvent[]> {
  const { data } = await client.get<ApiResp<ItemEvent[]>>(`/api/items/${itemId}/events`);
  return data.data;
}

export async function addEvent(itemId: number, payload: EventInput): Promise<ItemEvent> {
  const { data } = await client.post<ApiResp<ItemEvent>>(`/api/items/${itemId}/events`, payload);
  return data.data;
}

export async function deleteEvent(eventId: number): Promise<void> {
  await client.delete(`/api/events/${eventId}`);
}

export interface ItemStats {
  id: number;
  name: string;
  purchase_price: number;
  acquisition_date: string;
  days_owned: number;
  extra_cost: number;
  use_count: number;
  total_cost: number;
  daily_cost: number;
  cost_per_use: number | null;
}
export async function getItemStats(itemId: number): Promise<ItemStats> {
  const { data } = await client.get<ApiResp<ItemStats>>(`/api/items/${itemId}/stats`);
  return data.data;
}
