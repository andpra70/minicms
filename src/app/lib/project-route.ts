const PROJECT_QUERY_PARAM = 'project';

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
  const searchParams = new URLSearchParams(locationLike.search);
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

export function buildProjectFileName(projectName: string) {
  return `${sanitizeProjectName(projectName)}.json`;
}

export function setProjectUrl(projectName: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(PROJECT_QUERY_PARAM, sanitizeProjectName(projectName));
  window.history.replaceState({}, '', url.toString());
}
