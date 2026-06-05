import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

export type AnyRecord = Record<string, any>;

export async function getJson<T = any>(url: string): Promise<T> {
  const response = await api.get<T>(url);
  return response.data;
}

export async function postJson<T = any>(url: string, data: AnyRecord): Promise<T> {
  const response = await api.post<T>(url, data);
  return response.data;
}

export async function putJson<T = any>(url: string, data: AnyRecord): Promise<T> {
  const response = await api.put<T>(url, data);
  return response.data;
}

export async function deleteJson<T = any>(url: string): Promise<T> {
  const response = await api.delete<T>(url);
  return response.data;
}
