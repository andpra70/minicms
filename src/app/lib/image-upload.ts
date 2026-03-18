const DEFAULT_MAX_IMAGE_BYTES = 300 * 1024;
const MAX_DIMENSION_STEPS = [2200, 1800, 1600, 1400, 1280, 1120, 960, 820, 720, 640];
const QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
const IMAGE_EXTENSION_REGEX = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i;

export function isImageFile(file: File | null | undefined) {
  if (!file) {
    return false;
  }
  return file.type.startsWith('image/') || IMAGE_EXTENSION_REGEX.test(file.name || '');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
    image.src = objectUrl;
  });
}

function scaleSize(width: number, height: number, maxDimension: number) {
  const largestDimension = Math.max(width, height);
  if (largestDimension <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / largestDimension;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Impossibile serializzare immagine.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

export async function imageFileToDataUrl(file: File) {
  return readFileAsDataUrl(file);
}

export async function optimizeImageFile(file: File, maxBytes = DEFAULT_MAX_IMAGE_BYTES) {
  if (!isImageFile(file)) {
    throw new Error('Il file selezionato non e una immagine.');
  }

  if (file.type === 'image/gif' || /\.gif$/i.test(file.name || '')) {
    return readFileAsDataUrl(file);
  }

  if (file.size <= maxBytes) {
    return readFileAsDataUrl(file);
  }

  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return readFileAsDataUrl(file);
  }

  let bestBlob: Blob | null = null;
  const candidateTypes =
    file.type === 'image/png' || /\.png$/i.test(file.name)
      ? ['image/webp', 'image/jpeg', 'image/png']
      : ['image/webp', 'image/jpeg'];

  for (const maxDimension of MAX_DIMENSION_STEPS) {
    const nextSize = scaleSize(image.naturalWidth, image.naturalHeight, maxDimension);
    canvas.width = nextSize.width;
    canvas.height = nextSize.height;
    context.clearRect(0, 0, nextSize.width, nextSize.height);
    context.drawImage(image, 0, 0, nextSize.width, nextSize.height);

    for (const type of candidateTypes) {
      const usesQuality = type !== 'image/png';
      const qualities = usesQuality ? QUALITY_STEPS : [undefined];

      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, type, quality);
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
        }
        if (blob.size <= maxBytes) {
          return blobToDataUrl(blob);
        }
      }
    }
  }

  if (bestBlob) {
    return blobToDataUrl(bestBlob);
  }

  return readFileAsDataUrl(file);
}

export const MAX_THEME_IMAGE_BYTES = DEFAULT_MAX_IMAGE_BYTES;
