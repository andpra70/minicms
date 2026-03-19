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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [siteTitleDraft, setSiteTitleDraft] = useState('');
  const [draggedMenu, setDraggedMenu] = useState<{ level: 'top' | 'child'; parentId?: string; itemId: string } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ level: 'top' | 'child'; itemId: string; parentId?: string; position: 'before' | 'after' } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, availableThemes } = useTheme();
  const { isAdmin, canEdit, menu, updateMenu, content, updateContent, site, updateSite } = useAdmin();

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

  const hasRouteConflictExcept = (currentId: string, currentPath: string, nextId: string, nextPath: string) => {
    const allItems = menuItems.flatMap((item) => [item, ...(item.children || [])]);
    return allItems.some((item) => {
      if (item.id === currentId && item.path === currentPath) {
        return false;
      }
      return item.id === nextId || item.path === nextPath;
    });
  };

  const reorderById = (items: any[], fromId: string, toId: string, position: 'before' | 'after') => {
    const fromIndex = items.findIndex((item) => item.id === fromId);
    const toIndex = items.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0) {
      return items;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    const targetIndex = position === 'after' ? toIndex + 1 : toIndex;
    const adjustedIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    next.splice(adjustedIndex, 0, moved);
    return next;
  };

  const handleDragStart = (
    e: DragEvent<HTMLElement>,
    payload: { level: 'top' | 'child'; parentId?: string; itemId: string }
  ) => {
    if (!canEdit) return;
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

  const moveTopMenuItem = (fromId: string, toId: string, position: 'before' | 'after') => {
    const newMenu = JSON.parse(JSON.stringify(menu));
    newMenu.items = reorderById(newMenu.items || [], fromId, toId, position);
    updateMenu(newMenu);
  };

  const moveChildMenuItem = (parentId: string, fromId: string, toId: string, position: 'before' | 'after') => {
    const newMenu = JSON.parse(JSON.stringify(menu));
    const parent = (newMenu.items || []).find((item: any) => item.id === parentId);
    if (!parent || !Array.isArray(parent.children)) {
      return;
    }
    parent.children = reorderById(parent.children, fromId, toId, position);
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

  const handleStartTitleEdit = () => {
    setSiteTitleDraft(menu.logo || 'Mini CMS');
    setIsEditingTitle(true);
  };

  const handleSaveTitleEdit = () => {
    const nextValue = siteTitleDraft.trim() || 'Mini CMS';
    updateSite({
      ...site,
      logo: nextValue,
    });
    setIsEditingTitle(false);
  };

  const handleCancelTitleEdit = () => {
    setSiteTitleDraft(menu.logo || 'Mini CMS');
    setIsEditingTitle(false);
  };

  const handleEditRouteLabel = (itemToEdit: MenuItem, parentId?: string) => {
    if (!canEdit) return;

    const nextLabel = window.prompt('Nuova label pagina', itemToEdit.label);
    if (!nextLabel) return;

    const cleanedLabel = nextLabel.trim();
    if (!cleanedLabel) {
      window.alert('Label non valida.');
      return;
    }

    const currentSlug = itemToEdit.path.split('/').filter(Boolean).pop() || itemToEdit.id;
    const slugPromptLabel = parentId ? 'Nuovo slug sotto pagina' : 'Nuovo slug pagina';
    const nextSlugInput = window.prompt(`${slugPromptLabel} (es. ${currentSlug})`, currentSlug);
    if (!nextSlugInput) return;

    const nextSlug = toSlug(nextSlugInput);
    if (!nextSlug || nextSlug === 'home') {
      window.alert('Slug non valido.');
      return;
    }

    const nextPath = parentId
      ? `${((menuItems.find((item) => item.id === parentId)?.path) || '').replace(/\/$/, '')}/${nextSlug}`
      : `/${nextSlug}`;

    if (hasRouteConflictExcept(itemToEdit.id, itemToEdit.path, nextSlug, nextPath)) {
      window.alert('Questa route esiste già.');
      return;
    }

    const newMenu = JSON.parse(JSON.stringify(menu));
    let previousParentPath = '';

    if (parentId) {
      const parent = (newMenu.items || []).find((item: MenuItem) => item.id === parentId);
      const child = parent?.children?.find((childItem: MenuItem) => childItem.id === itemToEdit.id);
      if (!child) return;
      child.label = cleanedLabel;
      child.id = nextSlug;
      child.path = nextPath;
    } else {
      const item = (newMenu.items || []).find((menuItem: MenuItem) => menuItem.id === itemToEdit.id);
      if (!item) return;
      previousParentPath = item.path;
      item.label = cleanedLabel;
      item.id = nextSlug;
      item.path = nextPath;
      if (Array.isArray(item.children)) {
        item.children = item.children.map((child: MenuItem) => {
          const childSlug = child.path.split('/').filter(Boolean).pop() || child.id;
          return {
            ...child,
            path: `${nextPath}/${childSlug}`,
          };
        });
      }
    }

    updateMenu(newMenu);

    if (content?.pages?.[itemToEdit.id]) {
      const newContent = JSON.parse(JSON.stringify(content));
      newContent.pages[nextSlug] = {
        ...newContent.pages[itemToEdit.id],
        id: nextSlug,
        title: cleanedLabel,
      };
      if (nextSlug !== itemToEdit.id) {
        delete newContent.pages[itemToEdit.id];
      }
      updateContent(newContent);
    }

    if (location.pathname === itemToEdit.path) {
      navigate(nextPath);
      return;
    }

    if (!parentId && previousParentPath && location.pathname.startsWith(`${previousParentPath}/`)) {
      navigate(location.pathname.replace(previousParentPath, nextPath));
    }
  };

  const getDropPosition = (e: DragEvent<HTMLElement>, axis: 'x' | 'y') => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cursor = axis === 'x' ? e.clientX - rect.left : e.clientY - rect.top;
    const size = axis === 'x' ? rect.width : rect.height;
    return cursor < size / 2 ? 'before' : 'after';
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
          <div
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
            {canEdit ? (
              isEditingTitle ? (
                <span className="flex items-center gap-2">
                  <input
                    type="text"
                    value={siteTitleDraft}
                    onChange={(e) => setSiteTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveTitleEdit();
                      }
                      if (e.key === 'Escape') {
                        handleCancelTitleEdit();
                      }
                    }}
                    className="px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-border)',
                      fontFamily: 'var(--font-site-title)',
                      fontSize: 'var(--size-site-title)',
                      fontWeight: 'inherit',
                      lineHeight: 'inherit',
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitleEdit}
                    className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                    title="Salva titolo sito"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelTitleEdit}
                    className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                    title="Annulla modifica titolo sito"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleStartTitleEdit}
                  className="inline-flex items-center gap-2 text-left"
                  style={{
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    lineHeight: 'inherit',
                  }}
                  title="Modifica titolo sito"
                >
                  <span>{menu.logo || 'Mini CMS'}</span>
                  <Pencil className="w-4 h-4" />
                </button>
              )
            ) : (
              <Link to="/" style={{ color: 'inherit' }}>
                {menu.logo}
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="relative group flex items-center gap-1"
                draggable={canEdit}
                onDragStart={(e) => handleDragStart(e, { level: 'top', itemId: item.id })}
                onDragEnd={() => setDraggedMenu(null)}
                onDragOver={(e) => {
                  if (canEdit) {
                    e.preventDefault();
                    setDropIndicator({ level: 'top', itemId: item.id, position: getDropPosition(e, 'x') });
                  }
                }}
                onDrop={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  const payload = readDragPayload(e);
                  if (payload?.level === 'top') {
                    moveTopMenuItem(payload.itemId, item.id, getDropPosition(e, 'x'));
                    setDraggedMenu(null);
                    setDropIndicator(null);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDropIndicator((current) => (current?.level === 'top' && current.itemId === item.id ? null : current));
                  }
                }}
                style={{
                  boxShadow:
                    dropIndicator?.level === 'top' && dropIndicator.itemId === item.id
                      ? dropIndicator.position === 'before'
                        ? 'inset 3px 0 0 var(--color-primary)'
                        : 'inset -3px 0 0 var(--color-primary)'
                      : undefined,
                  borderRadius: '8px',
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

                {canEdit && item.id !== 'home' && (
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

                {canEdit && (
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

                {canEdit && (
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
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, { level: 'child', parentId: item.id, itemId: child.id })}
                          onDragEnd={() => setDraggedMenu(null)}
                          onDragOver={(e) => {
                            if (canEdit) {
                              e.preventDefault();
                              setDropIndicator({ level: 'child', parentId: item.id, itemId: child.id, position: getDropPosition(e, 'y') });
                            }
                          }}
                          onDrop={(e) => {
                            if (!canEdit) return;
                            e.preventDefault();
                            const payload = readDragPayload(e);
                            if (payload?.level === 'child' && payload.parentId === item.id) {
                              moveChildMenuItem(item.id, payload.itemId, child.id, getDropPosition(e, 'y'));
                              setDraggedMenu(null);
                              setDropIndicator(null);
                            }
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                              setDropIndicator((current) => (
                                current?.level === 'child' && current.itemId === child.id && current.parentId === item.id ? null : current
                              ));
                            }
                          }}
                          style={{
                            boxShadow:
                              dropIndicator?.level === 'child' &&
                              dropIndicator.itemId === child.id &&
                              dropIndicator.parentId === item.id
                                ? dropIndicator.position === 'before'
                                  ? 'inset 0 3px 0 var(--color-primary)'
                                  : 'inset 0 -3px 0 var(--color-primary)'
                                : undefined,
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
                          {canEdit && (
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
                          {canEdit && (
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

            {canEdit && (
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
                draggable={canEdit}
                onDragStart={(e) => handleDragStart(e, { level: 'top', itemId: item.id })}
                onDragEnd={() => setDraggedMenu(null)}
                onDragOver={(e) => {
                  if (canEdit) {
                    e.preventDefault();
                    setDropIndicator({ level: 'top', itemId: item.id, position: getDropPosition(e, 'y') });
                  }
                }}
                onDrop={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  const payload = readDragPayload(e);
                  if (payload?.level === 'top') {
                    moveTopMenuItem(payload.itemId, item.id, getDropPosition(e, 'y'));
                    setDraggedMenu(null);
                    setDropIndicator(null);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDropIndicator((current) => (current?.level === 'top' && current.itemId === item.id ? null : current));
                  }
                }}
                style={{
                  boxShadow:
                    dropIndicator?.level === 'top' && dropIndicator.itemId === item.id
                      ? dropIndicator.position === 'before'
                        ? 'inset 0 3px 0 var(--color-primary)'
                        : 'inset 0 -3px 0 var(--color-primary)'
                      : undefined,
                  borderRadius: '8px',
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
                  {canEdit && (
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
                  {canEdit && (
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
                  {canEdit && item.id !== 'home' && (
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
                    draggable={canEdit}
                    onDragStart={(e) => handleDragStart(e, { level: 'child', parentId: item.id, itemId: child.id })}
                    onDragEnd={() => setDraggedMenu(null)}
                    onDragOver={(e) => {
                      if (canEdit) {
                        e.preventDefault();
                        setDropIndicator({ level: 'child', parentId: item.id, itemId: child.id, position: getDropPosition(e, 'y') });
                      }
                    }}
                    onDrop={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      const payload = readDragPayload(e);
                      if (payload?.level === 'child' && payload.parentId === item.id) {
                        moveChildMenuItem(item.id, payload.itemId, child.id, getDropPosition(e, 'y'));
                        setDraggedMenu(null);
                        setDropIndicator(null);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        setDropIndicator((current) => (
                          current?.level === 'child' && current.itemId === child.id && current.parentId === item.id ? null : current
                        ));
                      }
                    }}
                    style={{
                      boxShadow:
                        dropIndicator?.level === 'child' &&
                        dropIndicator.itemId === child.id &&
                        dropIndicator.parentId === item.id
                          ? dropIndicator.position === 'before'
                            ? 'inset 0 3px 0 var(--color-primary)'
                            : 'inset 0 -3px 0 var(--color-primary)'
                          : undefined,
                      borderRadius: '8px',
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
                    {canEdit && (
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
                    {canEdit && (
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

            {canEdit && (
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
