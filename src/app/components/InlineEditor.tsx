import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { resolveAppAssetUrl } from '@/app/lib/urls';
import { isImageFile, optimizeImageFile } from '@/app/lib/image-upload';

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

function removeEmbeddedGalleryItem(targetContent: any, imageId: string) {
  const ref = `${GALLERY_REF_PREFIX}${imageId}`;
  const visit = (node: any) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    Object.keys(node).forEach((key) => {
      if (key === 'gallery' && Array.isArray(node[key])) {
        node[key] = node[key].filter((item: any) => item?.id !== imageId);
        return;
      }
      if (node[key] === ref) {
        node[key] = '';
        return;
      }
      visit(node[key]);
    });
  };
  visit(targetContent);
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

export function renderMarkdownText(value: string) {
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

async function addOptimizedImageToGallery(file: File, content: any) {
  const dataUrl = await optimizeImageFile(file);
  if (!Array.isArray(content.gallery)) {
    content.gallery = [];
  }
  const id = nextGalleryId(content);
  content.gallery.push({ id, name: file.name || `upload-${new Date().toISOString()}`, data: dataUrl });
  return `${GALLERY_REF_PREFIX}${id}`;
}

async function applyOptimizedImageToPath(file: File, sourceContent: any, path: string[], updateContent: (newContent: any) => void) {
  if (!isImageFile(file)) {
    throw new Error('Seleziona una immagine valida.');
  }

  const nextContent = JSON.parse(JSON.stringify(sourceContent));
  let current = nextContent;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }

  const dataUrl = await optimizeImageFile(file);
  current[path[path.length - 1]] = ensureImageReference(dataUrl, nextContent);
  updateContent(nextContent);
  return current[path[path.length - 1]];
}

interface EmbeddedGalleryDropzoneProps {
  onSelectRef: (ref: string) => void;
}

function EmbeddedGalleryDropzone({ onSelectRef }: EmbeddedGalleryDropzoneProps) {
  const { content, updateContent } = useAdmin();
  const [isUploading, setIsUploading] = useState(false);
  const [isOver, setIsOver] = useState(false);

  const processFile = async (file: File) => {
    if (!isImageFile(file)) {
      alert('Seleziona una immagine valida.');
      return;
    }
    setIsUploading(true);
    try {
      const nextContent = JSON.parse(JSON.stringify(content));
      const ref = await addOptimizedImageToGallery(file, nextContent);
      updateContent(nextContent);
      onSelectRef(ref);
    } catch (error) {
      console.error(error);
      alert('Impossibile importare l\'immagine.');
    } finally {
      setIsUploading(false);
      setIsOver(false);
    }
  };

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    event.target.value = '';
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (isImageFile(file)) {
      await processFile(file);
    }
    setIsOver(false);
  };

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className="block w-full p-3 rounded text-sm cursor-pointer transition-colors"
      style={{
        backgroundColor: isOver ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface) 88%)' : 'var(--color-background)',
        color: 'var(--color-text)',
        border: `1px dashed ${isOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
      }}
    >
      <div className="font-medium">Drop immagine nella gallery</div>
      <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
        {isUploading ? 'Ottimizzazione in corso...' : 'Trascina un file o clicca per importarlo. Se supera 300 KB viene ridimensionato.'}
      </div>
      <input type="file" accept="image/*" onChange={handleInputChange} className="hidden" />
    </label>
  );
}

interface EmbeddedGalleryGridProps {
  content: any;
  selectedValue: string;
  onSelectRef: (ref: string) => void;
  onDeleteRef?: (ref: string) => void;
}

function EmbeddedGalleryGrid({ content, selectedValue, onSelectRef, onDeleteRef }: EmbeddedGalleryGridProps) {
  const { updateContent } = useAdmin();
  const embeddedGallery = getEmbeddedGallery(content);

  if (embeddedGallery.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Gallery embedded (base64)
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {embeddedGallery.map((item: any) => {
          const ref = `${GALLERY_REF_PREFIX}${item.id}`;
          const galleryLabel = getGalleryLabel(item);
          return (
            <div key={item.id} className="relative">
              <button
                type="button"
                onClick={() => onSelectRef(ref)}
                className="h-16 w-full rounded overflow-hidden"
                style={{
                  border: selectedValue === ref ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-background)',
                }}
                title={galleryLabel}
              >
                <img src={item.data} alt={galleryLabel} className="w-full h-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextContent = JSON.parse(JSON.stringify(content));
                  removeEmbeddedGalleryItem(nextContent, item.id);
                  updateContent(nextContent);
                  if (selectedValue === ref) {
                    onDeleteRef?.(ref);
                  }
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full text-xs leading-none"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
                title="Elimina immagine"
                aria-label={`Elimina ${galleryLabel}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [isDropOver, setIsDropOver] = useState(false);

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
          const dataUrl = await optimizeImageFile(file);
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

  const displaySrc = resolveImageSource(isEditing ? imageValue : src, content);

  const handleDirectDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDropOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!isImageFile(file)) {
      return;
    }
    try {
      const nextValue = await applyOptimizedImageToPath(file, content, path, updateContent);
      setImageValue(nextValue);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Impossibile sostituire l\'immagine.');
    }
  };

  if (!canEdit) {
    return <img src={resolveImageSource(src, content)} alt={alt} className={className} style={style} />;
  }

  return (
    <div
      className="relative group"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDropOver(true);
      }}
      onDragLeave={() => setIsDropOver(false)}
      onDrop={handleDirectDrop}
    >
      <img src={displaySrc} alt={alt} className={className} style={style} />
      {isDropOver && !isEditing && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded"
          style={{
            backgroundColor: 'rgba(0,0,0,0.45)',
            border: '2px dashed var(--color-primary)',
            color: '#ffffff',
            zIndex: 15,
          }}
        >
          Drop per sostituire
        </div>
      )}
      
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
            <EmbeddedGalleryDropzone onSelectRef={setImageValue} />
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
            <EmbeddedGalleryGrid
              content={content}
              selectedValue={imageValue}
              onSelectRef={setImageValue}
              onDeleteRef={() => setImageValue('')}
            />
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
  frameHeightPath?: string[];
  posX?: number;
  posY?: number;
  scale?: number;
  frameHeight?: number;
  minFrameHeight?: number;
  maxFrameHeight?: number;
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
  frameHeightPath,
  posX = 50, 
  posY = 50, 
  scale = 100,
  frameHeight,
  minFrameHeight = 96,
  maxFrameHeight = 720,
  className = '', 
  style 
}: InlineImagePositionEditorProps) {
  const { canEdit, content, updateContent } = useAdmin();
  const [localPosX, setLocalPosX] = useState(posX);
  const [localPosY, setLocalPosY] = useState(posY);
  const clampScale = (value: number) => Math.max(10, Math.min(200, value));
  const clampFrameHeight = (value: number) => Math.max(minFrameHeight, Math.min(maxFrameHeight, value));
  const [localScale] = useState(clampScale(scale));
  const [localFrameHeight, setLocalFrameHeight] = useState(
    typeof frameHeight === 'number' ? clampFrameHeight(frameHeight) : undefined
  );
  const [isDropOver, setIsDropOver] = useState(false);
  const [isDirectPanning, setIsDirectPanning] = useState(false);
  const [isResizingFrame, setIsResizingFrame] = useState(false);
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    if (!isDirectPanning && !isResizingFrame) {
      setLocalPosX(posX);
      setLocalPosY(posY);
      setLocalFrameHeight(typeof frameHeight === 'number' ? clampFrameHeight(frameHeight) : undefined);
    }
  }, [posX, posY, scale, frameHeight, isDirectPanning, isResizingFrame]);

  const persistDirectPan = (nextPosX: number, nextPosY: number) => {
    const newContent = JSON.parse(JSON.stringify(content));

    let current = newContent;
    for (let i = 0; i < posXPath.length - 1; i++) {
      current = current[posXPath[i]];
    }
    current[posXPath[posXPath.length - 1]] = Math.round(nextPosX);

    current = newContent;
    for (let i = 0; i < posYPath.length - 1; i++) {
      current = current[posYPath[i]];
    }
    current[posYPath[posYPath.length - 1]] = Math.round(nextPosY);

    updateContent(newContent);
  };

  const persistFrameHeight = (nextHeight: number) => {
    if (!Array.isArray(frameHeightPath) || frameHeightPath.length === 0) {
      return;
    }

    const newContent = JSON.parse(JSON.stringify(content));
    let current = newContent;
    for (let i = 0; i < frameHeightPath.length - 1; i++) {
      current = current[frameHeightPath[i]];
    }
    current[frameHeightPath[frameHeightPath.length - 1]] = clampFrameHeight(Math.round(nextHeight));
    updateContent(newContent);
  };

  const updatePanFromPointer = (clientX: number, clientY: number) => {
    if (!imageFrameRef.current) {
      return;
    }

    const rect = imageFrameRef.current.getBoundingClientRect();
    const nextPosX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const nextPosY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setLocalPosX(Math.round(nextPosX));
    setLocalPosY(Math.round(nextPosY));
  };

  useEffect(() => {
    if (!isDirectPanning) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      updatePanFromPointer(event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      setIsDirectPanning(false);
      persistDirectPan(localPosX, localPosY);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [isDirectPanning, localPosX, localPosY, content, posXPath, posYPath]);

  const handleDirectDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDropOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!isImageFile(file)) {
      return;
    }
    try {
      await applyOptimizedImageToPath(file, content, path, updateContent);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Impossibile sostituire l\'immagine.');
    }
  };

  useEffect(() => {
    if (!isResizingFrame) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) {
        return;
      }
      setLocalFrameHeight(clampFrameHeight(start.startHeight + (event.clientY - start.startY)));
    };

    const handlePointerUp = () => {
      resizeStartRef.current = null;
      setIsResizingFrame(false);
      if (typeof localFrameHeight === 'number') {
        persistFrameHeight(localFrameHeight);
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [isResizingFrame, localFrameHeight, content, frameHeightPath]);

  if (!canEdit) {
    return (
      <div
        style={{
          ...(style || {}),
          height: typeof frameHeight === 'number' ? `${clampFrameHeight(frameHeight)}px` : style?.height,
          overflow: 'hidden',
        }}
      >
        <img 
          src={resolveImageSource(src, content)} 
          alt={alt} 
          className={className} 
          style={{
            width: '100%',
            height: '100%',
            objectPosition: `${posX}% ${posY}%`,
            transform: `scale(${clampScale(scale) / 100})`,
            transformOrigin: `${posX}% ${posY}%`,
          }} 
        />
      </div>
    );
  }

  const { height: _, ...frameStyle } = style || {};
  const effectiveFrameHeight = typeof localFrameHeight === 'number' ? localFrameHeight : undefined;
  const resolvedCurrentSrc = resolveImageSource(src, content);

  return (
    <div
      className="relative group"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDropOver(true);
      }}
      onDragLeave={() => setIsDropOver(false)}
      onDrop={handleDirectDrop}
    >
      <div
        ref={imageFrameRef}
        className="relative"
        onMouseDown={(event) => {
          if (!canEdit || event.button !== 0) {
            return;
          }
          const target = event.target as HTMLElement | null;
          if (target?.dataset.resizeHandle === 'true') {
            return;
          }
          event.preventDefault();
          updatePanFromPointer(event.clientX, event.clientY);
          setIsDirectPanning(true);
        }}
        style={{
          ...frameStyle,
          height: typeof effectiveFrameHeight === 'number' ? `${effectiveFrameHeight}px` : undefined,
          overflow: 'hidden',
          outline: '1px dashed color-mix(in srgb, var(--color-primary) 70%, transparent)',
          outlineOffset: '-1px',
          cursor: isDirectPanning ? 'grabbing' : 'grab',
        }}
      >
        <img 
          src={resolvedCurrentSrc} 
          alt={alt} 
          className={className} 
          style={{
            width: '100%',
            height: '100%',
            objectPosition: `${isDirectPanning ? localPosX : posX}% ${isDirectPanning ? localPosY : posY}%`,
            transform: `scale(${clampScale(localScale) / 100})`,
            transformOrigin: `${isDirectPanning ? localPosX : posX}% ${isDirectPanning ? localPosY : posY}%`,
            userSelect: 'none',
          }} 
          draggable={false}
        />
        {typeof effectiveFrameHeight === 'number' && (
          <>
            <div
              data-resize-handle="true"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                resizeStartRef.current = {
                  startY: event.clientY,
                  startHeight: effectiveFrameHeight,
                };
                setIsResizingFrame(true);
              }}
              className="absolute left-0 right-0 bottom-0 h-3 cursor-ns-resize"
              style={{ zIndex: 14 }}
              title="Ridimensiona altezza"
            />
            <div
              data-resize-handle="true"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                resizeStartRef.current = {
                  startY: event.clientY,
                  startHeight: effectiveFrameHeight,
                };
                setIsResizingFrame(true);
              }}
              className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize rounded-sm"
              style={{
                zIndex: 15,
                backgroundColor: 'var(--color-primary)',
                border: '1px solid var(--color-background)',
              }}
              title="Ridimensiona contenitore"
            />
          </>
        )}
        <div
          className="absolute inset-x-0 bottom-3 px-3 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ zIndex: 12 }}
        >
          <div
            className="inline-flex px-2 py-1 rounded text-[10px]"
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#ffffff',
            }}
          >
            Trascina per crop, bordo inferiore per resize, drop per sostituire
          </div>
        </div>
      </div>
      {isDropOver && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded"
          style={{
            backgroundColor: 'rgba(0,0,0,0.45)',
            border: '2px dashed var(--color-primary)',
            color: '#ffffff',
            zIndex: 15,
          }}
        >
          Drop per sostituire
        </div>
      )}
    </div>
  );
}
