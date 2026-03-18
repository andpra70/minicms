export function extractYouTubeVideoId(value: string) {
  const input = String(value || '').trim();
  if (!input) {
    return '';
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (hostname === 'youtu.be') {
      const pathId = url.pathname.split('/').filter(Boolean)[0] || '';
      return /^[a-zA-Z0-9_-]{11}$/.test(pathId) ? pathId : '';
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'music.youtube.com') {
      const queryId = url.searchParams.get('v') || '';
      if (/^[a-zA-Z0-9_-]{11}$/.test(queryId)) {
        return queryId;
      }

      const parts = url.pathname.split('/').filter(Boolean);
      const embeddedId = parts[0] === 'embed' || parts[0] === 'shorts' ? parts[1] || '' : '';
      return /^[a-zA-Z0-9_-]{11}$/.test(embeddedId) ? embeddedId : '';
    }
  } catch {
    return '';
  }

  return '';
}

export function buildYouTubeEmbedUrl(value: string) {
  const videoId = extractYouTubeVideoId(value);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
}
