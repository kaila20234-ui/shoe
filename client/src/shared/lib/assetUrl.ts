const apiOrigin = new URL(
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  window.location.origin,
).origin;

export function resolveAssetUrl(url: string): string {
  return url.startsWith('/uploads/') ? new URL(url, apiOrigin).toString() : url;
}
