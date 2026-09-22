export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; [key: string]: unknown },
  ) {
    super(body.error || `Request failed (${status})`);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response
    .json()
    .catch(() => ({ error: 'The server returned an unexpected response. Please retry.' }));
  if (!response.ok) throw new ApiError(response.status, body);
  return body as T;
}
export function downloadFile(filename: string, content: BlobPart, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const uid = () => crypto.randomUUID();
export const formatDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const today = () => new Date().toISOString().slice(0, 10);
export const number = (value: number) =>
  new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(value);
