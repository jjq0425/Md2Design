import type { CardStyle } from '../store';

export type StyleTemplate = {
  id: string;
  name: string;
  description: string;
  patch: Partial<CardStyle>;
};

const skyCoverCSS = `.md2-card-shell {
  letter-spacing: -0.02em;
}

.md2-card-shell .prose {
  color: #05070b;
}

.md2-card-shell .prose h1 {
  font-size: clamp(50px, 7vw, 88px) !important;
  line-height: 1.03 !important;
  font-weight: 900 !important;
  margin: 0 0 26px !important;
  border: none !important;
  padding: 0 !important;
}

.md2-card-shell .prose h2 {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  min-width: min(100%, 82%);
  margin: 0 auto 18px !important;
  padding: 14px 28px !important;
  border-radius: 999px !important;
  background: linear-gradient(180deg, #ff9038 0%, #ff6f1a 100%) !important;
  color: #111111 !important;
  font-size: clamp(26px, 3.2vw, 46px) !important;
  font-weight: 900 !important;
  box-shadow: none !important;
}

.md2-card-shell .prose p,
.md2-card-shell .prose li,
.md2-card-shell .prose blockquote {
  font-size: 1.02em;
  line-height: 1.7;
}

.md2-card-shell .markdown-image,
.md2-card-shell .md2-live-embed {
  border-radius: 30px;
}
`;

const blueprintCSS = `.md2-card-shell {
  background-image: radial-gradient(circle at top, rgba(255,255,255,0.6), transparent 40%);
}

.md2-card-shell .prose h1 {
  margin-bottom: 18px !important;
  border-bottom: none !important;
  padding-bottom: 0 !important;
  font-weight: 900 !important;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.md2-card-shell .prose h2 {
  display: inline-block !important;
  background: rgba(14, 165, 233, 0.12) !important;
  color: #0f172a !important;
  border: 1px solid rgba(14, 165, 233, 0.25);
  box-shadow: none !important;
}

.md2-card-shell .prose table {
  border-radius: 20px;
  overflow: hidden;
}
`;

export const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: 'sky-cover',
    name: '蓝天封面',
    description: '接近示例图的蓝天背景、白色圆角卡片与橙色强调条。',
    patch: {
      enableBackground: true,
      backgroundType: 'gradient',
      backgroundValue: 'linear-gradient(180deg, #6eb2ff 0%, #dbeeff 100%)',
      gradientStart: '#6eb2ff',
      gradientEnd: '#dbeeff',
      gradientAngle: 180,
      backgroundColor: '#ffffff',
      cardBackgroundType: 'solid',
      accentColor: '#ff7a1a',
      h1Color: '#05070b',
      h1LineColor: '#05070b',
      h2Color: '#111111',
      h2BackgroundColor: '#ff7a1a',
      h3Color: '#05070b',
      h3LineColor: '#ff7a1a',
      textColor: '#111111',
      blockquoteBackgroundColor: '#fff7ed',
      blockquoteBorderColor: '#ff7a1a',
      calloutBackgroundColor: '#ffffff',
      calloutBorderColor: '#93c5fd',
      calloutTitleColor: '#0f172a',
      calloutTextColor: '#0f172a',
      borderRadius: 42,
      padding: 42,
      contentPadding: 36,
      cardPadding: { top: 42, right: 42, bottom: 42, left: 42 },
      cardPaddingSync: true,
      fontSize: 22,
      h1FontSize: 72,
      h2FontSize: 36,
      h3FontSize: 28,
      underlineColor: '#ff7a1a',
      highlightColor: '#fde68a',
      shadowEnabled: true,
      shadow: '0 30px 70px -28px rgba(30, 64, 175, 0.28)',
      shadowConfig: {
        x: 0,
        y: 30,
        blur: 70,
        spread: -28,
        color: '#1e40af',
        opacity: 0.28,
      },
      customCSS: skyCoverCSS,
    },
  },
  {
    id: 'blueprint-board',
    name: '白板蓝图',
    description: '适合配合 Excalidraw / Draw.io 的轻蓝白板视觉。',
    patch: {
      enableBackground: true,
      backgroundType: 'gradient',
      backgroundValue: 'linear-gradient(135deg, #dff4ff 0%, #b8d7ff 100%)',
      gradientStart: '#dff4ff',
      gradientEnd: '#b8d7ff',
      gradientAngle: 135,
      backgroundColor: '#fefefe',
      cardBackgroundType: 'gradient',
      cardGradientStart: '#ffffff',
      cardGradientEnd: '#f8fbff',
      cardGradientAngle: 180,
      cardGradientValue: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
      accentColor: '#0ea5e9',
      h1Color: '#0f172a',
      h1LineColor: '#38bdf8',
      h2Color: '#0f172a',
      h2BackgroundColor: '#e0f2fe',
      h3Color: '#0f172a',
      h3LineColor: '#0ea5e9',
      textColor: '#0f172a',
      borderRadius: 34,
      padding: 30,
      contentPadding: 30,
      cardPadding: { top: 34, right: 34, bottom: 34, left: 34 },
      cardPaddingSync: true,
      fontSize: 18,
      h1FontSize: 46,
      h2FontSize: 24,
      h3FontSize: 22,
      shadowEnabled: true,
      shadow: '0 22px 60px -30px rgba(14, 165, 233, 0.32)',
      shadowConfig: {
        x: 0,
        y: 22,
        blur: 60,
        spread: -30,
        color: '#0ea5e9',
        opacity: 0.32,
      },
      customCSS: blueprintCSS,
    },
  },
];

export const getStyleTemplateById = (id: string) => STYLE_TEMPLATES.find((template) => template.id === id);
