import { useEffect, useState } from 'react';
import { listFileserverDirectory, type FileserverListItem } from '@/app/lib/fileserver';
import { sanitizeProjectName, setProjectPathUrl } from '@/app/lib/project-route';

const SITES_PATH = '/sites/';

function formatFileSize(size?: number) {
  if (typeof size !== 'number' || Number.isNaN(size)) {
    return '';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getProjectNameFromEntry(item: FileserverListItem) {
  const source = item.name || item.path;
  return sanitizeProjectName(source.replace(/\.json$/i, ''));
}

export function ProjectPicker() {
  const [items, setItems] = useState<FileserverListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const directoryItems = await listFileserverDirectory(SITES_PATH);
        if (cancelled) {
          return;
        }
        setItems(
          directoryItems.filter((item) => !item.isDirectory && /\.json$/i.test(item.name || item.path))
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Errore caricamento lista progetti');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Mini CMS</div>
          <h1 className="mt-3 text-3xl font-semibold">Seleziona un progetto</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Nessun progetto specificato nell&apos;URL. Elenco da <code>{SITES_PATH}</code>.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          {isLoading && (
            <div className="px-6 py-10 text-sm text-neutral-500">Caricamento lista progetti...</div>
          )}

          {!isLoading && error && (
            <div className="px-6 py-10 text-sm text-red-600">{error}</div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <div className="px-6 py-10 text-sm text-neutral-500">Nessun file progetto trovato in /sites/.</div>
          )}

          {!isLoading && !error && items.length > 0 && (
            <div className="divide-y divide-neutral-200">
              {items.map((item) => {
                const projectName = getProjectNameFromEntry(item);
                return (
                  <button
                    key={item.path || item.name}
                    type="button"
                    onClick={() => {
                      setProjectPathUrl(projectName);
                      window.location.reload();
                    }}
                    className="w-full px-6 py-4 text-left hover:bg-neutral-50 transition-colors"
                  >
                    <div className="text-base font-medium">{projectName}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {item.path || `${SITES_PATH}${item.name}`}
                      {formatFileSize(item.size) ? ` · ${formatFileSize(item.size)}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
