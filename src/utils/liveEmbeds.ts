export type LiveEmbedProvider = 'excalidraw';

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

export const buildLiveEmbedPosterDataUrl = (title: string, url: string) => {
  const safeTitle = title.replace(/[<>&]/g, '').slice(0, 48) || 'Excalidraw 白板';
  const safeUrl = url.replace(/[<>&]/g, '').slice(0, 64);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#eff6ff" />
          <stop offset="100%" stop-color="#dbeafe" />
        </linearGradient>
        <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#bfdbfe" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="1200" height="720" rx="42" fill="url(#bg)" />
      <rect width="1200" height="720" rx="42" fill="url(#grid)" opacity="0.55" />
      <rect x="76" y="82" width="1048" height="556" rx="34" fill="#ffffff" stroke="#bfdbfe" stroke-width="4" />
      <rect x="126" y="128" width="220" height="54" rx="27" fill="#111827" />
      <text x="236" y="163" font-size="26" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff" text-anchor="middle">Excalidraw</text>
      <text x="126" y="258" font-size="54" font-family="Arial, sans-serif" font-weight="800" fill="#0f172a">${safeTitle}</text>
      <text x="126" y="316" font-size="26" font-family="Arial, sans-serif" fill="#475569">导出时使用静态白板封面，避免第三方工具栏进入卡片成图。</text>
      <text x="126" y="380" font-size="22" font-family="Arial, sans-serif" fill="#64748b">${safeUrl}</text>
      <path d="M860 210l92 72-50 66-95-72z" fill="#93c5fd" opacity="0.7" />
      <path d="M834 364c48-36 120-32 166 10" fill="none" stroke="#3b82f6" stroke-width="10" stroke-linecap="round" />
      <path d="M210 468h310" fill="none" stroke="#0f172a" stroke-width="16" stroke-linecap="round" opacity="0.14" />
      <path d="M210 520h450" fill="none" stroke="#0f172a" stroke-width="16" stroke-linecap="round" opacity="0.1" />
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
