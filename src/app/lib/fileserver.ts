const REMOTE_FILESERVER_BASE = 'https://zanotti.iliadboxos.it:55443/fileserver';
const FILESERVER_STORAGE_KEY = 'cms-fileserver-path';

interface FileserverClient {
  listDirectory: (path: string) => Promise<{ currentPath?: string; parentPath?: string; items?: any[] }>;
  saveFileContent: (path: string, content: string) => Promise<unknown>;
  uploadFiles: (path: string, files: File[], onProgress?: (progress: number) => void) => Promise<unknown>;
}

interface FileserverApiGlobal {
  createClient: (options?: { apiBase?: string }) => FileserverClient;
}

declare global {
  interface Window {
    FileserverApi?: FileserverApiGlobal;
  }
}

function getFileserverApi() {
  return window.FileserverApi || null;
}

function isLocalDevHost() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

function getFileserverBase() {
  return isLocalDevHost() ? '/fileserver' : REMOTE_FILESERVER_BASE;
}

function getFileserverScriptUrl() {
  return `${getFileserverBase()}/assets/api.js`;
}

function getFileserverApiBase() {
  return `${getFileserverBase()}/api`;
}

export function getFileserverPath() {
  return localStorage.getItem(FILESERVER_STORAGE_KEY) || 'site.json';
}

export function setFileserverPath(path: string) {
  localStorage.setItem(FILESERVER_STORAGE_KEY, path);
}

export function promptFileserverPath(defaultPath = getFileserverPath()) {
  const path = window.prompt('Percorso file sul fileserver', defaultPath)?.trim();
  if (!path) {
    return null;
  }

  setFileserverPath(path);
  return path;
}

export async function ensureFileserverApiLoaded() {
  const existingApi = getFileserverApi();
  if (existingApi) {
    return existingApi;
  }

  const scriptUrl = getFileserverScriptUrl();
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      if (getFileserverApi()) {
        resolve();
        return;
      }

      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Impossibile caricare api.js')), { once: true });
    });
    return getFileserverApi();
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossibile caricare api.js'));
    document.head.appendChild(script);
  });

  return getFileserverApi();
}

function getClient(api: FileserverApiGlobal | null) {
  if (!api?.createClient) {
    throw new Error('api.js non espone FileserverApi.createClient');
  }

  return api.createClient({ apiBase: getFileserverApiBase() });
}

export interface FileserverListItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

function splitPath(path: string) {
  const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/').filter(Boolean);
  const filename = segments.pop() || 'site.json';
  return {
    directory: segments.join('/'),
    filename,
  };
}

async function fetchRawFileText(path: string) {
  const query = new URLSearchParams({ path }).toString();
  const response = await fetch(`${getFileserverApiBase().replace(/\/api$/, '')}/api/raw?${query}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.text();
}

export async function saveTextToFileserver(path: string, content: string) {
  const api = await ensureFileserverApiLoaded();
  const client = getClient(api);
  try {
    return await client.saveFileContent(path, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('ENOENT')) {
      throw error;
    }

    const { directory, filename } = splitPath(path);
    const file = new File([content], filename, { type: 'application/json' });
    return client.uploadFiles(directory, [file]);
  }
}

export async function loadTextFromFileserver(path: string) {
  return fetchRawFileText(path);
}

export async function listFileserverDirectory(path: string) {
  const api = await ensureFileserverApiLoaded();
  const client = getClient(api);
  const result = await client.listDirectory(path);
  const items = Array.isArray(result?.items) ? result.items : [];

  return items.map((item: any) => ({
    name: String(item?.name || item?.filename || item?.basename || ''),
    path: String(item?.path || item?.fullPath || item?.relativePath || ''),
    isDirectory: Boolean(item?.isDirectory || item?.type === 'directory' || item?.kind === 'directory'),
    size: typeof item?.size === 'number' ? item.size : undefined,
  })) as FileserverListItem[];
}
