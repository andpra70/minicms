import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { resolveAppAssetUrl } from '@/app/lib/urls';

const LOCAL_IMAGE_GALLERY = [
  'img/2.webp',
  'img/3.webp',
  'img/4.gif',
  'img/5.jpg',
  'img/6.jpg',
  'img/me.webp',
];
const GALLERY_REF_PREFIX = 'gallery:';

function isGalleryRef(value: string) {
  return typeof value === 'string' && value.startsWith(GALLERY_REF_PREFIX);
}

function getEmbeddedGallery(content: any) {
  return Array.isArray(content?.gallery) ? content.gallery : [];
}

function resolveImageSource(value: string, content: any) {
  if (!isGalleryRef(value)) {
    return resolveAppAssetUrl(value);
  }
  const id = value.slice(GALLERY_REF_PREFIX.length);
  const image = getEmbeddedGallery(content).find((item: any) => item.id === id);
  return image?.data || '';
}

function nextGalleryId(content: any) {
  const gallery = getEmbeddedGallery(content);
  return `img_${Date.now()}_${gallery.length + 1}`;
}

function ensureImageReference(value: string, targetContent: any) {
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    if (!Array.isArray(targetContent.gallery)) {
      targetContent.gallery = [];
    }
    const id = nextGalleryId(targetContent);
    targetContent.gallery.push({ id, name: `clip-${new Date().toISOString()}`, data: value });
    return `${GALLERY_REF_PREFIX}${id}`;
  }
  return value;
}

function getDisplayValue(value: string) {
  if (isGalleryRef(value)) {
    return value;
  }
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    return '[immagine base64 incollata - salva per registrare]';
  }
  return value;
}

function getGalleryLabel(item: any) {
  const rawLabel = typeof item?.name === 'string' && item.name.trim().length > 0 ? item.name : item?.id || 'image';
  if (rawLabel.startsWith('data:image/')) {
    return item?.id || 'image';
  }
  return rawLabel.length > 80 ? `${rawLabel.slice(0, 80)}...` : rawLabel;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const INLINE_MARKDOWN_REGEX =
  /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`|~~([^~\n]+)~~)/g;
const EXTERNAL_PROTOCOL_REGEX = /^(https?:\/\/|mailto:|tel:)/i;

function normalizeInternalHref(href: string) {
  if (href.startsWith('/') || href.startsWith('#')) {
    return href;
  }
  return `/${href}`;
}

function renderInlineMarkdown(value: string, keyPrefix: string) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  INLINE_MARKDOWN_REGEX.lastIndex = 0;

  while ((match = INLINE_MARKDOWN_REGEX.exec(value)) !== null) {
    const [raw, label, hrefRaw, boldA, boldB, italicA, italicB, code, strike] = match;
    const start = match.index;
    const end = start + raw.length;

    if (start > cursor) {
      parts.push(
        <span key={`${keyPrefix}-plain-${cursor}`}>
          {value.slice(cursor, start)}
        </span>
      );
    }

    if (label && hrefRaw) {
      const href = hrefRaw.trim();
      if (EXTERNAL_PROTOCOL_REGEX.test(href)) {
        parts.push(
          <a
            key={`${keyPrefix}-link-${start}`}
            href={href}
            className="underline underline-offset-2"
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noreferrer noopener' : undefined}
          >
            {label}
          </a>
        );
      } else {
        parts.push(
          <Link
            key={`${keyPrefix}-link-${start}`}
            to={normalizeInternalHref(href)}
            className="underline underline-offset-2"
          >
            {label}
          </Link>
        );
      }
    } else if (boldA || boldB) {
      parts.push(
        <strong key={`${keyPrefix}-bold-${start}`}>
          {boldA || boldB}
        </strong>
      );
    } else if (italicA || italicB) {
      parts.push(<em key={`${keyPrefix}-italic-${start}`}>{italicA || italicB}</em>);
    } else if (code) {
      parts.push(
        <code
          key={`${keyPrefix}-code-${start}`}
          className="px-1 py-0.5 rounded"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-surface) 85%, black 15%)',
            border: '1px solid var(--color-border)',
          }}
        >
          {code}
        </code>
      );
    } else if (strike) {
      parts.push(<s key={`${keyPrefix}-strike-${start}`}>{strike}</s>);
    } else {
      parts.push(<span key={`${keyPrefix}-raw-${start}`}>{raw}</span>);
    }

    cursor = end;
  }

  if (cursor < value.length) {
    parts.push(<span key={`${keyPrefix}-plain-${cursor}`}>{value.slice(cursor)}</span>);
  }

  if (parts.length === 0 && value.length > 0) {
    parts.push(<span key={`${keyPrefix}-plain-full`}>{value}</span>);
  }

  return parts;
}

function renderMarkdownText(value: string) {
  const parts: React.ReactNode[] = [];
  const lines = value.split('\n');

  lines.forEach((line, index) => {
    parts.push(...renderInlineMarkdown(line, `line-${index}`));
    if (index < lines.length - 1) {
      parts.push(<br key={`line-br-${index}`} />);
    }
  });

  if (parts.length === 0) {
    return value;
  }
  return parts;
}

interface InlineEditorProps {
  value: string;
  type?: 'text' | 'textarea';
  path: string[]; // Path to the value in the content object
  className?: string;
  style?: React.CSSProperties;
}

export function InlineEditor({ value, type = 'text', path, className = '', style }: InlineEditorProps) {
  const { canEdit, content, updateContent } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'textarea') {
        (inputRef.current as HTMLTextAreaElement).select();
      } else {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [isEditing, type]);

  const handleSave = () => {
    // Update the content using the path
    const newContent = JSON.parse(JSON.stringify(content));
    let current = newContent;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = editValue;
    updateContent(newContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (!canEdit) {
    return <span className={className} style={style}>{renderMarkdownText(value)}</span>;
  }

  if (isEditing) {
    return (
      <div className="relative inline-block w-full">
        {type === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className={`${className} w-full p-2 rounded`}
            style={{
              ...style,
              border: '2px solid var(--color-primary)',
              backgroundColor: 'var(--color-background)',
            }}
            rows={4}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className={`${className} w-full p-2 rounded`}
            style={{
              ...style,
              border: '2px solid var(--color-primary)',
              backgroundColor: 'var(--color-background)',
            }}
          />
        )}
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            className="px-3 py-1 rounded text-sm flex items-center gap-1"
            style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
          >
            <Check className="w-4 h-4" />
            Salva
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 rounded text-sm flex items-center gap-1"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            <X className="w-4 h-4" />
            Annulla
          </button>
        </div>
        {type === 'textarea' && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Markdown: `**grassetto**`, `*corsivo*`, `` `code` ``, `~~barrato~~`, `[link](/pagina#sezione)`.
          </p>
        )}
      </div>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={`${className} cursor-pointer relative inline-block group`}
      style={style}
    >
      {renderMarkdownText(value)}
      <span
        className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center"
        style={{ color: 'var(--color-primary)' }}
      >
        <Edit2 className="w-4 h-4" />
      </span>
    </span>
  );
}

interface InlineImageEditorProps {
  src: string;
  alt: string;
  path: string[];
  className?: string;
  style?: React.CSSProperties;
}

export function InlineImageEditor({ src, alt, path, className = '', style }: InlineImageEditorProps) {
  const { canEdit, content, updateContent } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [imageValue, setImageValue] = useState(src);

  const handleSave = () => {
    const newContent = JSON.parse(JSON.stringify(content));
    let current = newContent;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = ensureImageReference(imageValue, newContent);
    updateContent(newContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setImageValue(src);
    setIsEditing(false);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        alert('Clipboard API non disponibile nel browser.');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'clipboard-image', { type: imageType });
          const dataUrl = await fileToDataUrl(file);
          setImageValue(dataUrl);
          return;
        }
      }
      alert('Nessuna immagine trovata negli appunti.');
    } catch (error) {
      console.error(error);
      alert('Impossibile leggere la clipboard.');
    }
  };

  const embeddedGallery = getEmbeddedGallery(content);
  const displaySrc = resolveImageSource(isEditing ? imageValue : src, content);

  if (!canEdit) {
    return <img src={resolveImageSource(src, content)} alt={alt} className={className} style={style} />;
  }

  return (
    <div className="relative group">
      <img src={displaySrc} alt={alt} className={className} style={style} />
      
      {!isEditing && (
        <button
          onClick={() => setIsEditing(true)}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"
          style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}

      {isEditing && (
        <div className="absolute inset-0 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md space-y-3">
            <input
              type="text"
              value={getDisplayValue(imageValue)}
              onChange={(e) => setImageValue(e.target.value)}
              placeholder="URL immagine..."
              className="w-full px-3 py-2 rounded"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              Incolla da clipboard
            </button>
            <div className="space-y-2">
              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Gallery locale (/public/img)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LOCAL_IMAGE_GALLERY.map((imagePath) => (
                  <button
                    key={imagePath}
                    type="button"
                    onClick={() => setImageValue(imagePath)}
                    className="h-16 rounded overflow-hidden"
                    style={{
                      border: imageValue === imagePath ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-background)',
                    }}
                    title={imagePath}
                  >
                    <img src={resolveAppAssetUrl(imagePath)} alt={imagePath} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            {embeddedGallery.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Gallery embedded (base64)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {embeddedGallery.map((item: any) => {
                    const ref = `${GALLERY_REF_PREFIX}${item.id}`;
                    const galleryLabel = getGalleryLabel(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setImageValue(ref)}
                        className="h-16 rounded overflow-hidden"
                        style={{
                          border: imageValue === ref ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-background)',
                        }}
                        title={galleryLabel}
                      >
                        <img src={item.data} alt={galleryLabel} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 rounded flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
              >
                <Check className="w-4 h-4" />
                Salva
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 rounded flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <X className="w-4 h-4" />
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface InlineImagePositionEditorProps {
  src: string;
  alt: string;
  path: string[];
  posXPath: string[];
  posYPath: string[];
  scalePath?: string[];
  posX?: number;
  posY?: number;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function InlineImagePositionEditor({ 
  src, 
  alt, 
  path, 
  posXPath, 
  posYPath, 
  scalePath,
  posX = 50, 
  posY = 50, 
  scale = 100,
  className = '', 
  style 
}: InlineImagePositionEditorProps) {
  const { canEdit, content, updateContent } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [imageValue, setImageValue] = useState(src);
  const [localPosX, setLocalPosX] = useState(posX);
  const [localPosY, setLocalPosY] = useState(posY);
  const clampScale = (value: number) => Math.max(10, Math.min(200, value));
  const [localScale, setLocalScale] = useState(clampScale(scale));
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    const newContent = JSON.parse(JSON.stringify(content));
    
    // Update image URL
    let current = newContent;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = ensureImageReference(imageValue, newContent);
    
    // Update position X
    current = newContent;
    for (let i = 0; i < posXPath.length - 1; i++) {
      current = current[posXPath[i]];
    }
    current[posXPath[posXPath.length - 1]] = Math.round(localPosX);
    
    // Update position Y
    current = newContent;
    for (let i = 0; i < posYPath.length - 1; i++) {
      current = current[posYPath[i]];
    }
    current[posYPath[posYPath.length - 1]] = Math.round(localPosY);

    if (Array.isArray(scalePath) && scalePath.length > 0) {
      current = newContent;
      for (let i = 0; i < scalePath.length - 1; i++) {
        current = current[scalePath[i]];
      }
      current[scalePath[scalePath.length - 1]] = clampScale(Math.round(localScale));
    }
    
    updateContent(newContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setImageValue(src);
    setLocalPosX(posX);
    setLocalPosY(posY);
    setLocalScale(clampScale(scale));
    setIsEditing(false);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        alert('Clipboard API non disponibile nel browser.');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'clipboard-image', { type: imageType });
          const dataUrl = await fileToDataUrl(file);
          setImageValue(dataUrl);
          return;
        }
      }
      alert('Nessuna immagine trovata negli appunti.');
    } catch (error) {
      console.error(error);
      alert('Impossibile leggere la clipboard.');
    }
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !previewRef.current) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calcola percentuale
    const percentX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const percentY = Math.max(0, Math.min(100, (y / rect.height) * 100));

    setLocalPosX(Math.round(percentX));
    setLocalPosY(Math.round(percentY));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const embeddedGallery = getEmbeddedGallery(content);
  const resolvedCurrentSrc = resolveImageSource(isEditing ? imageValue : src, content);
  const resolvedPreviewSrc = resolveImageSource(imageValue, content);

  if (!canEdit) {
    return (
      <img 
        src={resolveImageSource(src, content)} 
        alt={alt} 
        className={className} 
        style={{
          ...style,
          objectPosition: `${posX}% ${posY}%`,
          transform: `scale(${clampScale(scale) / 100})`,
          transformOrigin: `${posX}% ${posY}%`,
        }} 
      />
    );
  }

  return (
    <div className="relative group">
      <img 
        src={resolvedCurrentSrc} 
        alt={alt} 
        className={className} 
        style={{
          ...style,
          objectPosition: isEditing ? `${localPosX}% ${localPosY}%` : `${posX}% ${posY}%`,
          transform: `scale(${(isEditing ? localScale : clampScale(scale)) / 100})`,
          transformOrigin: `${isEditing ? localPosX : posX}% ${isEditing ? localPosY : posY}%`,
        }} 
      />
      
      {!isEditing && (
        <button
          onClick={() => setIsEditing(true)}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"
          style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
          title="Modifica immagine e posizionamento"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}

      {isEditing && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999 }}>
          <div className="w-full max-w-2xl space-y-4 max-h-screen overflow-y-auto">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                URL Immagine
              </label>
              <input
                type="text"
                value={getDisplayValue(imageValue)}
                onChange={(e) => setImageValue(e.target.value)}
                placeholder="URL immagine..."
                className="w-full px-3 py-2 rounded"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              />
            </div>
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              Incolla da clipboard
            </button>
            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                Gallery locale (/public/img)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {LOCAL_IMAGE_GALLERY.map((imagePath) => (
                  <button
                    key={imagePath}
                    type="button"
                    onClick={() => setImageValue(imagePath)}
                    className="h-16 rounded overflow-hidden"
                    style={{
                      border: imageValue === imagePath ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-background)',
                    }}
                    title={imagePath}
                  >
                    <img src={resolveAppAssetUrl(imagePath)} alt={imagePath} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            {embeddedGallery.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Gallery embedded (base64)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {embeddedGallery.map((item: any) => {
                    const ref = `${GALLERY_REF_PREFIX}${item.id}`;
                    const galleryLabel = getGalleryLabel(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setImageValue(ref)}
                        className="h-16 rounded overflow-hidden"
                        style={{
                          border: imageValue === ref ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-background)',
                        }}
                        title={galleryLabel}
                      >
                        <img src={item.data} alt={galleryLabel} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {resolvedPreviewSrc && (
              <div className="space-y-3">
                <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Anteprima e Pan (trascinare per posizionare)
                </label>
                <div
                  ref={previewRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="relative w-full h-64 rounded overflow-hidden cursor-move bg-black"
                  style={{
                    userSelect: isDragging ? 'none' : 'auto',
                    border: '2px solid var(--color-primary)',
                  }}
                >
                  <img
                    src={resolvedPreviewSrc}
                    alt={alt}
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${localPosX}% ${localPosY}%`,
                      transform: `scale(${localScale / 100})`,
                      transformOrigin: `${localPosX}% ${localPosY}%`,
                      cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                    onError={() => {}}
                  />
                  {/* Crosshair al centro */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${localPosX}%`,
                      top: `${localPosY}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid rgba(255, 255, 255, 0.8)',
                        borderRadius: '50%',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        width: '12px',
                        height: '2px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 p-3 rounded" style={{ backgroundColor: 'var(--color-surface)' }}>
              <h4 style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 'bold' }}>
                Posizionamento Immagine (Pan)
              </h4>

              <div className="space-y-2">
                <label className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Allineamento rapido
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLocalPosY(0)}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    Top
                  </button>
                  <button
                    onClick={() => setLocalPosY(100)}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    Bottom
                  </button>
                  <button
                    onClick={() => setLocalPosX(0)}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    Left
                  </button>
                  <button
                    onClick={() => setLocalPosX(100)}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    Right
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Orizzontale: {localPosX}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localPosX}
                  onChange={(e) => setLocalPosX(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Verticale: {localPosY}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localPosY}
                  onChange={(e) => setLocalPosY(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Scala: {Math.round(localScale)}%
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={localScale}
                    onChange={(e) => setLocalScale(clampScale(Number(e.target.value)))}
                    className="w-full"
                  />
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={Math.round(localScale)}
                    onChange={(e) => setLocalScale(clampScale(Number(e.target.value)))}
                    className="w-20 px-2 py-1 rounded text-sm"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setLocalPosX(50); setLocalPosY(50); setLocalScale(100); }}
                  className="flex-1 px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Centra
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 rounded flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
              >
                <Check className="w-4 h-4" />
                Salva
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 rounded flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <X className="w-4 h-4" />
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
