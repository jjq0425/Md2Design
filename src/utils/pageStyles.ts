import type { CardStyle } from '../store';
import { getStyleTemplateById } from './styleTemplates';

const PAGE_STYLE_DIRECTIVE = /^\s*<!--\s*@style:\s*([a-z0-9-]+)\s*-->\s*\n*/i;
const PAGE_SPLIT_REGEX = /\n\s*---\s*\n|^\s*---\s*$/m;

export const splitMarkdownPages = (markdown: string) =>
  markdown
    .split(PAGE_SPLIT_REGEX)
    .map((page) => page.trim())
    .filter((page) => page.length > 0);

export const extractPageStyleDirective = (pageContent: string) => {
  const match = pageContent.match(PAGE_STYLE_DIRECTIVE);
  return {
    styleId: match?.[1] ?? null,
    content: pageContent.replace(PAGE_STYLE_DIRECTIVE, '').trim(),
  };
};

const mergeCardStyle = (base: CardStyle, patch: Partial<CardStyle>): CardStyle => ({
  ...base,
  ...patch,
  backgroundConfig: { ...base.backgroundConfig, ...(patch.backgroundConfig || {}) },
  cardBackgroundConfig: { ...base.cardBackgroundConfig, ...(patch.cardBackgroundConfig || {}) },
  shadowConfig: { ...base.shadowConfig, ...(patch.shadowConfig || {}) },
  cardPadding: { ...base.cardPadding, ...(patch.cardPadding || {}) },
  watermark: { ...base.watermark, ...(patch.watermark || {}) },
  pageNumber: { ...base.pageNumber, ...(patch.pageNumber || {}) },
  headingNumbering: { ...base.headingNumbering, ...(patch.headingNumbering || {}) },
});

export const resolvePageCardStyle = (base: CardStyle, styleId: string | null) => {
  if (!styleId) return base;
  const template = getStyleTemplateById(styleId);
  if (!template) return base;
  return mergeCardStyle(base, template.patch);
};

export const updatePageStyleDirective = (markdown: string, pageIndex: number, styleId: string | null) => {
  const pages = splitMarkdownPages(markdown);
  if (!pages[pageIndex]) return markdown;

  const cleaned = pages[pageIndex].replace(PAGE_STYLE_DIRECTIVE, '').trim();
  pages[pageIndex] = styleId ? `<!-- @style: ${styleId} -->\n\n${cleaned}` : cleaned;

  return pages.join('\n\n---\n\n');
};
