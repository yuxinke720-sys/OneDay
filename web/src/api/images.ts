import client, { type ApiResp } from './client';

export interface ImageRow {
  id: number;
  item_id: number;
  event_id: number | null;
  url: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
}

/** 把一个 File 读出原始宽高，用于库存 + 瀑布流布局 */
export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export async function uploadImage(
  file: File,
  itemId: number,
  eventId?: number | null,
): Promise<ImageRow> {
  const size = await readImageSize(file).catch(() => ({ width: 0, height: 0 }));
  const form = new FormData();
  form.append('file', file);
  form.append('item_id', String(itemId));
  if (eventId) form.append('event_id', String(eventId));
  form.append('width',  String(size.width));
  form.append('height', String(size.height));

  const { data } = await client.post<ApiResp<ImageRow>>('/api/images', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function deleteImage(id: number): Promise<void> {
  await client.delete(`/api/images/${id}`);
}
