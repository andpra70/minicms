import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Phone, MapPin, Plus, X, GripVertical } from 'lucide-react';
import { InlineEditor, InlineImageEditor, InlineImagePositionEditor } from './InlineEditor';
import { useAdmin } from '@/contexts/AdminContext';
import { geocodeAddress, loadLeaflet } from '@/app/lib/leaflet';
import { Calendar } from './ui/calendar';
import { parseCalendarInput } from '@/app/lib/calendar-highlights';

interface Section {
  type: string;
  [key: string]: any;
}

interface ContentRendererProps {
  sections: Section[];
  pageId: string;
}

function toAnchorSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getSectionAnchor(section: Section, sectionIndex: number) {
  const customAnchor = typeof section.anchorId === 'string' ? section.anchorId.trim() : '';
  if (customAnchor) {
    return toAnchorSlug(customAnchor);
  }
  const candidateTitle = typeof section.title === 'string' ? section.title : getSectionLabel(section.type);
  const base = toAnchorSlug(candidateTitle || section.type || 'section');
  return `sec-${base || 'section'}-${sectionIndex + 1}`;
}

export function ContentRenderer({ sections, pageId }: ContentRendererProps) {
  const { canEdit, content, updateContent } = useAdmin();
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLElement>, index: number) => {
    if (!canEdit) {
      return;
    }
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const readDraggedIndex = (e: React.DragEvent<HTMLElement>) => {
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) {
      return draggedSectionIndex;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? draggedSectionIndex : parsed;
  };

  const addSection = (sectionType: string) => {
    const newContent = JSON.parse(JSON.stringify(content));
    const page = newContent.pages?.[pageId];
    if (!page || !Array.isArray(page.sections)) {
      return;
    }

    page.sections.push(createSectionTemplate(sectionType));
    updateContent(newContent);
  };

  const removeSection = (sectionIndex: number) => {
    const confirmed = window.confirm('Vuoi eliminare questa sezione?');
    if (!confirmed) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const page = newContent.pages?.[pageId];
    if (!page || !Array.isArray(page.sections)) {
      return;
    }
    page.sections.splice(sectionIndex, 1);
    updateContent(newContent);
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const pageSections = newContent.pages?.[pageId]?.sections;
    if (!Array.isArray(pageSections)) {
      return;
    }
    const [moved] = pageSections.splice(fromIndex, 1);
    pageSections.splice(toIndex, 0, moved);
    updateContent(newContent);
  };

  return (
    <div className="space-y-16">
      {sections.map((section, index) => (
        <div
          key={index}
          id={getSectionAnchor(section, index)}
          data-page-id={pageId}
          data-section-index={index}
          className="relative"
          onDragOverCapture={(e) => {
            if (canEdit) e.preventDefault();
          }}
          onDropCapture={(e) => {
            if (!canEdit) {
              return;
            }
            e.preventDefault();
            const fromIndex = readDraggedIndex(e);
            if (fromIndex !== null) {
              moveSection(fromIndex, index);
              setDraggedSectionIndex(null);
            }
          }}
          style={{
            outline: canEdit && draggedSectionIndex === index ? '2px dashed var(--color-primary)' : undefined,
            borderRadius: 'var(--border-radius)',
            scrollMarginTop: '96px',
          }}
        >
          {canEdit && (
            <button
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={() => setDraggedSectionIndex(null)}
              className="absolute top-0 left-0 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              title="Trascina per riordinare sezione"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => removeSection(index)}
              className="absolute top-0 right-0 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              title="Elimina sezione"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <SectionRenderer section={section} pageId={pageId} sectionIndex={index} />
        </div>
      ))}
      {canEdit && (
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--border-radius)',
          }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Aggiungi una nuova sezione
          </p>
          <div className="flex flex-wrap gap-2">
            {['hero', 'content', 'features', 'services-list', 'blog-list', 'contact-info', 'place', 'calendar'].map((type) => (
              <button
                key={type}
                onClick={() => addSection(type)}
                className="px-3 py-2 rounded text-sm font-medium inline-flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <Plus className="w-4 h-4" />
                {getSectionLabel(type)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getSectionLabel(type: string) {
  const labels: Record<string, string> = {
    hero: 'Hero',
    content: 'Contenuto',
    features: 'Features',
    'services-list': 'Servizi',
    'blog-list': 'Blog',
    'contact-info': 'Contatti',
    place: 'Luogo',
    calendar: 'Calendario',
  };
  return labels[type] || type;
}

function createSectionTemplate(type: string) {
  const defaultImage = 'img/me.webp';
  switch (type) {
    case 'hero':
      return {
        type: 'hero',
        title: 'Nuovo titolo hero',
        subtitle: 'Nuovo sottotitolo',
        image: defaultImage,
        imagePosX: 50,
        imagePosY: 50,
        imageScale: 100,
        cta: {
          text: 'Scopri di più',
          link: '/about',
        },
      };
    case 'features':
      return {
        type: 'features',
        title: 'Nuove caratteristiche',
        items: [createItemTemplate('features')],
      };
    case 'services-list':
      return {
        type: 'services-list',
        items: [createItemTemplate('services-list')],
      };
    case 'blog-list':
      return {
        type: 'blog-list',
        items: [createItemTemplate('blog-list')],
      };
    case 'contact-info':
      return {
        type: 'contact-info',
        info: [createItemTemplate('contact-info')],
      };
    case 'place':
      return {
        type: 'place',
        title: 'Dove siamo',
        address: 'Piazza del Colosseo, Roma',
        description: 'Indicazioni e punto di riferimento.',
        geocodedAddress: '',
        lat: null,
        lng: null,
        zoom: 15,
      };
    case 'calendar':
      return {
        type: 'calendar',
        title: 'Calendario eventi',
        description: 'Date importanti in evidenza.',
        entries: '2026-03-20\n2026-03-24..2026-03-27\n2026-04-02',
        notes: 'Le date evidenziate indicano aperture speciali ed eventi.',
      };
    case 'content':
    default:
      return {
        type: 'content',
        title: 'Nuova sezione',
        content: 'Nuovo contenuto della sezione.',
        image: defaultImage,
        imagePosX: 50,
        imagePosY: 50,
        imageScale: 100,
        imagePlacementX: 'right',
        imagePlacementY: 'top',
      };
  }
}

function createItemTemplate(sectionType: string) {
  const defaultImage = 'img/me.webp';

  if (sectionType === 'features') {
    return {
      title: 'Nuova card',
      description: 'Descrizione della card',
      image: defaultImage,
      imagePosX: 50,
      imagePosY: 50,
      imageScale: 100,
    };
  }

  if (sectionType === 'services-list') {
    return {
      title: 'Nuovo servizio',
      description: 'Descrizione servizio',
      features: ['Feature 1', 'Feature 2'],
      image: defaultImage,
      imagePosX: 50,
      imagePosY: 50,
      imageScale: 100,
      imageHeight: 192,
    };
  }

  if (sectionType === 'blog-list') {
    return {
      id: String(Date.now()),
      title: 'Nuovo articolo',
      excerpt: 'Estratto articolo',
      date: new Date().toISOString().slice(0, 10),
      author: 'Autore',
      image: defaultImage,
      imagePosX: 50,
      imagePosY: 50,
      imageScale: 100,
    };
  }

  if (sectionType === 'contact-info') {
    return {
      label: 'Email',
      value: 'info@example.com',
    };
  }

  return {};
}

function SectionRenderer({ section, pageId, sectionIndex }: { section: Section; pageId: string; sectionIndex: number }) {
  switch (section.type) {
    case 'hero':
      return <HeroSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    case 'features':
      return <FeaturesSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    case 'content':
      return <ContentSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    case 'services-list':
      return <ServicesListSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    case 'blog-list':
      return <BlogListSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    case 'contact-info':
      return <ContactInfoSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    case 'place':
      return <PlaceSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    case 'calendar':
      return <CalendarSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    default:
      return null;
  }
}

function CalendarSection({ title, description, entries, notes, pageId, sectionIndex }: any) {
  const { canEdit } = useAdmin();
  const parsed = parseCalendarInput(entries);

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] items-start">
      <div className="space-y-4">
        <h2
          className="text-3xl font-bold"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-h2)',
            fontSize: 'var(--size-h2)',
          }}
        >
          <InlineEditor
            value={title}
            path={['pages', pageId, 'sections', sectionIndex, 'title']}
          />
        </h2>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body-copy)',
            fontSize: 'var(--size-body-copy)',
          }}
        >
          <InlineEditor
            value={description}
            type="textarea"
            path={['pages', pageId, 'sections', sectionIndex, 'description']}
          />
        </p>
        <div>
          <div
            className="mb-2 text-sm font-medium"
            style={{ color: 'var(--color-text)' }}
          >
            Date evidenziate
          </div>
          <InlineEditor
            value={entries}
            type="textarea"
            path={['pages', pageId, 'sections', sectionIndex, 'entries']}
          />
          {canEdit && (
            <div
              className="mt-2 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Usa una data per riga oppure separa con virgola o punto e virgola. Intervalli: `2026-03-24..2026-03-27`
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {parsed.entries.map((entry, index) => (
            <span
              key={`${entry.label}-${index}`}
              className="px-3 py-1.5 rounded-full text-sm"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
              }}
            >
              {entry.label}
            </span>
          ))}
        </div>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body-copy)',
            fontSize: 'var(--size-body-copy)',
          }}
        >
          <InlineEditor
            value={notes}
            type="textarea"
            path={['pages', pageId, 'sections', sectionIndex, 'notes']}
          />
        </p>
      </div>
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Calendar
          showOutsideDays
          modifiers={{ highlighted: parsed.modifiers }}
          modifiersClassNames={{
            highlighted: 'bg-primary text-primary-foreground rounded-md font-semibold',
          }}
          classNames={{
            day_today: 'bg-accent text-accent-foreground rounded-md',
          }}
        />
      </div>
    </div>
  );
}

function PlaceSection({
  title,
  address,
  description,
  lat,
  lng,
  zoom = 15,
  geocodedAddress,
  pageId,
  sectionIndex,
}: any) {
  const { content, updateContent } = useAdmin();
  const [runtimeCoords, setRuntimeCoords] = useState<{ lat: number; lng: number } | null>(
    typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null,
  );
  const [runtimeZoom, setRuntimeZoom] = useState<number>(Number.isFinite(Number(zoom)) ? Number(zoom) : 15);
  const [mapError, setMapError] = useState('');
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      setRuntimeCoords({ lat, lng });
    }
  }, [lat, lng]);

  useEffect(() => {
    const nextZoom = Number(zoom);
    if (Number.isFinite(nextZoom)) {
      setRuntimeZoom(nextZoom);
    }
  }, [zoom]);

  useEffect(() => {
    const trimmedAddress = String(address || '').trim();
    if (!trimmedAddress) {
      return;
    }

    const hasSavedCoords = typeof lat === 'number' && typeof lng === 'number';
    if (hasSavedCoords && geocodedAddress === trimmedAddress) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const coords = await geocodeAddress(trimmedAddress);
        if (cancelled) {
          return;
        }

        setRuntimeCoords(coords);
        setMapError('');

        const newContent = JSON.parse(JSON.stringify(content));
        const targetSection = newContent.pages?.[pageId]?.sections?.[sectionIndex];
        if (!targetSection) {
          return;
        }

        if (
          targetSection.lat === coords.lat &&
          targetSection.lng === coords.lng &&
          targetSection.geocodedAddress === trimmedAddress
        ) {
          return;
        }

        targetSection.lat = coords.lat;
        targetSection.lng = coords.lng;
        targetSection.geocodedAddress = trimmedAddress;
        updateContent(newContent);
      } catch (error) {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Errore mappa');
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [address, content, geocodedAddress, lat, lng, pageId, sectionIndex, updateContent]);

  useEffect(() => {
    if (!mapNodeRef.current || !runtimeCoords) {
      return;
    }

    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapNodeRef.current) {
          return;
        }

        if (!mapRef.current) {
          mapRef.current = L.map(mapNodeRef.current, {
            scrollWheelZoom: true,
          }).setView([runtimeCoords.lat, runtimeCoords.lng], runtimeZoom);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(mapRef.current);

          markerRef.current = L.marker([runtimeCoords.lat, runtimeCoords.lng]).addTo(mapRef.current);

          mapRef.current.on('zoomend', () => {
            if (!mapRef.current) {
              return;
            }

            const nextZoom = mapRef.current.getZoom();
            setRuntimeZoom(nextZoom);

            const newContent = JSON.parse(JSON.stringify(contentRef.current));
            const targetSection = newContent.pages?.[pageId]?.sections?.[sectionIndex];
            if (!targetSection || targetSection.zoom === nextZoom) {
              return;
            }
            targetSection.zoom = nextZoom;
            updateContent(newContent);
          });
        } else {
          mapRef.current.setView([runtimeCoords.lat, runtimeCoords.lng], runtimeZoom);
          if (markerRef.current) {
            markerRef.current.setLatLng([runtimeCoords.lat, runtimeCoords.lng]);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Errore caricamento mappa');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageId, runtimeCoords, runtimeZoom, sectionIndex, updateContent]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] items-start">
      <div className="space-y-4">
        <h2
          className="text-3xl font-bold"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-h2)',
            fontSize: 'var(--size-h2)',
          }}
        >
          <InlineEditor
            value={title}
            path={['pages', pageId, 'sections', sectionIndex, 'title']}
          />
        </h2>
        <div
          className="inline-flex items-start gap-3 rounded-lg px-4 py-3"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <div
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body-copy)',
              fontSize: 'var(--size-body-copy)',
            }}
          >
            <InlineEditor
              value={address}
              type="textarea"
              path={['pages', pageId, 'sections', sectionIndex, 'address']}
            />
          </div>
        </div>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body-copy)',
            fontSize: 'var(--size-body-copy)',
          }}
        >
          <InlineEditor
            value={description}
            type="textarea"
            path={['pages', pageId, 'sections', sectionIndex, 'description']}
          />
        </p>
        {mapError && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: '#fee',
              color: '#b42318',
              border: '1px solid #fda29b',
            }}
          >
            {mapError}
          </div>
        )}
      </div>
      <div
        className="overflow-hidden rounded-lg"
        style={{
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          minHeight: '360px',
          position: 'relative',
          zIndex: 0,
        }}
      >
        {runtimeCoords ? (
          <div ref={mapNodeRef} style={{ height: '360px', width: '100%' }} />
        ) : (
          <div
            className="flex h-[360px] items-center justify-center px-6 text-center"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Inserisci un indirizzo valido per visualizzare la mappa.
          </div>
        )}
      </div>
    </div>
  );
}

function HeroSection({ title, subtitle, image, imagePosX = 50, imagePosY = 50, imageScale = 100, cta, pageId, sectionIndex }: any) {
  return (
    <div className="text-center py-20">
      {image && (
        <div className="mb-8 max-w-4xl mx-auto">
          <InlineImagePositionEditor
            src={image}
            alt={title}
            path={['pages', pageId, 'sections', sectionIndex, 'image']}
            posXPath={['pages', pageId, 'sections', sectionIndex, 'imagePosX']}
            posYPath={['pages', pageId, 'sections', sectionIndex, 'imagePosY']}
            scalePath={['pages', pageId, 'sections', sectionIndex, 'imageScale']}
            posX={imagePosX}
            posY={imagePosY}
            scale={imageScale}
            className="w-full h-64 object-cover rounded-lg"
            style={{ borderRadius: 'var(--border-radius)' }}
          />
        </div>
      )}
      <h1 
        className="text-5xl md:text-6xl font-bold mb-6"
        style={{ 
          color: 'var(--color-text)',
          fontFamily: 'var(--font-h1)',
          fontSize: 'var(--size-h1)',
        }}
      >
        <InlineEditor
          value={title}
          path={['pages', pageId, 'sections', sectionIndex, 'title']}
        />
      </h1>
      <p 
        className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body-copy)',
          fontSize: 'var(--size-body-copy)',
        }}
      >
        <InlineEditor
          value={subtitle}
          type="textarea"
          path={['pages', pageId, 'sections', sectionIndex, 'subtitle']}
        />
      </p>
      {cta && (
        <Link
          to={cta.link}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold transition-transform hover:scale-105"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            borderRadius: 'var(--border-radius)'
          }}
        >
          {cta.text}
          <ArrowRight className="w-5 h-5" />
        </Link>
      )}
    </div>
  );
}

function FeaturesSection({ title, items, pageId, sectionIndex }: any) {
  const { canEdit, content, updateContent } = useAdmin();

  const handleAddCard = () => {
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items;
    if (!Array.isArray(targetItems)) {
      return;
    }
    targetItems.push(createItemTemplate('features'));
    updateContent(newContent);
  };

  const handleDeleteCard = (itemIndex: number) => {
    const confirmed = window.confirm('Vuoi eliminare questa card?');
    if (!confirmed) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items;
    if (!Array.isArray(targetItems)) {
      return;
    }
    targetItems.splice(itemIndex, 1);
    updateContent(newContent);
  };

  return (
    <div>
      <h2 
        className="text-3xl md:text-4xl font-bold text-center mb-12"
        style={{ 
          color: 'var(--color-text)',
          fontFamily: 'var(--font-h2)',
          fontSize: 'var(--size-h2)',
        }}
      >
        <InlineEditor
          value={title}
          path={['pages', pageId, 'sections', sectionIndex, 'title']}
        />
      </h2>
      <div className="grid md:grid-cols-3 gap-8">
        {items.map((item: any, index: number) => (
          <div
            key={index}
            className="p-6 rounded-lg overflow-hidden relative"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius)'
            }}
          >
            {canEdit && (
              <button
                onClick={() => handleDeleteCard(index)}
                className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                title="Elimina card"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {item.image && (
              <div className="mb-4 -mx-6 -mt-6">
                <InlineImagePositionEditor
                  src={item.image}
                  alt={item.title}
                  path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'image']}
                  posXPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosX']}
                  posYPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosY']}
                  scalePath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageScale']}
                  posX={item.imagePosX}
                  posY={item.imagePosY}
                  scale={item.imageScale ?? 100}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}
            <h3 
              className="text-xl font-bold mb-3"
              style={{
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-h3)',
                fontSize: 'var(--size-h3)',
              }}
            >
              <InlineEditor
                value={item.title}
                path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'title']}
              />
            </h3>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body-copy)',
                fontSize: 'var(--size-body-copy)',
              }}
            >
              <InlineEditor
                value={item.description}
                type="textarea"
                path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'description']}
              />
            </p>
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="mt-4">
          <button
            onClick={handleAddCard}
            className="px-3 py-2 rounded text-sm font-medium inline-flex items-center gap-2"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
            }}
          >
            <Plus className="w-4 h-4" />
            Aggiungi card
          </button>
        </div>
      )}
    </div>
  );
}

function ContentSection({
  title,
  content,
  image,
  imagePosX = 50,
  imagePosY = 50,
  imageScale = 100,
  imagePlacement,
  imagePlacementX = 'right',
  imagePlacementY = 'top',
  pageId,
  sectionIndex
}: any) {
  const { canEdit, content: siteContent, updateContent } = useAdmin();
  // Compatibilità con vecchio campo singolo imagePlacement
  const fallbackX = imagePlacement === 'left' || imagePlacement === 'right' ? imagePlacement : 'right';
  const fallbackY = imagePlacement === 'top' || imagePlacement === 'bottom' ? imagePlacement : 'top';
  const placementX = imagePlacementX === 'left' || imagePlacementX === 'right' ? imagePlacementX : fallbackX;
  const placementY = imagePlacementY === 'top' || imagePlacementY === 'bottom' ? imagePlacementY : fallbackY;

  const updatePlacementX = (value: 'left' | 'right') => {
    const newContent = JSON.parse(JSON.stringify(siteContent));
    const targetSection = newContent.pages?.[pageId]?.sections?.[sectionIndex];
    if (!targetSection) {
      return;
    }
    targetSection.imagePlacementX = value;
    updateContent(newContent);
  };

  const updatePlacementY = (value: 'top' | 'bottom') => {
    const newContent = JSON.parse(JSON.stringify(siteContent));
    const targetSection = newContent.pages?.[pageId]?.sections?.[sectionIndex];
    if (!targetSection) {
      return;
    }
    targetSection.imagePlacementY = value;
    updateContent(newContent);
  };

  const textBlock = (
    <div>
      <h2 
        className="text-3xl font-bold mb-6"
        style={{ 
          color: 'var(--color-text)',
          fontFamily: 'var(--font-h2)',
          fontSize: 'var(--size-h2)',
        }}
      >
        <InlineEditor
          value={title}
          path={['pages', pageId, 'sections', sectionIndex, 'title']}
        />
      </h2>
      <p 
        className="text-lg leading-relaxed"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body-copy)',
          fontSize: 'var(--size-body-copy)',
        }}
      >
        <InlineEditor
          value={content}
          type="textarea"
          path={['pages', pageId, 'sections', sectionIndex, 'content']}
        />
      </p>
    </div>
  );

  const imageBlock = image ? (
    <div className="relative">
      {canEdit && (
        <div
          className="absolute top-2 left-2 z-30 space-y-2 p-2 rounded"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-surface) 88%, transparent)',
            border: '1px solid var(--color-border)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Verticale</span>
            <button
              onClick={() => updatePlacementY('top')}
              className="px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: placementY === 'top' ? 'var(--color-primary)' : 'var(--color-background)',
                color: placementY === 'top' ? '#ffffff' : 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              Top
            </button>
            <button
              onClick={() => updatePlacementY('bottom')}
              className="px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: placementY === 'bottom' ? 'var(--color-primary)' : 'var(--color-background)',
                color: placementY === 'bottom' ? '#ffffff' : 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              Bottom
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Orizzontale</span>
            <button
              onClick={() => updatePlacementX('left')}
              className="px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: placementX === 'left' ? 'var(--color-primary)' : 'var(--color-background)',
                color: placementX === 'left' ? '#ffffff' : 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              Left
            </button>
            <button
              onClick={() => updatePlacementX('right')}
              className="px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: placementX === 'right' ? 'var(--color-primary)' : 'var(--color-background)',
                color: placementX === 'right' ? '#ffffff' : 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              Right
            </button>
          </div>
        </div>
      )}
      <InlineImagePositionEditor
        src={image}
        alt={title}
        path={['pages', pageId, 'sections', sectionIndex, 'image']}
        posXPath={['pages', pageId, 'sections', sectionIndex, 'imagePosX']}
        posYPath={['pages', pageId, 'sections', sectionIndex, 'imagePosY']}
        scalePath={['pages', pageId, 'sections', sectionIndex, 'imageScale']}
        posX={imagePosX}
        posY={imagePosY}
        scale={imageScale}
        className="w-full h-64 object-cover rounded-lg"
        style={{ borderRadius: 'var(--border-radius)' }}
      />
    </div>
  ) : null;

  const imageOrderMobile = placementY === 'top' ? 'order-1' : 'order-2';
  const textOrderMobile = placementY === 'top' ? 'order-2' : 'order-1';
  const imageOrderDesktop = placementX === 'left' ? 'md:order-1' : 'md:order-2';
  const textOrderDesktop = placementX === 'left' ? 'md:order-2' : 'md:order-1';
  const imageVerticalAlign = placementY === 'top' ? 'md:self-start' : 'md:self-end';

  return (
    <div className={`max-w-3xl ${image ? 'md:max-w-5xl' : ''}`}>
      <div className={image ? 'grid md:grid-cols-2 gap-8 items-start' : ''}>
        {image && (
          <div className={`${imageOrderMobile} ${imageOrderDesktop} ${imageVerticalAlign}`}>
            {imageBlock}
          </div>
        )}
        <div className={`${textOrderMobile} ${textOrderDesktop}`}>
          {textBlock}
        </div>
      </div>
    </div>
  );
}

function ServicesListSection({ items, pageId, sectionIndex }: any) {
  const { canEdit, content, updateContent } = useAdmin();
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const MIN_IMAGE_HEIGHT = 50;
  const MAX_IMAGE_HEIGHT = 500;

  const handleAddCard = () => {
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items;
    if (!Array.isArray(targetItems)) {
      return;
    }
    targetItems.push(createItemTemplate('services-list'));
    updateContent(newContent);
  };

  const handleDeleteCard = (itemIndex: number) => {
    const confirmed = window.confirm('Vuoi eliminare questa card servizio?');
    if (!confirmed) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items;
    if (!Array.isArray(targetItems)) {
      return;
    }
    targetItems.splice(itemIndex, 1);
    updateContent(newContent);
  };

  const handleMoveCard = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items;
    if (!Array.isArray(targetItems)) {
      return;
    }
    const [moved] = targetItems.splice(fromIndex, 1);
    targetItems.splice(toIndex, 0, moved);
    updateContent(newContent);
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, index: number) => {
    if (!canEdit) {
      return;
    }
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const readDraggedIndex = (e: React.DragEvent<HTMLElement>) => {
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) {
      return draggedItemIndex;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? draggedItemIndex : parsed;
  };

  const getImageHeight = (raw: any) => {
    const value = Number(raw);
    if (Number.isNaN(value)) {
      return 192;
    }
    return Math.max(MIN_IMAGE_HEIGHT, Math.min(MAX_IMAGE_HEIGHT, value));
  };

  const updateImageHeight = (itemIndex: number, value: number) => {
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItem = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items?.[itemIndex];
    if (!targetItem) {
      return;
    }
    targetItem.imageHeight = getImageHeight(value);
    updateContent(newContent);
  };

  return (
    <div className="space-y-8">
      {items.map((item: any, index: number) => (
        <div
          key={index}
          className="rounded-lg overflow-hidden relative"
          onDragOverCapture={(e) => {
            if (canEdit) e.preventDefault();
          }}
          onDropCapture={(e) => {
            if (!canEdit) {
              return;
            }
            e.preventDefault();
            const fromIndex = readDraggedIndex(e);
            if (fromIndex !== null) {
              handleMoveCard(fromIndex, index);
              setDraggedItemIndex(null);
            }
          }}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius)',
            outline: canEdit && draggedItemIndex === index ? '2px dashed var(--color-primary)' : undefined,
          }}
        >
          {canEdit && (
            <button
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={() => setDraggedItemIndex(null)}
              className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              title="Trascina per riordinare card servizio"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => handleDeleteCard(index)}
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
              title="Elimina card"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {item.image && (
            <div className="w-full">
              <InlineImagePositionEditor
                src={item.image}
                alt={item.title}
                path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'image']}
                posXPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosX']}
                posYPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosY']}
                scalePath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageScale']}
                posX={item.imagePosX}
                posY={item.imagePosY}
                scale={item.imageScale ?? 100}
                className="w-full object-cover"
                style={{ height: `${getImageHeight(item.imageHeight)}px` }}
              />
            </div>
          )}
          {canEdit && (
            <div
              className="px-8 pt-4 pb-0"
              style={{ borderTop: item.image ? '1px solid var(--color-border)' : 'none' }}
            >
              <div className="flex items-center gap-3">
                <label
                  className="text-sm whitespace-nowrap"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Altezza immagine
                </label>
                <input
                  type="range"
                  min={MIN_IMAGE_HEIGHT}
                  max={MAX_IMAGE_HEIGHT}
                  value={getImageHeight(item.imageHeight)}
                  onChange={(e) => updateImageHeight(index, Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={MIN_IMAGE_HEIGHT}
                  max={MAX_IMAGE_HEIGHT}
                  value={getImageHeight(item.imageHeight)}
                  onChange={(e) => updateImageHeight(index, Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded text-sm"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>px</span>
              </div>
            </div>
          )}
          <div className="p-8">
            <h3 
              className="text-2xl font-bold mb-4"
              style={{ 
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-h3)',
                fontSize: 'var(--size-h3)',
              }}
            >
              <InlineEditor
                value={item.title}
                path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'title']}
              />
            </h3>
            <p 
              className="text-lg mb-4"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body-copy)',
                fontSize: 'var(--size-body-copy)',
              }}
            >
              <InlineEditor
                value={item.description}
                type="textarea"
                path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'description']}
              />
            </p>
            <div className="flex flex-wrap gap-2">
              {item.features.map((feature: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1 text-sm rounded-full"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-primary)',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
      {canEdit && (
        <button
          onClick={handleAddCard}
          className="px-3 py-2 rounded text-sm font-medium inline-flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
          }}
        >
          <Plus className="w-4 h-4" />
          Aggiungi card servizio
        </button>
      )}
    </div>
  );
}

function BlogListSection({ items, pageId, sectionIndex }: any) {
  const { canEdit, content, updateContent } = useAdmin();
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const handleAddCard = () => {
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items;
    if (!Array.isArray(targetItems)) {
      return;
    }
    targetItems.push(createItemTemplate('blog-list'));
    updateContent(newContent);
  };

  const handleDeleteCard = (itemIndex: number) => {
    const confirmed = window.confirm('Vuoi eliminare questa card blog?');
    if (!confirmed) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items;
    if (!Array.isArray(targetItems)) {
      return;
    }
    targetItems.splice(itemIndex, 1);
    updateContent(newContent);
  };

  const handleMoveCard = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.items;
    if (!Array.isArray(targetItems)) {
      return;
    }
    const [moved] = targetItems.splice(fromIndex, 1);
    targetItems.splice(toIndex, 0, moved);
    updateContent(newContent);
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, index: number) => {
    if (!canEdit) {
      return;
    }
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const readDraggedIndex = (e: React.DragEvent<HTMLElement>) => {
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) {
      return draggedItemIndex;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? draggedItemIndex : parsed;
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item: any, index: number) => (
          <article
            key={item.id || `blog-${index}`}
            className="rounded-lg hover:shadow-lg transition-shadow overflow-hidden relative"
            onDragOverCapture={(e) => {
              if (canEdit) e.preventDefault();
            }}
            onDropCapture={(e) => {
              if (!canEdit) {
                return;
              }
              e.preventDefault();
              const fromIndex = readDraggedIndex(e);
              if (fromIndex !== null) {
                handleMoveCard(fromIndex, index);
                setDraggedItemIndex(null);
              }
            }}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius)',
              outline: canEdit && draggedItemIndex === index ? '2px dashed var(--color-primary)' : undefined,
            }}
          >
            {canEdit && (
              <button
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={() => setDraggedItemIndex(null)}
                className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center cursor-grab active:cursor-grabbing"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                title="Trascina per riordinare card blog"
              >
                <GripVertical className="w-4 h-4" />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => handleDeleteCard(index)}
                className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
                title="Elimina card"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {item.image && (
              <div className="w-full">
                <InlineImagePositionEditor
                  src={item.image}
                  alt={item.title}
                  path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'image']}
                  posXPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosX']}
                  posYPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosY']}
                  scalePath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageScale']}
                  posX={item.imagePosX}
                  posY={item.imagePosY}
                  scale={item.imageScale ?? 100}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}
            <div className="p-6">
              <h3 
                className="text-xl font-bold mb-2"
                style={{ 
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-h3)',
                  fontSize: 'var(--size-h3)',
                }}
              >
                <InlineEditor
                  value={item.title}
                  path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'title']}
                />
              </h3>
              <p 
                className="mb-4"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body-copy)',
                  fontSize: 'var(--size-body-copy)',
                }}
              >
                <InlineEditor
                  value={item.excerpt}
                  type="textarea"
                  path={['pages', pageId, 'sections', sectionIndex, 'items', index, 'excerpt']}
                />
              </p>
              <div 
                className="flex items-center justify-between text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span>{item.author}</span>
                <span>{new Date(item.date).toLocaleDateString('it-IT')}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      {canEdit && (
        <button
          onClick={handleAddCard}
          className="px-3 py-2 rounded text-sm font-medium inline-flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
          }}
        >
          <Plus className="w-4 h-4" />
          Aggiungi card blog
        </button>
      )}
    </div>
  );
}

function ContactInfoSection({ info, pageId, sectionIndex }: any) {
  const { canEdit, content, updateContent } = useAdmin();
  const [draggedInfoIndex, setDraggedInfoIndex] = useState<number | null>(null);
  const icons: { [key: string]: any } = {
    Email: Mail,
    Telefono: Phone,
    Indirizzo: MapPin,
  };

  const handleAddCard = () => {
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.info;
    if (!Array.isArray(targetItems)) {
      return;
    }
    targetItems.push(createItemTemplate('contact-info'));
    updateContent(newContent);
  };

  const handleDeleteCard = (itemIndex: number) => {
    const confirmed = window.confirm('Vuoi eliminare questo contatto?');
    if (!confirmed) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.info;
    if (!Array.isArray(targetItems)) {
      return;
    }
    targetItems.splice(itemIndex, 1);
    updateContent(newContent);
  };

  const handleMoveCard = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const targetItems = newContent.pages?.[pageId]?.sections?.[sectionIndex]?.info;
    if (!Array.isArray(targetItems)) {
      return;
    }
    const [moved] = targetItems.splice(fromIndex, 1);
    targetItems.splice(toIndex, 0, moved);
    updateContent(newContent);
  };

  const handleDragStart = (e: React.DragEvent<HTMLElement>, index: number) => {
    if (!canEdit) {
      return;
    }
    setDraggedInfoIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const readDraggedIndex = (e: React.DragEvent<HTMLElement>) => {
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) {
      return draggedInfoIndex;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? draggedInfoIndex : parsed;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        {info.map((item: any, index: number) => {
          const Icon = icons[item.label] || Mail;
          return (
            <div
              key={index}
              className="flex items-center gap-4 p-6 rounded-lg relative"
              onDragOverCapture={(e) => {
                if (canEdit) e.preventDefault();
              }}
              onDropCapture={(e) => {
                if (!canEdit) {
                  return;
                }
                e.preventDefault();
                const fromIndex = readDraggedIndex(e);
                if (fromIndex !== null) {
                  handleMoveCard(fromIndex, index);
                  setDraggedInfoIndex(null);
                }
              }}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius)',
                outline: canEdit && draggedInfoIndex === index ? '2px dashed var(--color-primary)' : undefined,
              }}
            >
              {canEdit && (
                <button
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={() => setDraggedInfoIndex(null)}
                  className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center cursor-grab active:cursor-grabbing"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                  title="Trascina per riordinare contatto"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => handleDeleteCard(index)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full inline-flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                  title="Elimina contatto"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div 
                className="p-3 rounded-full"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Icon className="w-6 h-6" style={{ color: '#ffffff' }} />
              </div>
              <div>
                <div 
                  className="text-sm font-semibold mb-1"
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-nav)',
                    fontSize: 'var(--size-nav)',
                  }}
                >
                  {item.label}
                </div>
                <div 
                  className="text-lg"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body-copy)',
                    fontSize: 'var(--size-body-copy)',
                  }}
                >
                  <InlineEditor
                    value={item.value}
                    path={['pages', pageId, 'sections', sectionIndex, 'info', index, 'value']}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {canEdit && (
        <div className="mt-4">
          <button
            onClick={handleAddCard}
            className="px-3 py-2 rounded text-sm font-medium inline-flex items-center gap-2"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
            }}
          >
            <Plus className="w-4 h-4" />
            Aggiungi contatto
          </button>
        </div>
      )}
    </div>
  );
}
