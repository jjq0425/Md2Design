const CALLOUT_TYPE_MAP: Record<string, string> = {
  note: 'note',
  info: 'info',
  tip: 'tip',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  error: 'danger',
  caution: 'warning',
  important: 'important',
  question: 'question',
  abstract: 'info',
  summary: 'info',
  help: 'tip',
};

const ADVANCED_COLOR_MAP: Record<string, string> = {
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  gold: '#d4a017',
  brown: '#8b5e3c',
  black: '#111827',
  white: '#ffffff',
  mint: '#34d399',
  peach: '#fb7185',
  lavender: '#a78bfa',
};

const escapeHtmlAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const resolveAdvancedColor = (input: string) => {
  const normalized = input.trim().toLowerCase();
  return ADVANCED_COLOR_MAP[normalized] || input.trim();
};

const transformDirectiveCallouts = (markdown: string) => {
  const lines = markdown.split('\n');
  const transformed: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const directiveMatch = lines[i].match(/^:::\s*(\w+)(?:\s+(.*))?\s*$/);

    if (!directiveMatch) {
      transformed.push(lines[i]);
      continue;
    }

    const type = CALLOUT_TYPE_MAP[directiveMatch[1].toLowerCase()] || 'note';
    const title = directiveMatch[2]?.trim();
    const contentLines: string[] = [];
    i += 1;

    while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
      contentLines.push(lines[i]);
      i += 1;
    }

    const calloutHeader = title ? `> [!${type.toUpperCase()}] ${title}` : `> [!${type.toUpperCase()}]`;
    transformed.push(calloutHeader);

    if (contentLines.length === 0) {
      transformed.push('>');
      continue;
    }

    contentLines.forEach((line) => {
      transformed.push(line.trim() === '' ? '>' : `> ${line}`);
    });
  }

  return transformed.join('\n');
};

const transformInlineSyntax = (segment: string) => {
  let result = segment;

  result = result.replace(/\[color=([^\]]+)]([\s\S]+?)\[\/color]/gi, (_match, color, content) => {
    const resolved = escapeHtmlAttribute(resolveAdvancedColor(color));
    return `<span data-color="${resolved}">${content}</span>`;
  });

  result = result.replace(/\[bg=([^\]]+)]([\s\S]+?)\[\/bg]/gi, (_match, color, content) => {
    const resolved = escapeHtmlAttribute(resolveAdvancedColor(color));
    return `<span data-bg="${resolved}">${content}</span>`;
  });

  result = result.replace(/\+\+([^+][\s\S]*?)\+\+/g, '<span data-underline="handdrawn">$1</span>');
  result = result.replace(/==([^=][\s\S]*?)==/g, '<mark data-highlight="true">$1</mark>');

  return result;
};

export const preprocessMarkdown = (markdown: string) => {
  const withCallouts = transformDirectiveCallouts(markdown);
  const segments = withCallouts.split(/(```[\s\S]*?```)/g);

  return segments
    .map((segment) => (segment.startsWith('```') ? segment : transformInlineSyntax(segment)))
    .join('');
};

export const extractCalloutMeta = (rawText: string) => {
  const match = rawText.match(/^\[!(\w+)](?:\s+(.*))?$/i);
  if (!match) return null;

  const type = CALLOUT_TYPE_MAP[match[1].toLowerCase()] || 'note';
  return {
    type,
    title: match[2]?.trim() || '',
  };
};
