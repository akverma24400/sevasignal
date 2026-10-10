const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export async function api(path, { body, method = 'GET', signal } = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'Cannot reach SevaSignal. Check your connection and try again.',
      0,
      'NETWORK_ERROR',
    );
  }
  if (response.status === 204) return null;
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('sevasignal:session-expired'));
    throw new ApiError(
      json?.error?.message || 'Something went wrong. Please try again.',
      response.status,
      json?.error?.code,
    );
  }
  return json;
}
