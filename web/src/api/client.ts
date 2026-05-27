import axios from 'axios';
import { showToast } from 'vant';

// 后端响应统一格式：{ code: number, data: any, message?: string }
export interface ApiResp<T = any> {
  code: number;
  data: T;
  message?: string;
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '', // 开发期为空，靠 Vite proxy
  timeout: 10_000,
});

// 拦截器：业务层只关心 .data，错误统一弹 toast
client.interceptors.response.use(
  (resp) => {
    const body = resp.data as ApiResp;
    if (body && body.code !== 200) {
      showToast({ type: 'fail', message: body.message || '请求失败', duration: 2000 });
      return Promise.reject(new Error(body.message || `code=${body.code}`));
    }
    return resp;
  },
  (err) => {
    const msg = err?.response?.data?.message || err?.message || '网络错误';
    showToast({ type: 'fail', message: msg, duration: 2000 });
    return Promise.reject(err);
  },
);

// 拼接图片绝对地址（Capacitor / 跨域时 baseURL 非空时用）
export function resolveAssetUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return (import.meta.env.VITE_API_BASE || '') + path;
}

export default client;
