import { useState } from 'react';
import { Settings, X, Save, Download, Upload, Paintbrush } from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useTheme } from '@/contexts/ThemeContext';
import { themes } from '@/themes/themes';
import { resolveAppAssetUrl } from '@/app/lib/urls';
import { loadTextFromFileserver, saveTextToFileserver } from '@/app/lib/fileserver';
import { buildProjectFileName, setProjectUrl } from '@/app/lib/project-route';

const LOCAL_IMAGE_OPTIONS = [
  'img/2.webp',
  'img/3.webp',
  'img/4.gif',
  'img/5.jpg',
  'img/6.jpg',
  'img/me.webp',
];

const FONT_OPTIONS = [
  'system-ui, -apple-system, sans-serif',
  'Inter, sans-serif',
  'Arial, sans-serif',
  'Helvetica, sans-serif',
  'Georgia, serif',
  '"Times New Roman", serif',
  'Verdana, sans-serif',
  '"Trebuchet MS", sans-serif',
  '"Courier New", monospace',
];

const DEFAULT_TYPOGRAPHY = {
  siteTitleSize: '1.25rem',
  navSize: '1rem',
  h1Size: '3rem',
  h2Size: '2.25rem',
  h3Size: '1.5rem',
  bodySize: '1.125rem',
};

const DEFAULT_SPACING = {
  container: '1280px',
  section: '80px',
  density: 'normal' as 'normal' | 'compact' | 'ultra-compact',
};

const PROJECT_NAME_STORAGE_KEY = 'cms-project-name';

function generateStaticHTML(menuData: any, contentData: any, theme: any) {
  const footerData = {
    line1: menuData?.footer?.line1 || '&copy; 2026 Mini CMS. Tutti i diritti riservati.',
    line2: menuData?.footer?.line2 || 'Sistema di gestione contenuti basato su JSON con temi intercambiabili',
  };

  function escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const typography = { ...DEFAULT_TYPOGRAPHY, ...(theme.typography || {}) };
  const embeddedGallery = Array.isArray(contentData?.gallery) ? contentData.gallery : [];
  // Mapping counter per le immagini
  let imageCounter = 0;
  const imageMapping: { [key: string]: string } = {};
  
  // Funzione per convertire un URL di immagine a path locale
  function getLocalImagePath(imageUrl: string): string {
    if (!imageUrl) return '';

    if (imageUrl.startsWith('gallery:')) {
      const imageId = imageUrl.slice('gallery:'.length);
      const embeddedImage = embeddedGallery.find((item: any) => item.id === imageId);
      return embeddedImage?.data || '';
    }
    
    // Se è già un path locale (inizia con 'img/'), mantienilo
    if (imageUrl.startsWith('img/') || imageUrl.startsWith('/img/')) {
      return imageUrl.replace(/^\/+/, '');
    }

    if (imageUrl.startsWith('data:image/')) {
      return imageUrl;
    }
    
    // Se è un URL esterno, crea un mapping
    if (!imageMapping[imageUrl]) {
      imageCounter++;
      const ext = imageUrl.includes('.') ? imageUrl.split('.').pop() : 'jpg';
      imageMapping[imageUrl] = `img/image-${imageCounter}.${ext}`;
    }
    
    return imageMapping[imageUrl];
  }

  const css = `
    <style>
      :root {
        --color-primary: ${theme.colors.primary};
        --color-secondary: ${theme.colors.secondary};
        --color-accent: ${theme.colors.accent};
        --color-text: ${theme.colors.text};
        --color-text-secondary: ${theme.colors.textSecondary};
        --color-background: ${theme.colors.background};
        --color-surface: ${theme.colors.surface};
        --color-border: ${theme.colors.border};
        --border-radius: ${theme.borderRadius || '8px'};
        --font-heading: ${theme.fonts?.heading || 'system-ui, -apple-system, sans-serif'};
        --font-body: ${theme.fonts?.body || 'system-ui, -apple-system, sans-serif'};
        --font-site-title: ${theme.fonts?.heading || 'system-ui, -apple-system, sans-serif'};
        --size-site-title: ${typography.siteTitleSize};
        --font-nav: ${theme.fonts?.body || 'system-ui, -apple-system, sans-serif'};
        --size-nav: ${typography.navSize};
        --font-h1: ${theme.fonts?.heading || 'system-ui, -apple-system, sans-serif'};
        --size-h1: ${typography.h1Size};
        --font-h2: ${theme.fonts?.heading || 'system-ui, -apple-system, sans-serif'};
        --size-h2: ${typography.h2Size};
        --font-h3: ${theme.fonts?.heading || 'system-ui, -apple-system, sans-serif'};
        --size-h3: ${typography.h3Size};
        --font-body-copy: ${theme.fonts?.body || 'system-ui, -apple-system, sans-serif'};
        --size-body-copy: ${typography.bodySize};
        --container-width: ${theme.spacing?.container || '1200px'};
        --section-spacing: ${theme.spacing?.section || '80px'};
        --header-background: url(${theme.headerBackground || ''});
        --footer-background: url(${theme.footerBackground || ''});
        --logo-url: url(${theme.logo || ''});
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: var(--font-body);
        background-color: var(--color-background);
        color: var(--color-text);
        line-height: 1.6;
      }

      .container {
        max-width: var(--container-width);
        margin: 0 auto;
        padding: 0 1rem;
      }

      /* Header */
      header {
        background-color: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        position: sticky;
        top: 0;
        z-index: 50;
        backdrop-filter: blur(8px);
        position: relative;
        overflow: hidden;
      }

      header::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: var(--header-background);
        background-size: cover;
        background-position: center;
        opacity: 0.15;
      }

      nav {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 4rem;
        padding: 0 1rem;
        max-width: var(--container-width);
        margin: 0 auto;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: bold;
        font-size: var(--size-site-title);
        color: var(--color-primary);
        text-decoration: none;
        font-family: var(--font-site-title);
      }

      .logo-icon {
        width: 2.5rem;
        height: 2.5rem;
        background-image: var(--logo-url);
        background-size: cover;
        background-position: center;
        border-radius: var(--border-radius);
        border: 2px solid var(--color-primary);
      }

      .nav-menu {
        display: flex;
        align-items: center;
        gap: 2rem;
      }

      .nav-link {
        color: var(--color-text);
        text-decoration: none;
        transition: opacity 0.2s;
        font-weight: 400;
        font-family: var(--font-nav);
        font-size: var(--size-nav);
      }

      .nav-link.active {
        color: var(--color-primary);
        font-weight: 600;
      }

      .nav-link:hover {
        opacity: 0.8;
      }

      /* Main Content */
      main {
        min-height: calc(100vh - 8rem);
      }

      section {
        padding: 4rem 0;
      }

      h1 {
        font-size: var(--size-h1);
        font-weight: bold;
        margin-bottom: 1.5rem;
        color: var(--color-text);
        font-family: var(--font-h1);
      }

      h2 {
        font-size: var(--size-h2);
        font-weight: bold;
        margin-bottom: 1rem;
        color: var(--color-text);
        font-family: var(--font-h2);
      }

      h3 {
        font-size: var(--size-h3);
        font-weight: bold;
        margin-bottom: 0.75rem;
        color: var(--color-primary);
        font-family: var(--font-h3);
      }

      p {
        color: var(--color-text-secondary);
        margin-bottom: 1rem;
        font-family: var(--font-body-copy);
        font-size: var(--size-body-copy);
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 2rem;
        background-color: var(--color-primary);
        color: white;
        text-decoration: none;
        border-radius: var(--border-radius);
        font-weight: 600;
        transition: transform 0.2s;
      }

      .btn-primary:hover {
        transform: scale(1.05);
      }

      /* Hero Section */
      .hero {
        text-align: center;
        padding: 5rem 0;
      }

      .hero img {
        width: 100%;
        max-width: 64rem;
        height: 16rem;
        object-fit: cover;
        border-radius: var(--border-radius);
        margin-bottom: 2rem;
      }

      .hero h1 {
        font-size: 3.5rem;
        margin-bottom: 2rem;
      }

      .hero p {
        font-size: 1.25rem;
        margin-bottom: 2rem;
        max-width: 48rem;
        margin-left: auto;
        margin-right: auto;
      }

      /* Grid */
      .grid {
        display: grid;
        gap: 2rem;
      }

      .grid-3 {
        grid-template-columns: repeat(3, 1fr);
      }

      .card {
        background-color: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .card img {
        width: 100%;
        height: 12rem;
        object-fit: cover;
      }

      .card-content {
        padding: 1.5rem;
      }

      .content-image {
        width: 100%;
        height: 16rem;
        object-fit: cover;
        border-radius: var(--border-radius);
      }

      .grid-2 {
        grid-template-columns: repeat(2, 1fr);
        align-items: center;
        gap: 2rem;
      }

      .badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        background-color: var(--color-background);
        color: var(--color-primary);
        border: 1px solid var(--color-border);
        border-radius: 9999px;
        font-size: 0.875rem;
        margin: 0.25rem;
      }

      /* Contact */
      .contact-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.5rem;
        background-color: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        margin-bottom: 1rem;
      }

      .contact-icon {
        width: 2.5rem;
        height: 2.5rem;
        background-color: var(--color-primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }

      /* Footer */
      footer {
        background-color: var(--color-surface);
        border-top: 1px solid var(--color-border);
        padding: 2rem 0;
        text-align: center;
        color: var(--color-text-secondary);
      }

      /* Responsive */
      @media (max-width: 768px) {
        .grid-3, .grid-2 {
          grid-template-columns: 1fr;
        }

        .nav-menu {
          display: none;
        }

        h1 {
          font-size: 2.5rem;
        }

        .hero h1 {
          font-size: 2.5rem;
        }

        h2 {
          font-size: 1.875rem;
        }
      }

      /* Single Page App Navigation */
      .page {
        display: none;
      }

      .page.active {
        display: block;
      }

      .mobile-menu-toggle {
        display: none;
      }

      @media (max-width: 768px) {
        .mobile-menu-toggle {
          display: block;
        }

        .nav-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background-color: var(--color-surface);
          border-top: 1px solid var(--color-border);
          flex-direction: column;
          padding: 1rem;
          gap: 0.5rem;
        }

        .nav-menu.mobile-open {
          display: flex;
        }
      }
    </style>
  `;

  function renderHeroSection(section: any, pageId: string, sectionIndex: number) {
    const posX = section.imagePosX ?? 50;
    const posY = section.imagePosY ?? 50;
    return `
      <section class="page" id="${pageId}">
        <div class="hero">
          ${section.image ? `<img src="${getLocalImagePath(section.image)}" alt="${section.title || ''}" style="object-position: ${posX}% ${posY}%" />` : ''}
          <h1>${section.title || ''}</h1>
          <p>${section.subtitle || ''}</p>
          ${section.cta ? `
            <a href="#${section.cta.link?.replace('/', '')}" class="btn-primary">
              ${section.cta.text}
              <span>→</span>
            </a>
          ` : ''}
        </div>
      </section>
    `;
  }

  function renderFeaturesSection(section: any, pageId: string, sectionIndex: number) {
    const itemsHtml = (section.items || []).map((item: any) => {
      const posX = item.imagePosX ?? 50;
      const posY = item.imagePosY ?? 50;
      return `
      <div class="card">
        ${item.image ? `<img src="${getLocalImagePath(item.image)}" alt="${item.title}" style="object-position: ${posX}% ${posY}%" />` : ''}
        <div class="card-content">
          <h3>${item.title || ''}</h3>
          <p>${item.description || ''}</p>
        </div>
      </div>
    `;
    }).join('');

    return `
      <section class="page active" id="${pageId}">
        <div class="container">
          <h2 style="text-align: center; margin-bottom: 3rem;">${section.title || ''}</h2>
          <div class="grid grid-3">
            ${itemsHtml}
          </div>
        </div>
      </section>
    `;
  }

  function renderContentSection(section: any, pageId: string, sectionIndex: number) {
    const posX = section.imagePosX ?? 50;
    const posY = section.imagePosY ?? 50;
    return `
      <section class="page" id="${pageId}">
        <div class="container">
          <div class="${section.image ? 'grid grid-2' : ''}">
            <div>
              <h2>${section.title || ''}</h2>
              <p style="font-size: 1.125rem; line-height: 1.75;">${section.content || ''}</p>
            </div>
            ${section.image ? `<img src="${getLocalImagePath(section.image)}" alt="${section.title}" class="content-image" style="object-position: ${posX}% ${posY}%" />` : ''}
          </div>
        </div>
      </section>
    `;
  }

  function renderServicesListSection(section: any, pageId: string, sectionIndex: number) {
    const itemsHtml = (section.items || []).map((item: any) => {
      const posX = item.imagePosX ?? 50;
      const posY = item.imagePosY ?? 50;
      return `
      <div class="card" style="margin-bottom: 2rem;">
        ${item.image ? `<img src="${getLocalImagePath(item.image)}" alt="${item.title}" style="object-position: ${posX}% ${posY}%" />` : ''}
        <div class="card-content">
          <h3>${item.title || ''}</h3>
          <p>${item.description || ''}</p>
          <div>
            ${(item.features || []).map((feature: string) => `<span class="badge">${feature}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
    }).join('');

    return `
      <section class="page" id="${pageId}">
        <div class="container">
          ${itemsHtml}
        </div>
      </section>
    `;
  }

  function renderBlogListSection(section: any, pageId: string, sectionIndex: number) {
    const itemsHtml = (section.items || []).map((item: any) => {
      const posX = item.imagePosX ?? 50;
      const posY = item.imagePosY ?? 50;
      return `
      <article class="card">
        ${item.image ? `<img src="${getLocalImagePath(item.image)}" alt="${item.title}" style="object-position: ${posX}% ${posY}%" />` : ''}
        <div class="card-content">
          <h3>${item.title || ''}</h3>
          <p>${item.excerpt || ''}</p>
          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--color-text-secondary);">
            <span>${item.author || ''}</span>
            <span>${new Date(item.date).toLocaleDateString('it-IT')}</span>
          </div>
        </div>
      </article>
    `;
    }).join('');

    return `
      <section class="page" id="${pageId}">
        <div class="container">
          <div class="grid grid-3">
            ${itemsHtml}
          </div>
        </div>
      </section>
    `;
  }

  function renderContactInfoSection(section: any, pageId: string, sectionIndex: number) {
    const contactHtml = (section.info || []).map((item: any) => {
      const icons: { [key: string]: string } = {
        Email: '📧',
        Telefono: '📞',
        Indirizzo: '📍',
      };
      const icon = icons[item.label] || '📧';

      return `
        <div class="contact-item">
          <div class="contact-icon">${icon}</div>
          <div>
            <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; color: var(--color-text-secondary);">
              ${item.label}
            </div>
            <div style="font-size: 1.125rem;">
              ${item.value || ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="page" id="${pageId}">
        <div class="container" style="max-width: 32rem;">
          ${contactHtml}
        </div>
      </section>
    `;
  }

  function renderPlaceSection(section: any, pageId: string, sectionIndex: number) {
    const lat = Number(section.lat);
    const lng = Number(section.lng);
    const zoom = Number(section.zoom || 15);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const delta = 0.01;
    const embedSrc = hasCoords
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`
      : '';

    return `
      <section class="page" id="${pageId}">
        <div class="container">
          <div class="grid grid-2">
            <div>
              <h2>${section.title || ''}</h2>
              <p style="font-size: 1.125rem; line-height: 1.75;">${section.address || ''}</p>
              <p style="font-size: 1.125rem; line-height: 1.75;">${section.description || ''}</p>
            </div>
            <div class="card" style="min-height: 360px;">
              ${hasCoords ? `<iframe src="${embedSrc}" style="width:100%;height:360px;border:0;" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<div class="card-content"><p>Mappa non disponibile.</p></div>'}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderCalendarSection(section: any, pageId: string, sectionIndex: number) {
    const parsedEntries = String(section.entries || '')
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `<span class="badge">${escapeHtml(item)}</span>`)
      .join('');

    return `
      <section class="page" id="${pageId}">
        <div class="container">
          <div class="grid grid-2">
            <div>
              <h2>${section.title || ''}</h2>
              <p style="font-size: 1.125rem; line-height: 1.75;">${section.description || ''}</p>
              <div>${parsedEntries || '<span class="badge">Nessuna data configurata</span>'}</div>
            </div>
            <div class="card">
              <div class="card-content">
                <h3>Date in evidenza</h3>
                <p>Questa esportazione statica mostra l'elenco delle date configurate.</p>
                <div>${parsedEntries || '<span class="badge">Nessuna data configurata</span>'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderSection(section: any, pageId: string, sectionIndex: number) {
    switch (section.type) {
      case 'hero':
        return renderHeroSection(section, pageId, sectionIndex);
      case 'features':
        return renderFeaturesSection(section, pageId, sectionIndex);
      case 'content':
        return renderContentSection(section, pageId, sectionIndex);
      case 'services-list':
        return renderServicesListSection(section, pageId, sectionIndex);
      case 'blog-list':
        return renderBlogListSection(section, pageId, sectionIndex);
      case 'contact-info':
        return renderContactInfoSection(section, pageId, sectionIndex);
      case 'place':
        return renderPlaceSection(section, pageId, sectionIndex);
      case 'calendar':
        return renderCalendarSection(section, pageId, sectionIndex);
      default:
        return '';
    }
  }

  function renderPage(page: any) {
    const sectionsHtml = (page.sections || []).map((section: any, index: number) => 
      renderSection(section, page.id, index)
    ).join('');

    return sectionsHtml;
  }

  const navLinks = (menuData.items || []).flatMap((item: any) => {
    const children = (item.children || []).map((child: any) => `
      <a href="#${child.id}" class="nav-link" data-page="${child.id}">${item.label} / ${child.label}</a>
    `);
    return [
      `
        <a href="#${item.id}" class="nav-link ${item.id === 'home' ? 'active' : ''}" data-page="${item.id}">${item.label}</a>
      `,
      ...children,
    ];
  }).join('');

  const pagesHtml = Object.values(contentData.pages).map((page: any) => renderPage(page)).join('');

  // Crea il mapping delle immagini per il commento HTML
  const imageMappingComment = Object.entries(imageMapping).length > 0 
    ? `\n<!-- IMMAGINI DA CARICARE IN public/img/:\n${Object.entries(imageMapping).map(([original, local]) => `  - ${local} (originale: ${original})`).join('\n')}\n-->\n`
    : '';

  const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${menuData.logo} - Sito Statico</title>
      ${css}
    </head>
    <body>${imageMappingComment}
      <header>
        <nav>
          <a href="#home" class="logo">
            <div class="logo-icon"></div>
            ${menuData.logo}
          </a>
          <div class="nav-menu">
            ${navLinks}
          </div>
          <button class="mobile-menu-toggle" onclick="toggleMobileMenu()">☰</button>
        </nav>
      </header>

      <main>
        ${pagesHtml}
      </main>

      <footer>
        <div class="container">
          <p>${escapeHtml(footerData.line1)}</p>
          <p style="margin-top: 8px; font-size: 0.875rem;">${escapeHtml(footerData.line2)}</p>
        </div>
      </footer>

      <script>
        function showPage(pageId) {
          // Hide all pages
          document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
          });
          
          // Show selected page
          const targetPages = document.querySelectorAll(\`.page[id="\${pageId}"]\`);
          targetPages.forEach(page => {
            page.classList.add('active');
          });
          
          // Update active nav link
          document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
          });
          document.querySelectorAll(\`.nav-link[data-page="\${pageId}"]\`).forEach(link => {
            link.classList.add('active');
          });
        }

        // Handle navigation
        document.addEventListener('click', function(e) {
          if (e.target.classList.contains('nav-link')) {
            e.preventDefault();
            const pageId = e.target.getAttribute('data-page');
            showPage(pageId);
            
            // Close mobile menu if open
            document.querySelector('.nav-menu').classList.remove('mobile-open');
          }
        });

        function toggleMobileMenu() {
          document.querySelector('.nav-menu').classList.toggle('mobile-open');
        }

        // Show home page by default
        showPage('home');
      </script>
    </body>
    </html>
  `;

  return html;
}

export function AdminPanel() {
  const { isAdmin, setIsAdmin, site, updateSite } = useAdmin();
  const [showPanel, setShowPanel] = useState(false);

  if (!isAdmin) {
    return (
      <button
        onClick={() => setIsAdmin(true)}
        className="fixed bottom-4 right-4 p-3 rounded-full shadow-lg z-[1300] opacity-50 hover:opacity-100 transition-opacity"
        style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
        title="Attiva modalità admin"
      >
        <Settings className="w-5 h-5" />
      </button>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[1300] flex flex-col items-end gap-3">
        <ContentActions site={site} updateSite={updateSite} />

        <button
          onClick={() => setShowPanel((prev) => !prev)}
          className="p-3 rounded-full shadow-lg transition-transform hover:scale-110"
          style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
          title="Tema"
        >
          <Paintbrush className="w-5 h-5" />
        </button>
      </div>

      {showPanel && (
        <div
          className="fixed bottom-20 right-4 w-96 max-h-[600px] rounded-lg shadow-2xl z-[1300] overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Header */}
          <div
            className="p-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-3">
              <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
                Tema
              </h3>
              <button
                onClick={() => setIsAdmin(false)}
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Esci
              </button>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="p-2 rounded"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              title="Chiudi pannello"
              aria-label="Chiudi pannello"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <ThemeEditor />
          </div>
        </div>
      )}
    </>
  );
}

function ContentActions({ site, updateSite }: { site: any; updateSite: (newSite: any) => void }) {
  const [error, setError] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { currentProjectName } = useAdmin();
  const [projectName, setProjectName] = useState(() => currentProjectName || localStorage.getItem(PROJECT_NAME_STORAGE_KEY) || 'site');

  const fileName = buildProjectFileName(projectName);
  const closeMenu = () => setIsMenuOpen(false);
  const handleProjectNameChange = (value: string) => {
    setProjectName(value);
    localStorage.setItem(PROJECT_NAME_STORAGE_KEY, value);
  };

  const handleSave = () => {
    updateSite(site);
    setError('');
    closeMenu();
  };

  const handleDownload = () => {
    setProjectUrl(projectName);
    const blob = new Blob([JSON.stringify(site, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    closeMenu();
  };

  const handleSaveToFileserver = async () => {
    try {
      setProjectUrl(projectName);
      await saveTextToFileserver(fileName, JSON.stringify(site, null, 2));
      setError('');
      closeMenu();
    } catch (error) {
      console.error('Errore salvataggio fileserver:', error);
      alert(`Salvataggio su fileserver fallito: ${error instanceof Error ? error.message : 'errore sconosciuto'}`);
    }
  };

  const handleLoadFromFileserver = async () => {
    try {
      setProjectUrl(projectName);
      const text = await loadTextFromFileserver(fileName);
      const parsed = JSON.parse(text);
      updateSite(parsed);
      setError('');
      closeMenu();
    } catch (error) {
      console.error('Errore caricamento fileserver:', error);
      setError(error instanceof Error && error.message.includes('JSON') ? 'JSON non valido nel file caricato' : '');
      alert(`Caricamento da fileserver fallito: ${error instanceof Error ? error.message : 'errore sconosciuto'}`);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);
          updateSite(parsed);
          setError('');
          closeMenu();
        } catch {
          setError('JSON non valido nel file caricato');
          alert('Caricamento file fallito: JSON non valido');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div
      className="flex flex-col items-end gap-2"
      onMouseEnter={() => setIsMenuOpen(true)}
      onMouseLeave={() => setIsMenuOpen(false)}
    >
      <div
        className={`rounded-lg shadow-2xl p-2 flex flex-col gap-2 min-w-56 transition-all duration-200 ${isMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex flex-col gap-1 px-1 pb-1">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Nome progetto
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => handleProjectNameChange(e.target.value)}
            className="w-full px-2 py-2 rounded text-sm"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            placeholder="nome-progetto"
          />
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            File: {fileName}
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
          title="Scarica"
          aria-label="Scarica"
        >
          <Download className="w-4 h-4" />
          Scarica
        </button>
        <label
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm cursor-pointer"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
          title="Carica JSON"
          aria-label="Carica JSON"
        >
          <Upload className="w-4 h-4" />
          Carica
          <input type="file" accept=".json" onChange={handleUpload} className="hidden" />
        </label>
        <button
          onClick={handleSaveToFileserver}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
          title="Salva su fileserver"
          aria-label="Salva su fileserver"
        >
          <Upload className="w-4 h-4" />
          Salva FS
        </button>
        <button
          onClick={handleLoadFromFileserver}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
          title="Carica da fileserver"
          aria-label="Carica da fileserver"
        >
          <Download className="w-4 h-4" />
          Carica FS
        </button>
        <button
          onClick={handleSave}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium"
          style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
          title="Salva"
          aria-label="Salva"
        >
          <Save className="w-4 h-4" />
          Salva
        </button>
      </div>
      {error && (
        <div
          className="max-w-64 p-2 rounded text-sm"
          style={{ backgroundColor: '#fee', color: '#c00' }}
        >
          {error}
        </div>
      )}
      <button
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className="p-3 rounded-full shadow-lg transition-transform hover:scale-110"
        style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
        title="Azioni contenuti"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
}

function ThemeEditor() {
  const { theme, setTheme, availableThemes } = useTheme();
  const { menu, updateMenu, site, currentProjectName } = useAdmin();
  const [customTheme, setCustomTheme] = useState(theme);
  const [themeName, setThemeName] = useState('');
  const projectFileName = buildProjectFileName(currentProjectName || localStorage.getItem(PROJECT_NAME_STORAGE_KEY) || 'site');

  const handleColorChange = (key: keyof typeof theme.colors, value: string) => {
    setCustomTheme({
      ...customTheme,
      colors: {
        ...customTheme.colors,
        [key]: value,
      },
    });
  };

  const handleImageChange = (key: 'logo' | 'headerBackground' | 'footerBackground', value: string) => {
    setCustomTheme({
      ...customTheme,
      [key]: value,
    });
  };

  const handleTypographyChange = (key: string, value: string) => {
    setCustomTheme({
      ...customTheme,
      typography: {
        ...DEFAULT_TYPOGRAPHY,
        ...(customTheme.typography || {}),
        [key]: value,
      },
    });
  };

  const handleSpacingChange = (key: 'container' | 'section' | 'density', value: string) => {
    setCustomTheme({
      ...customTheme,
      spacing: {
        ...DEFAULT_SPACING,
        ...(customTheme.spacing || {}),
        [key]: value,
      },
    });
  };

  const handleSiteTitleChange = (value: string) => {
    const newMenu = JSON.parse(JSON.stringify(menu));
    newMenu.logo = value;
    updateMenu(newMenu);
  };

  const handleApply = () => {
    const root = document.documentElement;
    const typography = { ...DEFAULT_TYPOGRAPHY, ...(customTheme.typography || {}) };
    const spacing = { ...DEFAULT_SPACING, ...(customTheme.spacing || {}) };
    Object.entries(customTheme.colors).forEach(([key, value]) => {
      const cssVar = '--color-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(cssVar, value);
    });
    root.style.setProperty('--font-heading', customTheme.fonts.heading);
    root.style.setProperty('--font-body', customTheme.fonts.body);
    root.style.setProperty('--font-site-title', customTheme.fonts.heading);
    root.style.setProperty('--size-site-title', typography.siteTitleSize);
    root.style.setProperty('--font-nav', customTheme.fonts.body);
    root.style.setProperty('--size-nav', typography.navSize);
    root.style.setProperty('--font-h1', customTheme.fonts.heading);
    root.style.setProperty('--size-h1', typography.h1Size);
    root.style.setProperty('--font-h2', customTheme.fonts.heading);
    root.style.setProperty('--size-h2', typography.h2Size);
    root.style.setProperty('--font-h3', customTheme.fonts.heading);
    root.style.setProperty('--size-h3', typography.h3Size);
    root.style.setProperty('--font-body-copy', customTheme.fonts.body);
    root.style.setProperty('--size-body-copy', typography.bodySize);
    root.style.setProperty('--container-width', spacing.container);
    root.style.setProperty('--section-spacing', spacing.section);
    root.dataset.cmsDensity = spacing.density;
    root.style.setProperty('--logo-url', `url(${customTheme.logo})`);
    root.style.setProperty('--header-background', `url(${customTheme.headerBackground})`);
    root.style.setProperty('--footer-background', `url(${customTheme.footerBackground})`);
    alert('Tema applicato! (Temporaneo)');
  };

  const handleSave = () => {
    if (!themeName) {
      alert('Inserisci un nome per il tema');
      return;
    }
    
    const savedThemes = JSON.parse(localStorage.getItem('cms-custom-themes') || '[]');
    const newTheme = {
      ...customTheme,
      id: themeName.toLowerCase().replace(/\s+/g, '-'),
      name: themeName,
    };
    savedThemes.push(newTheme);
    localStorage.setItem('cms-custom-themes', JSON.stringify(savedThemes));
    alert('Tema salvato! Ricarica la pagina per vederlo nella lista.');
    setThemeName('');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(customTheme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-theme.json';
    a.click();
  };

  const typography = { ...DEFAULT_TYPOGRAPHY, ...(customTheme.typography || {}) };
  const spacing = { ...DEFAULT_SPACING, ...(customTheme.spacing || {}) };

  return (
    <div className="space-y-4">
      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        File attivo: {projectFileName} | Pagine: {Object.keys(site?.pages || {}).length}
      </div>
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          Titolo Sito
        </label>
        <input
          type="text"
          value={menu.logo || ''}
          onChange={(e) => handleSiteTitleChange(e.target.value)}
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
          placeholder="Titolo del sito"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          Font Tema (unico)
        </label>
        <select
          value={customTheme.fonts.body}
          onChange={(e) =>
            setCustomTheme({
              ...customTheme,
              fonts: {
                heading: e.target.value,
                body: e.target.value,
              },
            })
          }
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          Tema Base
        </label>
        <select
          value={theme.id}
          onChange={(e) => {
            setTheme(e.target.value);
            const selected = availableThemes.find(t => t.id === e.target.value);
            if (selected) setCustomTheme(selected);
          }}
          className="w-full px-3 py-2 rounded"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
        >
          {availableThemes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>
          Immagini
        </h4>
        
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Logo URL
          </label>
          <input
            type="text"
            value={customTheme.logo}
            onChange={(e) => handleImageChange('logo', e.target.value)}
            className="w-full px-2 py-1 text-sm rounded font-mono"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            placeholder="https://..."
          />
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {LOCAL_IMAGE_OPTIONS.map((imagePath) => (
              <button
                key={imagePath}
                type="button"
                onClick={() => handleImageChange('logo', imagePath)}
                className="h-14 rounded overflow-hidden"
                style={{
                  border: customTheme.logo === imagePath ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-background)',
                }}
                title={imagePath}
              >
                <img src={resolveAppAssetUrl(imagePath)} alt={imagePath} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Sfondo Header URL
          </label>
          <input
            type="text"
            value={customTheme.headerBackground}
            onChange={(e) => handleImageChange('headerBackground', e.target.value)}
            className="w-full px-2 py-1 text-sm rounded font-mono"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Sfondo Footer URL
          </label>
          <input
            type="text"
            value={customTheme.footerBackground}
            onChange={(e) => handleImageChange('footerBackground', e.target.value)}
            className="w-full px-2 py-1 text-sm rounded font-mono"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>
          Tipografia
        </h4>

        {[
          ['siteTitle', 'Titolo sito', 'siteTitleSize'],
          ['nav', 'Menu navigazione', 'navSize'],
          ['h1', 'Heading H1', 'h1Size'],
          ['h2', 'Heading H2', 'h2Size'],
          ['h3', 'Heading H3', 'h3Size'],
          ['body', 'Testo contenuti', 'bodySize'],
        ].map(([id, label, sizeKey]) => (
          <div
            key={id}
            className="p-3 rounded space-y-2"
            style={{
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {label}
            </div>
            <input
              type="text"
              value={(typography as any)[sizeKey]}
              onChange={(e) => handleTypographyChange(sizeKey, e.target.value)}
              className="w-full px-2 py-1 text-sm rounded font-mono"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              placeholder="es: 1.25rem o 20px"
            />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>
          Spaziatura
        </h4>

        <div
          className="p-3 rounded space-y-2"
          style={{
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
          }}
        >
          <label className="block text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Larghezza contenitore
          </label>
          <input
            type="text"
            value={spacing.container}
            onChange={(e) => handleSpacingChange('container', e.target.value)}
            className="w-full px-2 py-1 text-sm rounded font-mono"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            placeholder="es: 1280px"
          />
        </div>

        <div
          className="p-3 rounded space-y-2"
          style={{
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
          }}
        >
          <label className="block text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Spazio verticale sezioni
          </label>
          <input
            type="text"
            value={spacing.section}
            onChange={(e) => handleSpacingChange('section', e.target.value)}
            className="w-full px-2 py-1 text-sm rounded font-mono"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            placeholder="es: 80px"
          />
        </div>

        <div
          className="p-3 rounded space-y-2"
          style={{
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
          }}
        >
          <label className="block text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Densita UI (margini/padding)
          </label>
          <select
            value={spacing.density}
            onChange={(e) => handleSpacingChange('density', e.target.value)}
            className="w-full px-2 py-1 text-sm rounded"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            <option value="normal">Normale</option>
            <option value="compact">Compatta</option>
            <option value="ultra-compact">Ultra compatta</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium" style={{ color: 'var(--color-text)' }}>
          Personalizza Colori
        </h4>
        {Object.entries(customTheme.colors).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <label className="flex-1 text-sm capitalize" style={{ color: 'var(--color-text-secondary)' }}>
              {key.replace(/([A-Z])/g, ' $1')}
            </label>
            <input
              type="color"
              value={value}
              onChange={(e) => handleColorChange(key as keyof typeof theme.colors, e.target.value)}
              className="w-12 h-8 rounded cursor-pointer"
              style={{ border: '1px solid var(--color-border)' }}
            />
            <input
              type="text"
              value={value}
              onChange={(e) => handleColorChange(key as keyof typeof theme.colors, e.target.value)}
              className="w-24 px-2 py-1 text-xs rounded font-mono"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium"
          style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
        >
          <Paintbrush className="w-4 h-4" />
          Applica
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Download className="w-4 h-4" />
          Esporta
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          Salva Tema Personalizzato
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            placeholder="Nome tema..."
            className="flex-1 px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded text-sm font-medium"
            style={{ backgroundColor: 'var(--color-secondary)', color: '#ffffff' }}
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
