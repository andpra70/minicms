import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Palette, Plus, Pencil } from 'lucide-react';
import { useState } from 'react';
import type { DragEvent } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdmin } from '@/contexts/AdminContext';

interface MenuItem {
  id: string;
  label: string;
  path: string;
  children?: MenuItem[];
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [draggedMenu, setDraggedMenu] = useState<{ level: 'top' | 'child'; parentId?: string; itemId: string } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, availableThemes } = useTheme();
  const { isAdmin, menu, updateMenu, content, updateContent } = useAdmin();

  const menuItems: MenuItem[] = Array.isArray(menu?.items) ? menu.items : [];

  const toSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const isActive = (item: MenuItem) => {
    if (location.pathname === item.path) return true;
    return (item.children || []).some((child) => location.pathname === child.path);
  };

  const hasRouteConflict = (id: string, path: string) => {
    const allItems = menuItems.flatMap((item) => [item, ...(item.children || [])]);
    return allItems.some((item) => item.id === id || item.path === path);
  };

  const reorderById = (items: any[], fromId: string, toId: string) => {
    const fromIndex = items.findIndex((item) => item.id === fromId);
    const toIndex = items.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return items;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const handleDragStart = (
    e: DragEvent<HTMLElement>,
    payload: { level: 'top' | 'child'; parentId?: string; itemId: string }
  ) => {
    if (!isAdmin) return;
    setDraggedMenu(payload);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  const readDragPayload = (e: DragEvent<HTMLElement>) => {
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return draggedMenu;
    try {
      return JSON.parse(raw) as { level: 'top' | 'child'; parentId?: string; itemId: string };
    } catch {
      return draggedMenu;
    }
  };

  const moveTopMenuItem = (fromId: string, toId: string) => {
    const newMenu = JSON.parse(JSON.stringify(menu));
    newMenu.items = reorderById(newMenu.items || [], fromId, toId);
    updateMenu(newMenu);
  };

  const moveChildMenuItem = (parentId: string, fromId: string, toId: string) => {
    const newMenu = JSON.parse(JSON.stringify(menu));
    const parent = (newMenu.items || []).find((item: any) => item.id === parentId);
    if (!parent || !Array.isArray(parent.children)) {
      return;
    }
    parent.children = reorderById(parent.children, fromId, toId);
    updateMenu(newMenu);
  };

  const ensureContentPage = (pageId: string, label: string) => {
    if (content?.pages?.[pageId]) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    if (!newContent.pages) {
      newContent.pages = {};
    }
    newContent.pages[pageId] = {
      id: pageId,
      title: label.trim(),
      sections: [],
    };
    updateContent(newContent);
  };

  const handleAddTopRoute = () => {
    const label = window.prompt('Nome voce menu (es. Portfolio)');
    if (!label) return;

    const suggestedSlug = toSlug(label);
    const slugInput = window.prompt('Slug route (es. portfolio)', suggestedSlug);
    if (!slugInput) return;

    const pageId = toSlug(slugInput);
    if (!pageId || pageId === 'home') {
      window.alert('Slug non valido.');
      return;
    }

    const routePath = `/${pageId}`;
    if (hasRouteConflict(pageId, routePath)) {
      window.alert('Questa route esiste già.');
      return;
    }

    const newMenu = JSON.parse(JSON.stringify(menu));
    if (!Array.isArray(newMenu.items)) {
      newMenu.items = [];
    }
    newMenu.items.push({
      id: pageId,
      label: label.trim(),
      path: routePath,
      children: [],
    });
    updateMenu(newMenu);
    ensureContentPage(pageId, label);
  };

  const handleAddSubRoute = (parent: MenuItem) => {
    const label = window.prompt(`Nome sotto pagina per "${parent.label}"`);
    if (!label) return;

    const suggestedSlug = toSlug(label);
    const slugInput = window.prompt('Slug sotto pagina (es. dettaglio)', suggestedSlug);
    if (!slugInput) return;

    const pageId = toSlug(slugInput);
    if (!pageId || pageId === 'home') {
      window.alert('Slug non valido.');
      return;
    }

    const parentPath = parent.path === '/' ? '' : parent.path;
    const routePath = `${parentPath}/${pageId}`;
    if (hasRouteConflict(pageId, routePath)) {
      window.alert('Questa route esiste già.');
      return;
    }

    const newMenu = JSON.parse(JSON.stringify(menu));
    const parentIndex = (newMenu.items || []).findIndex((item: MenuItem) => item.id === parent.id);
    if (parentIndex < 0) {
      return;
    }

    if (!Array.isArray(newMenu.items[parentIndex].children)) {
      newMenu.items[parentIndex].children = [];
    }

    newMenu.items[parentIndex].children.push({
      id: pageId,
      label: label.trim(),
      path: routePath,
    });

    updateMenu(newMenu);
    ensureContentPage(pageId, label);
  };

  const handleDeleteRoute = (itemToDelete: MenuItem) => {
    if (itemToDelete?.id === 'home' || itemToDelete?.path === '/') {
      window.alert('La rotta Home non puo essere eliminata.');
      return;
    }

    const confirmed = window.confirm(`Vuoi eliminare la rotta "${itemToDelete?.label}"?`);
    if (!confirmed) {
      return;
    }

    const newMenu = JSON.parse(JSON.stringify(menu));
    const deletedIds: string[] = [];

    newMenu.items = (newMenu.items || [])
      .map((item: MenuItem) => {
        if (item.id === itemToDelete.id) {
          deletedIds.push(item.id, ...((item.children || []).map((child) => child.id)));
          return null;
        }

        const originalChildren = item.children || [];
        const keptChildren = originalChildren.filter((child) => {
          if (child.id === itemToDelete.id) {
            deletedIds.push(child.id);
            return false;
          }
          return true;
        });

        return {
          ...item,
          children: keptChildren,
        };
      })
      .filter(Boolean);

    updateMenu(newMenu);

    if (deletedIds.length > 0) {
      const newContent = JSON.parse(JSON.stringify(content));
      deletedIds.forEach((id) => {
        if (newContent?.pages?.[id]) {
          delete newContent.pages[id];
        }
      });
      updateContent(newContent);
    }

    if (location.pathname === itemToDelete.path) {
      navigate('/');
    }
  };

  const handleEditRouteLabel = (itemToEdit: MenuItem, parentId?: string) => {
    if (!isAdmin) return;
    const nextLabel = window.prompt('Nuova label pagina', itemToEdit.label);
    if (!nextLabel) return;

    const cleanedLabel = nextLabel.trim();
    if (!cleanedLabel) {
      window.alert('Label non valida.');
      return;
    }

    const newMenu = JSON.parse(JSON.stringify(menu));

    if (parentId) {
      const parent = (newMenu.items || []).find((item: MenuItem) => item.id === parentId);
      const child = parent?.children?.find((childItem: MenuItem) => childItem.id === itemToEdit.id);
      if (!child) return;
      child.label = cleanedLabel;
    } else {
      const item = (newMenu.items || []).find((menuItem: MenuItem) => menuItem.id === itemToEdit.id);
      if (!item) return;
      item.label = cleanedLabel;
    }

    updateMenu(newMenu);

    if (content?.pages?.[itemToEdit.id]) {
      const newContent = JSON.parse(JSON.stringify(content));
      newContent.pages[itemToEdit.id].title = cleanedLabel;
      updateContent(newContent);
    }
  };

  return (
    <header
      className="sticky top-0 z-[1200] backdrop-blur-sm relative"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'var(--header-background)',
          opacity: 0.15,
        }}
      />

      <nav className="relative mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: 'var(--container-width)' }}>
        <div className="flex h-16 items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 font-bold text-xl"
            style={{
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-site-title)',
              fontSize: 'var(--size-site-title)',
            }}
          >
            <div
              className="w-10 h-10 bg-cover bg-center rounded-lg"
              style={{
                backgroundImage: 'var(--logo-url)',
                border: '2px solid var(--color-primary)',
              }}
            />
            {menu.logo}
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="relative group flex items-center gap-1"
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, { level: 'top', itemId: item.id })}
                onDragEnd={() => setDraggedMenu(null)}
                onDragOver={(e) => {
                  if (isAdmin) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  const payload = readDragPayload(e);
                  if (payload?.level === 'top') {
                    moveTopMenuItem(payload.itemId, item.id);
                    setDraggedMenu(null);
                  }
                }}
              >
                <Link
                  to={item.path}
                  draggable={false}
                  className="transition-colors hover:opacity-80"
                  style={{
                    color: isActive(item) ? 'var(--color-primary)' : 'var(--color-text)',
                    fontWeight: isActive(item) ? '600' : '400',
                    fontFamily: 'var(--font-nav)',
                    fontSize: 'var(--size-nav)',
                  }}
                >
                  {item.label}{(item.children || []).length > 0 ? ' ▾' : ''}
                </Link>

                {isAdmin && item.id !== 'home' && (
                  <button
                    onClick={() => handleDeleteRoute(item)}
                    className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                    title={`Elimina rotta ${item.label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => handleEditRouteLabel(item)}
                    className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                    title={`Rinomina rotta ${item.label}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => handleAddSubRoute(item)}
                    className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                    title={`Aggiungi sotto pagina a ${item.label}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}

                {(item.children || []).length > 0 && (
                  <div
                    className="absolute left-0 top-full pt-1 min-w-52 hidden group-hover:block"
                  >
                    <div
                      className="rounded-lg shadow-lg overflow-hidden"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {(item.children || []).map((child) => (
                        <div
                          key={child.id}
                          className="px-3 py-2 flex items-center gap-2"
                          draggable={isAdmin}
                          onDragStart={(e) => handleDragStart(e, { level: 'child', parentId: item.id, itemId: child.id })}
                          onDragEnd={() => setDraggedMenu(null)}
                          onDragOver={(e) => {
                            if (isAdmin) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            if (!isAdmin) return;
                            e.preventDefault();
                            const payload = readDragPayload(e);
                            if (payload?.level === 'child' && payload.parentId === item.id) {
                              moveChildMenuItem(item.id, payload.itemId, child.id);
                              setDraggedMenu(null);
                            }
                          }}
                        >
                          <Link
                            to={child.path}
                            draggable={false}
                            className="flex-1 transition-colors hover:opacity-80"
                            style={{
                              color: location.pathname === child.path ? 'var(--color-primary)' : 'var(--color-text)',
                              fontWeight: location.pathname === child.path ? '600' : '400',
                              fontFamily: 'var(--font-nav)',
                              fontSize: 'var(--size-nav)',
                            }}
                          >
                            {child.label}
                          </Link>
                          {isAdmin && (
                            <button
                              onClick={() => handleEditRouteLabel(child, item.id)}
                              className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                              style={{
                                backgroundColor: 'var(--color-background)',
                                color: 'var(--color-text)',
                                border: '1px solid var(--color-border)',
                              }}
                              title={`Rinomina rotta ${child.label}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteRoute(child)}
                              className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                              style={{
                                backgroundColor: 'var(--color-background)',
                                color: 'var(--color-text)',
                                border: '1px solid var(--color-border)',
                              }}
                              title={`Elimina rotta ${child.label}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isAdmin && (
              <button
                onClick={handleAddTopRoute}
                className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                <Plus className="w-4 h-4" />
                Nuova pagina
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="p-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
                aria-label="Cambia tema"
              >
                <Palette className="w-5 h-5" />
              </button>

              {themeMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg overflow-hidden"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {availableThemes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setThemeMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{
                        backgroundColor: theme.id === t.id ? 'var(--color-background)' : 'transparent',
                        color: 'var(--color-text)',
                      }}
                    >
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colors.primary }} />
                      <span className={theme.id === t.id ? 'font-semibold' : ''}>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            style={{ color: 'var(--color-text)' }}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="space-y-1"
                draggable={isAdmin}
                onDragStart={(e) => handleDragStart(e, { level: 'top', itemId: item.id })}
                onDragEnd={() => setDraggedMenu(null)}
                onDragOver={(e) => {
                  if (isAdmin) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault();
                  const payload = readDragPayload(e);
                  if (payload?.level === 'top') {
                    moveTopMenuItem(payload.itemId, item.id);
                    setDraggedMenu(null);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <Link
                    to={item.path}
                    draggable={false}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 flex-1"
                    style={{
                      color: isActive(item) ? 'var(--color-primary)' : 'var(--color-text)',
                      fontWeight: isActive(item) ? '600' : '400',
                      fontFamily: 'var(--font-nav)',
                      fontSize: 'var(--size-nav)',
                    }}
                  >
                    {item.label}
                  </Link>
                  {isAdmin && (
                    <button
                      onClick={() => handleEditRouteLabel(item)}
                      className="w-7 h-7 rounded-full inline-flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                      }}
                      title={`Rinomina rotta ${item.label}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => handleAddSubRoute(item)}
                      className="w-7 h-7 rounded-full inline-flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                      }}
                      title={`Aggiungi sotto pagina a ${item.label}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && item.id !== 'home' && (
                    <button
                      onClick={() => handleDeleteRoute(item)}
                      className="w-7 h-7 rounded-full inline-flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                      }}
                      title={`Elimina rotta ${item.label}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {(item.children || []).map((child) => (
                  <div
                    key={child.id}
                    className="pl-4 flex items-center gap-2"
                    draggable={isAdmin}
                    onDragStart={(e) => handleDragStart(e, { level: 'child', parentId: item.id, itemId: child.id })}
                    onDragEnd={() => setDraggedMenu(null)}
                    onDragOver={(e) => {
                      if (isAdmin) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!isAdmin) return;
                      e.preventDefault();
                      const payload = readDragPayload(e);
                      if (payload?.level === 'child' && payload.parentId === item.id) {
                        moveChildMenuItem(item.id, payload.itemId, child.id);
                        setDraggedMenu(null);
                      }
                    }}
                  >
                    <Link
                      to={child.path}
                      draggable={false}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-1 flex-1"
                      style={{
                        color: location.pathname === child.path ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontWeight: location.pathname === child.path ? '600' : '400',
                        fontFamily: 'var(--font-nav)',
                        fontSize: 'var(--size-nav)',
                      }}
                    >
                      - {child.label}
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => handleEditRouteLabel(child, item.id)}
                        className="w-7 h-7 rounded-full inline-flex items-center justify-center"
                        style={{
                          backgroundColor: 'var(--color-background)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                        }}
                        title={`Rinomina rotta ${child.label}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteRoute(child)}
                        className="w-7 h-7 rounded-full inline-flex items-center justify-center"
                        style={{
                          backgroundColor: 'var(--color-background)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                        }}
                        title={`Elimina rotta ${child.label}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {isAdmin && (
              <button
                onClick={handleAddTopRoute}
                className="w-full py-2 px-3 text-left flex items-center gap-2 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <Plus className="w-4 h-4" />
                Nuova pagina
              </button>
            )}

            <div className="pt-4 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Tema
              </div>
              {availableThemes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2 px-3 text-left flex items-center gap-3 rounded-lg"
                  style={{
                    backgroundColor: theme.id === t.id ? 'var(--color-background)' : 'transparent',
                    color: 'var(--color-text)',
                  }}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colors.primary }} />
                  <span className={theme.id === t.id ? 'font-semibold' : ''}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
