/** @jsxImportSource react */
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminContextType {
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  site: any;
  updateSite: (newSite: any) => void;
  content: any;
  updateContent: (newContent: any) => void;
  menu: any;
  updateMenu: (newMenu: any) => void;
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

function getBootState() {
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

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [bootState] = useState(() => getBootState());
  const [isAdmin, setIsAdminState] = useState<boolean>(() => {
    return localStorage.getItem('cms-admin-mode') === 'true';
  });

  const [site, setSite] = useState<any>(() => bootState.site);

  useEffect(() => {
    if (bootState.source === 'saved') {
      return;
    }

    let cancelled = false;

    const loadDefaultSite = async () => {
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
      }
    };

    loadDefaultSite();

    return () => {
      cancelled = true;
    };
  }, [bootState]);

  useEffect(() => {
    localStorage.setItem('cms-admin-mode', isAdmin.toString());
  }, [isAdmin]);

  useEffect(() => {
    localStorage.setItem('cms-site', JSON.stringify(site));
  }, [site]);

  const setIsAdmin = (value: boolean) => {
    setIsAdminState(value);
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

  return (
    <AdminContext.Provider value={{ isAdmin, setIsAdmin, site, updateSite, content, updateContent, menu, updateMenu }}>
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
