/** @jsxImportSource react */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadTextFromFileserver } from '@/app/lib/fileserver';
import { buildProjectFileName } from '@/app/lib/project-route';

interface AdminContextType {
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  canEdit: boolean;
  editHandlesEnabled: boolean;
  setEditHandlesEnabled: (value: boolean) => void;
  site: any;
  updateSite: (newSite: any) => void;
  content: any;
  updateContent: (newContent: any) => void;
  menu: any;
  updateMenu: (newMenu: any) => void;
  currentProjectName: string | null;
  isProjectLoading: boolean;
  projectLoadError: string;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

type SiteData = {
  logo: string;
  items: any[];
  pages: Record<string, any>;
  gallery: any[];
  footer?: {
    line1?: string;
    line2?: string;
  };
};

const EMPTY_SITE: SiteData = {
  logo: 'Mini CMS',
  items: [],
  pages: {},
  gallery: [],
};

function setLocalStorageSafely(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn(`Salvataggio localStorage saltato per quota esaurita: ${key}`);
      return false;
    }
    throw error;
  }
}

function parseStoredJson(raw: string | null) {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeSite(input: any, fallback: SiteData = EMPTY_SITE): SiteData {
  return {
    ...fallback,
    ...(input || {}),
    logo: input?.logo || fallback.logo || 'Mini CMS',
    items: Array.isArray(input?.items) ? input.items : fallback.items || [],
    pages: input?.pages || fallback.pages || {},
    gallery: Array.isArray(input?.gallery) ? input.gallery : fallback.gallery || [],
    footer: input?.footer || fallback.footer,
  };
}

function getBootState(projectName: string | null) {
  if (projectName) {
    return {
      source: 'project-route' as const,
      site: { ...EMPTY_SITE },
      legacyContent: null,
      legacyMenu: null,
    };
  }

  const savedSite = parseStoredJson(localStorage.getItem('cms-site'));
  if (savedSite) {
    return {
      source: 'saved' as const,
      site: normalizeSite(savedSite),
      legacyContent: null,
      legacyMenu: null,
    };
  }

  const legacyContent = parseStoredJson(localStorage.getItem('cms-content'));
  const legacyMenu = parseStoredJson(localStorage.getItem('cms-menu'));
  if (legacyContent || legacyMenu) {
    const legacySite = normalizeSite({
      logo: legacyMenu?.logo,
      items: legacyMenu?.items,
      pages: legacyContent?.pages,
      gallery: legacyContent?.gallery,
    });
    return {
      source: 'legacy' as const,
      site: legacySite,
      legacyContent,
      legacyMenu,
    };
  }

  return {
    source: 'empty' as const,
    site: { ...EMPTY_SITE },
    legacyContent: null,
    legacyMenu: null,
  };
}

export function AdminProvider({
  children,
  projectName = null,
}: {
  children: React.ReactNode;
  projectName?: string | null;
}) {
  const [bootState] = useState(() => getBootState(projectName));
  const [isAdmin, setIsAdminState] = useState<boolean>(() => {
    return localStorage.getItem('cms-admin-mode') === 'true';
  });
  const [editHandlesEnabled, setEditHandlesEnabledState] = useState<boolean>(() => {
    const raw = localStorage.getItem('cms-edit-handles-enabled');
    return raw === null ? true : raw === 'true';
  });

  const [site, setSite] = useState<any>(() => bootState.site);
  const [isProjectLoading, setIsProjectLoading] = useState<boolean>(bootState.source === 'project-route');
  const [projectLoadError, setProjectLoadError] = useState('');

  useEffect(() => {
    if (bootState.source === 'saved') {
      return;
    }

    let cancelled = false;

    const loadInitialSite = async () => {
      if (bootState.source === 'project-route' && projectName) {
        setIsProjectLoading(true);
        setProjectLoadError('');
        try {
          const text = await loadTextFromFileserver(buildProjectFileName(projectName));
          if (cancelled) {
            return;
          }

          const parsed = JSON.parse(text);
          setSite(normalizeSite(parsed, EMPTY_SITE));
        } catch (error) {
          if (!cancelled) {
            setProjectLoadError(error instanceof Error ? error.message : 'Errore caricamento progetto');
          }
        } finally {
          if (!cancelled) {
            setIsProjectLoading(false);
          }
        }
        return;
      }

      try {
        const module = await import('@/data/site.json');
        if (cancelled) {
          return;
        }

        const defaultSite = normalizeSite(module.default || EMPTY_SITE, EMPTY_SITE);
        if (bootState.source === 'legacy') {
          const legacySite = normalizeSite({
            logo: bootState.legacyMenu?.logo,
            items: bootState.legacyMenu?.items,
            pages: bootState.legacyContent?.pages,
            gallery: bootState.legacyContent?.gallery,
          }, defaultSite);
          setSite(legacySite);
          return;
        }

        setSite(defaultSite);
      } catch {
        // fallback: keep boot state already loaded from localStorage/empty defaults
      } finally {
        if (!cancelled) {
          setIsProjectLoading(false);
        }
      }
    };

    loadInitialSite();

    return () => {
      cancelled = true;
    };
  }, [bootState, projectName]);

  useEffect(() => {
    setLocalStorageSafely('cms-admin-mode', isAdmin.toString());
  }, [isAdmin]);

  useEffect(() => {
    setLocalStorageSafely('cms-edit-handles-enabled', editHandlesEnabled.toString());
  }, [editHandlesEnabled]);

  useEffect(() => {
    if (projectName) {
      return;
    }
    setLocalStorageSafely('cms-site', JSON.stringify(site));
  }, [projectName, site]);

  const setIsAdmin = (value: boolean) => {
    setIsAdminState(value);
  };

  const setEditHandlesEnabled = (value: boolean) => {
    setEditHandlesEnabledState(value);
  };

  const updateSite = (newSite: any) => {
    setSite(newSite);
  };

  const updateContent = (newContent: any) => {
    setSite((prev: any) => ({
      ...prev,
      pages: newContent.pages || {},
      gallery: newContent.gallery || prev.gallery || [],
    }));
  };

  const updateMenu = (newMenu: any) => {
    setSite((prev: any) => ({
      ...prev,
      logo: newMenu.logo ?? prev.logo,
      items: newMenu.items || [],
    }));
  };

  const content = { pages: site.pages || {}, gallery: site.gallery || [] };
  const menu = { logo: site.logo || 'Mini CMS', items: site.items || [] };
  const canEdit = isAdmin && editHandlesEnabled;

  return (
    <AdminContext.Provider value={{ isAdmin, setIsAdmin, canEdit, editHandlesEnabled, setEditHandlesEnabled, site, updateSite, content, updateContent, menu, updateMenu, currentProjectName: projectName, isProjectLoading, projectLoadError }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin deve essere usato all\'interno di AdminProvider');
  }
  return context;
}
