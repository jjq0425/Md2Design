export type LiveEmbedProvider = 'excalidraw' | 'drawio';

export const LIVE_EMBED_PRESETS: Record<LiveEmbedProvider, {
  label: string;
  editorUrl: string;
  previewUrl: string;
  defaultTitle: string;
  defaultHeight: number;
}> = {
  excalidraw: {
    label: 'Excalidraw',
    editorUrl: 'https://excalidraw.com/',
    previewUrl: 'https://excalidraw.com/',
    defaultTitle: 'Excalidraw 实时画板',
    defaultHeight: 420,
  },
  drawio: {
    label: 'Draw.io',
    editorUrl: 'https://app.diagrams.net/?embed=1&ui=min&spin=1&proto=json',
    previewUrl: 'https://app.diagrams.net/?embed=1&ui=min&spin=1&proto=json',
    defaultTitle: 'Draw.io 实时画板',
    defaultHeight: 420,
  },
};

export const isSafeEmbedUrl = (url: string) => /^https:\/\//i.test(url.trim());

export const buildLiveEmbedMarkup = (
  provider: LiveEmbedProvider,
  url = LIVE_EMBED_PRESETS[provider].previewUrl,
  title = LIVE_EMBED_PRESETS[provider].defaultTitle,
  height = LIVE_EMBED_PRESETS[provider].defaultHeight,
) => {
  const safeUrl = isSafeEmbedUrl(url) ? url.trim() : LIVE_EMBED_PRESETS[provider].previewUrl;
  const safeTitle = title.replace(/["<>]/g, '').trim() || LIVE_EMBED_PRESETS[provider].defaultTitle;
  const safeHeight = Number.isFinite(height) ? Math.max(280, Math.min(960, height)) : LIVE_EMBED_PRESETS[provider].defaultHeight;

  return `\n<div data-live-embed="true" data-provider="${provider}" data-src="${safeUrl}" data-title="${safeTitle}" data-height="${safeHeight}"></div>\n`;
};
