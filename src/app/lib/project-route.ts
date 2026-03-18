const PROJECT_QUERY_PARAM = 'project';
const EDIT_QUERY_PARAM = 'edit';
const RESERVED_PATH_SEGMENTS = new Set(['minicms']);

function getSearchParamsFromLocation(locationLike: Pick<Location, 'search'> & Partial<Pick<Location, 'hash'>>) {
  const params = new URLSearchParams(locationLike.search);
  const hash = typeof locationLike.hash === 'string' ? locationLike.hash : '';
  const hashQueryIndex = hash.indexOf('?');

  if (hashQueryIndex >= 0) {
    const hashParams = new URLSearchParams(hash.slice(hashQueryIndex + 1));
    hashParams.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }

  return params;
}

export function sanitizeProjectName(value: string) {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'site';
}

function getPathSegments(pathname: string) {
  return String(pathname || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getTrailingPathProjectName(pathname: string) {
  const segments = getPathSegments(pathname);
  if (segments.length === 0) {
    return null;
  }

  const lastSegment = segments[segments.length - 1];
  if (!lastSegment || lastSegment.includes('.') || RESERVED_PATH_SEGMENTS.has(lastSegment.toLowerCase())) {
    return null;
  }

  return sanitizeProjectName(decodeURIComponent(lastSegment));
}

export function getProjectNameFromUrl(locationLike: Pick<Location, 'pathname' | 'search'> = window.location) {
  const searchParams = getSearchParamsFromLocation(locationLike);
  const queryProject = searchParams.get(PROJECT_QUERY_PARAM);
  if (queryProject) {
    return sanitizeProjectName(queryProject);
  }

  const pathMatch = locationLike.pathname.match(/\/project\/([^/]+)/i);
  if (pathMatch?.[1]) {
    return sanitizeProjectName(decodeURIComponent(pathMatch[1]));
  }

  const trailingProject = getTrailingPathProjectName(locationLike.pathname);
  if (trailingProject) {
    return trailingProject;
  }

  return null;
}

export function hasEditModeFromUrl(locationLike: Pick<Location, 'search'> & Partial<Pick<Location, 'hash'>> = window.location) {
  return getSearchParamsFromLocation(locationLike).get(EDIT_QUERY_PARAM) === '1';
}

export function buildProjectFileName(projectName: string) {
  return `sites/${sanitizeProjectName(projectName)}.json`;
}

export function setProjectUrl(projectName: string) {
  const url = new URL(window.location.href);
  const normalizedProjectName = sanitizeProjectName(projectName);
  const segments = getPathSegments(url.pathname);

  if (url.pathname.match(/\/project\/[^/]+/i)) {
    url.pathname = url.pathname.replace(/\/project\/[^/]+/i, `/project/${normalizedProjectName}`);
  } else if (
    !url.searchParams.has(PROJECT_QUERY_PARAM) &&
    segments.length >= 1 &&
    !segments[segments.length - 1].includes('.') &&
    !RESERVED_PATH_SEGMENTS.has(segments[segments.length - 1].toLowerCase())
  ) {
    segments[segments.length - 1] = normalizedProjectName;
    url.pathname = `/${segments.join('/')}`;
  } else {
    url.searchParams.set(PROJECT_QUERY_PARAM, normalizedProjectName);
  }

  window.history.replaceState({}, '', url.toString());
}

export function setProjectPathUrl(projectName: string) {
  const url = new URL(window.location.href);
  const normalizedProjectName = sanitizeProjectName(projectName);
  const segments = getPathSegments(url.pathname).filter(
    (segment) => !RESERVED_PATH_SEGMENTS.has(segment.toLowerCase()) && !segment.includes('.')
  );
  const baseSegments = getPathSegments(url.pathname).filter((segment) =>
    RESERVED_PATH_SEGMENTS.has(segment.toLowerCase())
  );

  url.pathname = `/${[...baseSegments, normalizedProjectName].join('/')}`;
  url.searchParams.delete(PROJECT_QUERY_PARAM);
  window.history.replaceState({}, '', url.toString());
}
