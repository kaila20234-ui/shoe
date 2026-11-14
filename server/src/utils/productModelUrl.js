const uploadedModelUrlPattern = /^\/uploads\/models\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.glb$/i;

export function isValidProductModelUrl(value) {
  if (typeof value !== 'string') return false;
  if (uploadedModelUrlPattern.test(value)) return true;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /\.(?:glb|gltf)$/i.test(url.pathname);
  } catch {
    return false;
  }
}
