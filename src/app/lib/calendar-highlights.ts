import { format, isValid, parseISO } from 'date-fns';

type DateLikeRange = {
  from: Date;
  to: Date;
};

export type CalendarHighlightMatch = Date | DateLikeRange;

export type CalendarHighlightItem =
  | { type: 'single'; label: string; date: Date }
  | { type: 'range'; label: string; from: Date; to: Date };

function parseDate(value: string) {
  const parsed = parseISO(value.trim());
  return isValid(parsed) ? parsed : null;
}

function parseEntry(entry: string): CalendarHighlightItem | null {
  const trimmed = entry.trim();
  if (!trimmed) {
    return null;
  }

  const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|->|\/)\s*(\d{4}-\d{2}-\d{2})$/);
  if (rangeMatch) {
    const from = parseDate(rangeMatch[1]);
    const to = parseDate(rangeMatch[2]);
    if (!from || !to) {
      return null;
    }
    const normalizedFrom = from <= to ? from : to;
    const normalizedTo = from <= to ? to : from;
    return {
      type: 'range',
      label: `${format(normalizedFrom, 'dd/MM/yyyy')} - ${format(normalizedTo, 'dd/MM/yyyy')}`,
      from: normalizedFrom,
      to: normalizedTo,
    };
  }

  const single = parseDate(trimmed);
  if (!single) {
    return null;
  }

  return {
    type: 'single',
    label: format(single, 'dd/MM/yyyy'),
    date: single,
  };
}

export function parseCalendarInput(input: string) {
  const entries = String(input || '')
    .split(/[\n,;]+/)
    .map((entry) => parseEntry(entry))
    .filter(Boolean) as CalendarHighlightItem[];

  const modifiers: CalendarHighlightMatch[] = entries.map((entry) =>
    entry.type === 'range' ? { from: entry.from, to: entry.to } : entry.date,
  );

  return {
    entries,
    modifiers,
  };
}
