import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Phone, MapPin, Plus, X, GripVertical } from 'lucide-react';
import { InlineEditor, InlineImageEditor, InlineImagePositionEditor, renderMarkdownText } from './InlineEditor';
import { useAdmin } from '@/contexts/AdminContext';
import { geocodeAddress, loadLeaflet } from '@/app/lib/leaflet';
import { Calendar } from './ui/calendar';
import { parseCalendarInput } from '@/app/lib/calendar-highlights';
import { buildYouTubeEmbedUrl } from '@/app/lib/youtube';
import { compareAsc, format, isValid, parseISO } from 'date-fns';

interface Section {
  type: string;
  [key: string]: any;
}

interface ContentRendererProps {
  sections: Section[];
  pageId: string;
}

type SiteEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  body: string;
};

function normalizeEventDate(value: string) {
  const parsed = parseISO(String(value || '').trim());
  if (!isValid(parsed)) {
    return '';
  }
  return format(parsed, 'yyyy-MM-dd');
}

function normalizeEventTime(value: string) {
  const trimmed = String(value || '').trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return '09:00';
  }
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function compareEvents(a: SiteEvent, b: SiteEvent) {
  return compareAsc(parseISO(`${a.date}T${a.time}:00`), parseISO(`${b.date}T${b.time}:00`));
}

function getSiteEventsSorted(events: any[]): SiteEvent[] {
  return (Array.isArray(events) ? events : [])
    .map((event) => ({
      id: String(event?.id || `event-${Date.now()}`),
      title: String(event?.title || 'Nuovo evento'),
      date: normalizeEventDate(event?.date || '') || format(new Date(), 'yyyy-MM-dd'),
      time: normalizeEventTime(event?.time || '09:00'),
      body: String(event?.body || ''),
    }))
    .sort(compareEvents);
}

function groupEventsByDate(events: SiteEvent[]) {
  return events.reduce<Record<string, SiteEvent[]>>((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {});
}

function createSiteEvent(date: string): SiteEvent {
  return {
    id: `event-${Date.now()}`,
    title: 'Nuovo evento',
    date,
    time: '09:00',
    body: 'Corpo evento in markdown.',
  };
}

function formatEventDateLabel(date: string) {
  const parsed = parseISO(date);
  return isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : date;
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
  const [dropIndicator, setDropIndicator] = useState<{ index: number; position: 'before' | 'after' } | null>(null);

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

  const moveSection = (fromIndex: number, toIndex: number, position: 'before' | 'after') => {
    if (fromIndex === toIndex && position === 'before') {
      return;
    }
    const newContent = JSON.parse(JSON.stringify(content));
    const pageSections = newContent.pages?.[pageId]?.sections;
    if (!Array.isArray(pageSections)) {
      return;
    }
    const [moved] = pageSections.splice(fromIndex, 1);
    const targetIndex = position === 'after' ? toIndex + 1 : toIndex;
    const adjustedIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    pageSections.splice(adjustedIndex, 0, moved);
    updateContent(newContent);
  };

  return (
    <div className="cms-section-stack">
      {sections.map((section, index) => (
        <div
          key={index}
          id={getSectionAnchor(section, index)}
          data-page-id={pageId}
          data-section-index={index}
          className="relative"
          onDragOverCapture={(e) => {
            if (!canEdit) {
              return;
            }
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const position = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
            setDropIndicator({ index, position });
          }}
          onDropCapture={(e) => {
            if (!canEdit) {
              return;
            }
            e.preventDefault();
            const fromIndex = readDraggedIndex(e);
            if (fromIndex !== null) {
              const rect = e.currentTarget.getBoundingClientRect();
              const position = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
              moveSection(fromIndex, index, position);
              setDraggedSectionIndex(null);
              setDropIndicator(null);
            }
          }}
          onDragLeaveCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDropIndicator((current) => (current?.index === index ? null : current));
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
          {dropIndicator?.index === index && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{
                [dropIndicator.position === 'before' ? 'top' : 'bottom']: '-8px',
                height: '4px',
                backgroundColor: 'var(--color-primary)',
                borderRadius: '999px',
                boxShadow: '0 0 0 2px var(--color-background)',
              }}
            />
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
            {['hero', 'content', 'features', 'services-list', 'blog-list', 'contact-info', 'place', 'calendar', 'events-list', 'youtube'].map((type) => (
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
    'events-list': 'Lista eventi',
    youtube: 'YouTube',
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
        imageHeight: 256,
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
    case 'events-list':
      return {
        type: 'events-list',
        title: 'Lista eventi',
        description: 'Indice per data e dettaglio degli eventi del giorno selezionato.',
        indexTitle: 'Indice date',
      };
    case 'youtube':
      return {
        type: 'youtube',
        title: 'Video YouTube',
        description: 'Presentazione video incorporata.',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      };
    case 'content':
    default:
      return {
        type: 'content',
        title: 'Nuova sezione',
        content: 'Nuovo contenuto della sezione.',
        image: defaultImage,
        imageHeight: 256,
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
      imageHeight: 192,
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
      imageHeight: 192,
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
    case 'events-list':
      return <EventsListSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    case 'youtube':
      return <YouTubeSection {...section} pageId={pageId} sectionIndex={sectionIndex} />;
    default:
      return null;
  }
}

function YouTubeSection({ title, description, videoUrl, pageId, sectionIndex }: any) {
  const { canEdit } = useAdmin();
  const embedUrl = buildYouTubeEmbedUrl(videoUrl);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
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
          <div className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            URL o ID YouTube
          </div>
          <InlineEditor
            value={videoUrl}
            path={['pages', pageId, 'sections', sectionIndex, 'videoUrl']}
          />
          {canEdit && (
            <div className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Supporta URL `youtube.com`, `youtu.be`, `shorts` oppure ID diretto del video.
            </div>
          )}
        </div>
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        {embedUrl ? (
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <iframe
              src={embedUrl}
              title={title || 'Video YouTube'}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="px-6 py-12 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Inserisci un URL o ID YouTube valido per mostrare il video.
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarSection({ title, description, entries, notes, pageId, sectionIndex }: any) {
  const { canEdit, site, updateSite } = useAdmin();
  const parsed = parseCalendarInput(entries);
  const events = getSiteEventsSorted(site?.events || []);
  const eventsByDate = groupEventsByDate(events);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => {
    const firstEventDate = events[0]?.date;
    const firstParsedDate = parsed.entries[0]?.type === 'single' ? format(parsed.entries[0].date, 'yyyy-MM-dd') : undefined;
    return firstEventDate || firstParsedDate || format(new Date(), 'yyyy-MM-dd');
  });

  useEffect(() => {
    if (eventsByDate[selectedDateKey]) {
      return;
    }
    const firstEventDate = Object.keys(eventsByDate)[0];
    if (firstEventDate) {
      setSelectedDateKey(firstEventDate);
    }
  }, [eventsByDate, selectedDateKey]);

  const patchEvents = (nextEvents: SiteEvent[]) => {
    updateSite((prevSite: any) => ({
      ...(prevSite || {}),
      events: [...nextEvents].sort(compareEvents),
    }));
  };

  const handleAddEvent = (date: string) => {
    const normalizedDate = normalizeEventDate(date);
    if (!normalizedDate) {
      return;
    }
    patchEvents([...events, createSiteEvent(normalizedDate)]);
    setSelectedDateKey(normalizedDate);
  };

  const dayEventCounts = Object.entries(eventsByDate).reduce<Record<string, number>>((acc, [date, dayEvents]) => {
    acc[date] = dayEvents.length;
    return acc;
  }, {});

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.9fr)] items-start">
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
            Date evidenziate manualmente
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
        {canEdit && (
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Click su un giorno del calendario per creare un nuovo evento in quella data. L'editor completo è nel content type `Lista eventi`.
          </div>
        )}
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
        className="rounded-lg p-3"
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
            month: 'flex w-full flex-col gap-2',
            caption_label: 'text-xs font-semibold',
            head_cell: 'text-muted-foreground rounded-md flex-1 font-normal text-[0.7rem]',
            row: 'flex w-full mt-1',
            day: 'h-10 w-full rounded-md p-0 text-sm font-normal aria-selected:opacity-100',
            day_today: 'bg-accent text-accent-foreground rounded-md',
          }}
          onDayClick={(day) => {
            const key = format(day, 'yyyy-MM-dd');
            setSelectedDateKey(key);
            if (canEdit) {
              handleAddEvent(key);
            }
          }}
          components={{
            DayContent: ({ date }: any) => {
              const dateKey = format(date, 'yyyy-MM-dd');
              const count = dayEventCounts[dateKey] || 0;
              return (
                <div className="relative flex h-full w-full flex-col items-center justify-center">
                  <span>{format(date, 'd')}</span>
                  {count > 0 && (
                    <span
                      className="absolute bottom-0.5 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: '#ffffff',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </div>
              );
            },
          }}
          className="mx-auto max-w-sm"
        />
        <div className="mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Eventi creati: {events.length}
        </div>
      </div>
    </div>
  );
}

function EventsListSection({ title, description, indexTitle = 'Indice date', pageId, sectionIndex }: any) {
  const { canEdit, site, updateSite } = useAdmin();
  const events = getSiteEventsSorted(site?.events || []);
  const eventsByDate = groupEventsByDate(events);
  const orderedDates = Object.keys(eventsByDate).sort();
  const [selectedDateKey, setSelectedDateKey] = useState<string>(orderedDates[0] || '');

  useEffect(() => {
    if (orderedDates.length === 0) {
      if (selectedDateKey !== '') {
        setSelectedDateKey('');
      }
      return;
    }
    if (!selectedDateKey || !eventsByDate[selectedDateKey]) {
      setSelectedDateKey(orderedDates[0]);
    }
  }, [orderedDates, selectedDateKey, eventsByDate]);

  const selectedEvents = selectedDateKey ? eventsByDate[selectedDateKey] || [] : [];

  const patchEvents = (nextEvents: SiteEvent[]) => {
    updateSite((prevSite: any) => ({
      ...(prevSite || {}),
      events: [...nextEvents].sort(compareEvents),
    }));
  };

  const updateEvent = (eventId: string, patch: Partial<SiteEvent>) => {
    patchEvents(
      events.map((event) => {
        if (event.id !== eventId) {
          return event;
        }
        return {
          ...event,
          ...patch,
          date: normalizeEventDate(patch.date ?? event.date) || event.date,
          time: normalizeEventTime(patch.time ?? event.time),
        };
      }),
    );
  };

  const deleteEvent = (eventId: string) => {
    patchEvents(events.filter((event) => event.id !== eventId));
  };

  return (
    <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] items-start">
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
        <div
          className="rounded-lg p-3"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            <InlineEditor
              value={indexTitle}
              path={['pages', pageId, 'sections', sectionIndex, 'indexTitle']}
            />
          </div>
          <div
            className="mb-4 rounded-lg p-2"
            style={{
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
            }}
          >
            <Calendar
              showOutsideDays
              month={selectedDateKey ? parseISO(selectedDateKey) : undefined}
              selected={selectedDateKey ? parseISO(selectedDateKey) : undefined}
              onDayClick={(day) => setSelectedDateKey(format(day, 'yyyy-MM-dd'))}
              classNames={{
                month: 'flex w-full flex-col gap-2',
                caption_label: 'text-xs font-semibold',
                head_cell: 'text-muted-foreground rounded-md flex-1 font-normal text-[0.65rem]',
                row: 'flex w-full mt-1',
                day: 'h-9 w-full rounded-md p-0 text-xs font-normal aria-selected:opacity-100',
                day_today: 'bg-accent text-accent-foreground rounded-md',
                day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md',
              }}
              components={{
                DayContent: ({ date }: any) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const count = eventsByDate[dateKey]?.length || 0;
                  return (
                    <div className="relative flex h-full w-full flex-col items-center justify-center">
                      <span>{format(date, 'd')}</span>
                      {count > 0 && (
                        <span
                          className="absolute bottom-0.5 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] leading-none"
                          style={{
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  );
                },
              }}
              className="mx-auto max-w-[240px]"
            />
          </div>
          <div className="space-y-2">
            {orderedDates.map((dateKey) => (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDateKey(dateKey)}
                className="w-full rounded px-3 py-2 text-left text-sm"
                style={{
                  backgroundColor: selectedDateKey === dateKey ? 'var(--color-primary)' : 'var(--color-background)',
                  color: selectedDateKey === dateKey ? '#ffffff' : 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {formatEventDateLabel(dateKey)}
              </button>
            ))}
            {orderedDates.length === 0 && (
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Nessun evento disponibile.
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="mb-4 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          {selectedDateKey ? formatEventDateLabel(selectedDateKey) : 'Nessuna data selezionata'}
        </div>
        <div className="space-y-4">
          {selectedEvents.map((event) => (
            <article
              key={event.id}
              className="rounded-lg p-4"
              style={{
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                {canEdit ? (
                  <>
                    <input
                      type="text"
                      value={event.title}
                      onChange={(e) => updateEvent(event.id, { title: e.target.value })}
                      className="w-full rounded px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => deleteEvent(event.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded"
                      style={{
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                      }}
                      title="Elimina evento"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <h3
                      className="text-xl font-bold"
                      style={{
                        color: 'var(--color-text)',
                        fontFamily: 'var(--font-h3)',
                        fontSize: 'var(--size-h3)',
                      }}
                    >
                      {event.title}
                    </h3>
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {event.time}
                    </span>
                  </>
                )}
              </div>
              {canEdit && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <input
                    type="date"
                    value={event.date}
                    onChange={(e) => {
                      const nextDate = normalizeEventDate(e.target.value);
                      if (nextDate) {
                        updateEvent(event.id, { date: nextDate });
                        setSelectedDateKey(nextDate);
                      }
                    }}
                    className="rounded px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <input
                    type="time"
                    value={event.time}
                    onChange={(e) => updateEvent(event.id, { time: e.target.value })}
                    className="rounded px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body-copy)',
                  fontSize: 'var(--size-body-copy)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {canEdit ? (
                  <textarea
                    value={event.body}
                    onChange={(e) => updateEvent(event.id, { body: e.target.value })}
                    className="min-h-28 w-full rounded px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                ) : (
                  renderMarkdownText(event.body)
                )}
              </div>
            </article>
          ))}
          {selectedEvents.length === 0 && (
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {canEdit ? 'Crea un evento dal content type Calendario.' : 'Nessun evento in questa data.'}
            </div>
          )}
        </div>
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

function HeroSection({ title, subtitle, image, imageHeight = 256, imagePosX = 50, imagePosY = 50, imageScale = 100, cta, pageId, sectionIndex }: any) {
  const { canEdit } = useAdmin();
  const ctaText = cta?.text || 'Scopri di più';
  const ctaLink = cta?.link || '/';

  return (
    <div className="text-center py-20">
      {image && (
        <div className="mb-8 max-w-4xl mx-auto">
          <InlineImagePositionEditor
            src={image}
            alt={title}
            path={['pages', pageId, 'sections', sectionIndex, 'image']}
            frameHeightPath={['pages', pageId, 'sections', sectionIndex, 'imageHeight']}
            posXPath={['pages', pageId, 'sections', sectionIndex, 'imagePosX']}
            posYPath={['pages', pageId, 'sections', sectionIndex, 'imagePosY']}
            scalePath={['pages', pageId, 'sections', sectionIndex, 'imageScale']}
            frameHeight={imageHeight}
            posX={imagePosX}
            posY={imagePosY}
            scale={imageScale}
            className="w-full object-cover rounded-lg"
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
        <div className="flex flex-col items-center gap-3">
          <Link
            to={ctaLink}
            onClick={(e) => {
              if (canEdit) {
                e.preventDefault();
              }
            }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold transition-transform hover:scale-105"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              borderRadius: 'var(--border-radius)'
            }}
          >
            <InlineEditor
              value={ctaText}
              path={['pages', pageId, 'sections', sectionIndex, 'cta', 'text']}
            />
            <ArrowRight className="w-5 h-5" />
          </Link>
          {canEdit && (
            <div className="w-full max-w-md">
              <div className="mb-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Slug destinazione CTA
              </div>
              <InlineEditor
                value={ctaLink}
                path={['pages', pageId, 'sections', sectionIndex, 'cta', 'link']}
                className="block w-full rounded px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              />
            </div>
          )}
        </div>
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
                  frameHeightPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageHeight']}
                  posXPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosX']}
                  posYPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosY']}
                  scalePath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageScale']}
                  frameHeight={item.imageHeight ?? 192}
                  posX={item.imagePosX}
                  posY={item.imagePosY}
                  scale={item.imageScale ?? 100}
                  className="w-full object-cover"
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
  imageHeight = 256,
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
        frameHeightPath={['pages', pageId, 'sections', sectionIndex, 'imageHeight']}
        posXPath={['pages', pageId, 'sections', sectionIndex, 'imagePosX']}
        posYPath={['pages', pageId, 'sections', sectionIndex, 'imagePosY']}
        scalePath={['pages', pageId, 'sections', sectionIndex, 'imageScale']}
        frameHeight={imageHeight}
        posX={imagePosX}
        posY={imagePosY}
        scale={imageScale}
        className="w-full object-cover rounded-lg"
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
                frameHeightPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageHeight']}
                posXPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosX']}
                posYPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosY']}
                scalePath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageScale']}
                frameHeight={item.imageHeight ?? 192}
                posX={item.imagePosX}
                posY={item.imagePosY}
                scale={item.imageScale ?? 100}
                className="w-full object-cover"
              />
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
                  frameHeightPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageHeight']}
                  posXPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosX']}
                  posYPath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imagePosY']}
                  scalePath={['pages', pageId, 'sections', sectionIndex, 'items', index, 'imageScale']}
                  frameHeight={item.imageHeight ?? 192}
                  posX={item.imagePosX}
                  posY={item.imagePosY}
                  scale={item.imageScale ?? 100}
                  className="w-full object-cover"
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
