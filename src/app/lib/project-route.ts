const PROJECT_QUERY_PARAM = 'project';
const EDIT_QUERY_PARAM = 'edit';

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

  return null;
}

export function hasEditModeFromUrl(locationLike: Pick<Location, 'search'> & Partial<Pick<Location, 'hash'>> = window.location) {
  return getSearchParamsFromLocation(locationLike).get(EDIT_QUERY_PARAM) === '1';
}

export function buildProjectFileName(projectName: string) {
  return `${sanitizeProjectName(projectName)}.json`;
}

export function setProjectUrl(projectName: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(PROJECT_QUERY_PARAM, sanitizeProjectName(projectName));
  window.history.replaceState({}, '', url.toString());
}
