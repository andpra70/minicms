import { Pencil } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';

const DEFAULT_FOOTER = {
  line1: '&copy; 2026 Mini CMS. Tutti i diritti riservati.',
  line2: 'Sistema di gestione contenuti basato su JSON con temi intercambiabili',
};

export function Footer() {
  const { isAdmin, site, updateSite } = useAdmin();
  const footer = {
    line1: site?.footer?.line1 || DEFAULT_FOOTER.line1,
    line2: site?.footer?.line2 || DEFAULT_FOOTER.line2,
  };

  const handleEditFooterLine = (key: 'line1' | 'line2') => {
    if (!isAdmin) return;
    const nextValue = window.prompt('Nuovo testo footer', footer[key]);
    if (!nextValue) return;
    const cleanedValue = nextValue.trim();
    if (!cleanedValue) {
      window.alert('Testo non valido.');
      return;
    }

    const nextSite = JSON.parse(JSON.stringify(site || {}));
    nextSite.footer = {
      ...(nextSite.footer || DEFAULT_FOOTER),
      [key]: cleanedValue,
    };
    updateSite(nextSite);
  };

  return (
    <footer 
      className="mt-auto py-8 relative overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)'
      }}
    >
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: 'var(--footer-background)',
          opacity: 0.1
        }}
      />
      
      <div 
        className="relative mx-auto px-4 sm:px-6 lg:px-8"
        style={{ maxWidth: 'var(--container-width)' }}
      >
        <div className="text-center" style={{ color: 'var(--color-text-secondary)' }}>
          <p className="inline-flex items-center gap-2">
            <span>{footer.line1}</span>
            {isAdmin && (
              <button
                onClick={() => handleEditFooterLine('line1')}
                className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                title="Modifica testo footer"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </p>
          <p className="mt-2 text-sm inline-flex items-center gap-2">
            <span>{footer.line2}</span>
            {isAdmin && (
              <button
                onClick={() => handleEditFooterLine('line2')}
                className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                title="Modifica testo footer"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
