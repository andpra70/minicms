const LOCAL_ASSET_PREFIXES = ['img/', 'assets/', 'fonts/'];
const EXTERNAL_URL_REGEX = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;

function normalizeBase(baseUrl: string) {
  if (!baseUrl || baseUrl === '/') {
    return '';
  }
  if (baseUrl === './') {
    return './';
  }
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

export function resolveAppAssetUrl(value?: string | null) {
  if (!value) {
    return '';
  }
  if (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('#') ||
    EXTERNAL_URL_REGEX.test(value)
  ) {
    return value;
  }

  const cleanedValue = value.replace(/^\.?\//, '');
  const isLocalAsset = LOCAL_ASSET_PREFIXES.some((prefix) => cleanedValue.startsWith(prefix));
  if (!isLocalAsset) {
    return value;
  }

  const baseUrl = normalizeBase(import.meta.env.BASE_URL);
  if (baseUrl === './') {
    return cleanedValue;
  }
  return `${baseUrl}${cleanedValue}`;
}

export function resolveApiUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, '');
  const baseUrl = normalizeBase(import.meta.env.BASE_URL);
  if (!baseUrl || baseUrl === './') {
    return `./${normalizedPath}`;
  }
  return `${baseUrl}${normalizedPath}`;
}
