const LEAFLET_CSS_ID = 'cms-leaflet-css';
const LEAFLET_SCRIPT_ID = 'cms-leaflet-script';
const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_SCRIPT_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

declare global {
  interface Window {
    L?: any;
  }
}

function appendStylesheet() {
  if (document.getElementById(LEAFLET_CSS_ID)) {
    return;
  }

  const link = document.createElement('link');
  link.id = LEAFLET_CSS_ID;
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_URL;
  document.head.appendChild(link);
}

export async function loadLeaflet() {
  if (window.L) {
    appendStylesheet();
    return window.L;
  }

  appendStylesheet();

  const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      if (window.L) {
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Impossibile caricare Leaflet')), { once: true });
    });
    return window.L;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = LEAFLET_SCRIPT_ID;
    script.src = LEAFLET_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossibile caricare Leaflet'));
    document.head.appendChild(script);
  });

  return window.L;
}

export async function geocodeAddress(address: string) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Geocoding fallito: ${response.status}`);
  }

  const results = await response.json();
  const match = Array.isArray(results) ? results[0] : null;
  if (!match) {
    throw new Error('Indirizzo non trovato');
  }

  return {
    lat: Number(match.lat),
    lng: Number(match.lon),
  };
}
