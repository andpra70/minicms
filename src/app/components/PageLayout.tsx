import { useEffect } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { ContentRenderer } from './ContentRenderer';

interface PageData {
  id: string;
  title: string;
  sections: any[];
}

export function PageLayout() {
  const { pageId = 'home', subPageId } = useParams();
  const location = useLocation();
  const { content, isProjectLoading, projectLoadError, currentProjectName } = useAdmin();
  const resolvedPageId = subPageId || pageId;
  
  const pages: { [key: string]: PageData } = content.pages;
  const page = pages[resolvedPageId];

  if (isProjectLoading) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div style={{ color: 'var(--color-text-secondary)' }}>
          Caricamento progetto {currentProjectName ? `"${currentProjectName}"` : ''}...
        </div>
      </div>
    );
  }

  if (projectLoadError && !page) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-xl text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Errore caricamento progetto {currentProjectName ? `"${currentProjectName}"` : ''}: {projectLoadError}
        </div>
      </div>
    );
  }

  if (!page) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    const hash = location.hash?.slice(1);
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const targetId = decodeURIComponent(hash);
    const scrollToTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    requestAnimationFrame(() => {
      setTimeout(scrollToTarget, 0);
    });
  }, [location.pathname, location.hash, page.sections?.length]);

  return (
    <div className="flex-1">
      <div 
        className="mx-auto px-4 sm:px-6 lg:px-8"
        style={{ 
          maxWidth: 'var(--container-width)',
          paddingTop: 'var(--section-spacing)',
          paddingBottom: 'var(--section-spacing)'
        }}
      >
        <ContentRenderer sections={page.sections} pageId={resolvedPageId} />
      </div>
    </div>
  );
}
