/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useRef, useEffect, useState, memo, useMemo, type ReactNode, type CSSProperties, useLayoutEffect, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { useStore, type TextBlockLayout } from '../store';
import { useDebounce } from '../hooks/useDebounce';
import { getCardDimensions } from '../utils/cardUtils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { motion } from 'framer-motion';
import { Rnd } from 'react-rnd';
import { AlignCenter, AlignLeft, AlignRight, Hash, Info, Lightbulb, BadgeCheck, TriangleAlert, ShieldAlert, Sparkles, Quote, Trash2, Maximize2, StretchHorizontal, Crop, Square, Palette, Type, SlidersHorizontal, ChevronDown, PenSquare, Sliders, Globe2, FileText } from 'lucide-react';
import { preprocessMarkdown, extractCalloutMeta } from '../utils/markdownEnhancer';
import { LIVE_EMBED_PRESETS, isSafeEmbedUrl, buildLiveEmbedPosterDataUrl } from '../utils/liveEmbeds';
import { extractPageStyleDirective, resolvePageCardStyle } from '../utils/pageStyles';
import { parseMarkdownBlocks } from '../utils/markdownBlocks';

const BLOCK_GAP = 18;
const PAGE_LAYOUT_KEY = '__page__';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getCodeLanguage = (className?: string) => {
  const match = className?.match(/language-([\w-]+)/i);
  return (match?.[1] || 'text').toLowerCase();
};

const highlightCodeLine = (line: string, language: string, enabled: boolean) => {
  if (!enabled) return [{ text: line, className: '' }];
  const rules: Array<{ pattern: RegExp; className: string }> = [
    { pattern: /("(?:\\.|[^"])*"|'(?:\\.|[^'])*')/g, className: 'text-amber-300' },
    { pattern: /\b(\d+(?:\.\d+)?)\b/g, className: 'text-cyan-300' },
    { pattern: /\b(true|false|null|undefined)\b/g, className: 'text-violet-300' },
    { pattern: /\b(import|from|export|default|return|if|else|for|while|switch|case|break|continue|const|let|var|function|class|new|await|async|try|catch|throw)\b/g, className: 'text-sky-300' },
  ];
  if (language === 'bash' || language === 'shell' || language === 'sh') {
    rules.unshift({ pattern: /(^|\s)(\$[^\n]*)/g, className: 'text-emerald-300' });
  }

  const matches: Array<{ start: number; end: number; className: string }> = [];
  rules.forEach(({ pattern, className }) => {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(line);
    while (match) {
      const matchText = match[0];
      const captureText = match[1] ?? matchText;
      const index = matchText.indexOf(captureText);
      const start = match.index + Math.max(index, 0);
      const end = start + captureText.length;
      if (captureText.length > 0) matches.push({ start, end, className });
      match = pattern.exec(line);
    }
  });
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: typeof matches = [];
  matches.forEach((token) => {
    const overlap = merged.some((existing) => token.start < existing.end && token.end > existing.start);
    if (!overlap) merged.push(token);
  });
  const segments: Array<{ text: string; className: string }> = [];
  let cursor = 0;
  merged.forEach((token) => {
    if (token.start > cursor) segments.push({ text: line.slice(cursor, token.start), className: '' });
    segments.push({ text: line.slice(token.start, token.end), className: token.className });
    cursor = token.end;
  });
  if (cursor < line.length) segments.push({ text: line.slice(cursor), className: '' });
  return segments.length > 0 ? segments : [{ text: line, className: '' }];
};

const CodeBlockRenderer = ({ codeText, className, cardStyle }: { codeText: string; className?: string; cardStyle: ReturnType<typeof useStore.getState>['cardStyle'] }) => {
  const updateCardStyle = useStore((state) => state.updateCardStyle);
  const [showPanel, setShowPanel] = useState(false);
  const language = getCodeLanguage(className);
  const lines = codeText.replace(/\n$/, '').split('\n');
  const headerTitle = cardStyle.codeBlockTitle?.trim() || `snippet.${language === 'text' ? 'txt' : language}`;

  return (
    <div
      className="group/code relative my-3 overflow-hidden rounded-2xl border border-slate-900/80 bg-[#0a0f1d] font-mono shadow-[0_20px_58px_-36px_rgba(15,23,42,0.78)]"
      onMouseEnter={() => setShowPanel(true)}
      onMouseLeave={() => setShowPanel(false)}
    >
      {(cardStyle.codeShowTitle || cardStyle.codeShowLineNumbers || cardStyle.codeSyntaxHighlight) && (
        <div className="flex items-center justify-between border-b border-slate-700/60 bg-[#111827] px-3 py-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
            {cardStyle.codeShowTitle && <span className="ml-1 font-semibold tracking-wide text-slate-200">{headerTitle}</span>}
          </div>
          <span className="uppercase tracking-wider text-slate-400">{language}</span>
        </div>
      )}
      <pre className="overflow-x-auto px-0 py-3 text-[12.5px] leading-6 text-slate-200">
        {lines.map((line, index) => {
          const segments = highlightCodeLine(line, language, cardStyle.codeSyntaxHighlight);
          return (
            <div key={`${index}-${line}`} className="grid min-h-6 grid-cols-[auto_1fr]">
              {cardStyle.codeShowLineNumbers && (
                <span className="select-none border-r border-slate-800/80 px-3 text-right text-slate-500">{index + 1}</span>
              )}
              <span className={`px-4 whitespace-pre ${cardStyle.codeShowLineNumbers ? '' : 'col-span-2'}`}>
                {segments.map((seg, segIndex) => (
                  <span key={`${segIndex}-${seg.text}`} className={seg.className}>{seg.text || ' '}</span>
                ))}
              </span>
            </div>
          );
        })}
      </pre>
      {showPanel && (
        <div className="absolute right-3 top-3 z-20 w-52 rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 text-[11px] text-slate-200 shadow-xl backdrop-blur">
          <p className="mb-2 font-semibold text-slate-100">代码块设置</p>
          <label className="mb-2 flex items-center justify-between gap-3">
            <span>语法高亮</span>
            <input type="checkbox" checked={cardStyle.codeSyntaxHighlight} onChange={(e) => updateCardStyle({ codeSyntaxHighlight: e.target.checked })} />
          </label>
          <label className="mb-2 flex items-center justify-between gap-3">
            <span>显示标题</span>
            <input type="checkbox" checked={cardStyle.codeShowTitle} onChange={(e) => updateCardStyle({ codeShowTitle: e.target.checked })} />
          </label>
          <label className="mb-2 flex items-center justify-between gap-3">
            <span>显示行号</span>
            <input type="checkbox" checked={cardStyle.codeShowLineNumbers} onChange={(e) => updateCardStyle({ codeShowLineNumbers: e.target.checked })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-300">代码标题</span>
            <input
              type="text"
              value={cardStyle.codeBlockTitle}
              onChange={(e) => updateCardStyle({ codeBlockTitle: e.target.value })}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] outline-none focus:border-sky-500"
            />
          </label>
        </div>
      )}
    </div>
  );
};

const getImageShadow = (image: ReturnType<typeof useStore.getState>['cardImages'][number][number]) => {
  if (!image?.shadowEnabled) return 'none';
  const { x, y, blur, spread, color, opacity } = image.shadow;
  const hex = color.startsWith('#') ? color : '#0f172a';
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = Number.parseInt(normalized.slice(1, 3), 16) || 15;
  const g = Number.parseInt(normalized.slice(3, 5), 16) || 23;
  const b = Number.parseInt(normalized.slice(5, 7), 16) || 42;
  return `${x}px ${y}px ${blur}px ${spread}px rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const LiveEmbedCard = ({
  src,
  title,
  height,
}: {
  src?: string;
  title?: string;
  height?: number;
}) => {
  const preset = LIVE_EMBED_PRESETS.excalidraw;
  const safeSrc = src && isSafeEmbedUrl(src) ? src : preset.previewUrl;
  const safeHeight = Math.max(260, Math.min(height || preset.defaultHeight, 960));

  return (
    <div className="md2-live-embed group overflow-hidden rounded-[28px] border border-sky-200/70 bg-white/80 shadow-[0_24px_60px_-34px_rgba(14,165,233,0.38)]">
      <div className="flex items-center justify-between gap-3 border-b border-sky-100/90 bg-linear-to-r from-sky-50 to-blue-50 px-4 py-3 text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
          <span>{title || preset.defaultTitle}</span>
        </div>
        <a
          href={safeSrc}
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white no-underline transition hover:bg-sky-600"
        >
          打开白板
        </a>
      </div>
      <img
        src={buildLiveEmbedPosterDataUrl(title || preset.defaultTitle, safeSrc)}
        alt={title || preset.defaultTitle}
        className="md2-export-fallback hidden h-full w-full object-cover"
        style={{ height: `${safeHeight}px` }}
      />
      <iframe
        src={safeSrc}
        title={title || preset.defaultTitle}
        className="md2-live-frame block w-full border-0 bg-white"
        style={{ height: `${safeHeight}px` }}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
};

const ToolbarSection = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${active ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'bg-white/75 text-slate-600 hover:bg-white dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900'}`}
  >
    {icon}
    <span>{label}</span>
    <ChevronDown size={12} className={`transition-transform ${active ? 'rotate-180' : ''}`} />
  </button>
);

const DragHandleDots = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {[2, 7, 12].flatMap((x) => [2, 7, 12].map((y) => ({ x, y }))).map((dot) => (
      <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="1.1" fill="currentColor" />
    ))}
  </svg>
);

const ToolbarNumberField = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) => (
  <label className="rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
    <div className="mb-1 flex items-center justify-between font-semibold opacity-60">
      <span>{label}</span>
      {suffix && <span className="font-mono opacity-70">{suffix}</span>}
    </div>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const nextValue = Number(e.target.value);
        if (Number.isNaN(nextValue)) return;
        onChange(nextValue);
      }}
      className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm font-mono outline-none dark:border-white/10"
    />
  </label>
);

const ImageStylePanel = ({
  image,
  onChange,
}: {
  image: ReturnType<typeof useStore.getState>['cardImages'][number][number];
  onChange: (updates: Record<string, unknown>) => void;
}) => (
  <div className="absolute left-1/2 top-full z-[70] mt-3 w-[280px] -translate-x-1/2 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold opacity-70">
      <Sliders size={13} />
      图片样式
    </div>
    <div className="grid grid-cols-2 gap-2">
      <ToolbarNumberField
        label="圆角"
        value={image.borderRadius}
        min={0}
        max={80}
        suffix="px"
        onChange={(value) => onChange({ borderRadius: value })}
      />
      <ToolbarNumberField
        label="边框"
        value={image.borderWidth}
        min={0}
        max={20}
        suffix="px"
        onChange={(value) => onChange({ borderWidth: value })}
      />
      <label className="rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
        <div className="mb-1 flex items-center gap-1 font-semibold opacity-60"><Palette size={12} /> 边框色</div>
        <input
          type="color"
          value={image.borderColor}
          onChange={(e) => onChange({ borderColor: e.target.value })}
          className="h-10 w-full rounded-lg border border-black/10 bg-transparent dark:border-white/10"
        />
      </label>
      <label className="rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
        <div className="mb-2 flex items-center justify-between font-semibold opacity-60">
          <span>阴影</span>
          <button
            type="button"
            onClick={() => onChange({ shadowEnabled: !image.shadowEnabled })}
            className={`relative h-5 w-9 rounded-full transition ${image.shadowEnabled ? 'bg-sky-500' : 'bg-slate-200 dark:bg-white/10'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${image.shadowEnabled ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>
        <input
          type="color"
          value={image.shadow.color}
          onChange={(e) => onChange({ shadow: { ...image.shadow, color: e.target.value } })}
          className="h-10 w-full rounded-lg border border-black/10 bg-transparent dark:border-white/10"
        />
      </label>
      <ToolbarNumberField
        label="阴影模糊"
        value={image.shadow.blur}
        min={0}
        max={80}
        suffix="px"
        onChange={(value) => onChange({ shadow: { ...image.shadow, blur: value } })}
      />
      <ToolbarNumberField
        label="阴影透明"
        value={Number(image.shadow.opacity.toFixed(2))}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onChange({ shadow: { ...image.shadow, opacity: Number(value.toFixed(2)) } })}
      />
    </div>
  </div>
);

type LayoutScope = 'block' | 'page' | 'all';
type BlockPlacement = 'left' | 'center' | 'right';

const PageTypographyPanel = ({
  layout,
  onApplyTypography,
}: {
  layout: TextBlockLayout;
  onApplyTypography: (scope: 'page' | 'all', updates: Partial<TextBlockLayout>) => void;
}) => {
  const [scope, setScope] = useState<'page' | 'all'>('page');

  return (
    <div className="fixed right-6 top-36 z-[120] w-[320px] rounded-[24px] border border-white/60 bg-white/92 p-3 shadow-[0_26px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold opacity-75">Markdown 文字样式</div>
          <div className="mt-1 text-[11px] opacity-55">可调字号、颜色、粗细、行距与对齐；不支持拖拽位置。</div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50/90 p-2 dark:bg-white/5">
        {[
          { value: 'page', label: '当前页' },
          { value: 'all', label: '全部页' },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setScope(item.value as 'page' | 'all')}
            className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${scope === item.value ? 'bg-slate-900 text-white dark:bg-sky-500' : 'bg-white text-slate-600 dark:bg-slate-950/80 dark:text-slate-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ToolbarNumberField
          label="字号"
          value={layout.fontSize ?? 18}
          min={12}
          max={72}
          suffix="px"
          onChange={(value) => onApplyTypography(scope, { fontSize: value })}
        />
        <ToolbarNumberField
          label="粗细"
          value={layout.fontWeight ?? 500}
          min={300}
          max={900}
          step={100}
          onChange={(value) => onApplyTypography(scope, { fontWeight: value })}
        />
        <label className="rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
          <div className="mb-1 flex items-center gap-1 font-semibold opacity-60"><Palette size={12} /> 颜色</div>
          <input
            type="color"
            value={layout.color ?? '#0f172a'}
            onChange={(e) => onApplyTypography(scope, { color: e.target.value })}
            className="h-10 w-full rounded-lg border border-black/10 bg-transparent dark:border-white/10"
          />
        </label>
        <ToolbarNumberField
          label="行距"
          value={Number((layout.lineHeight ?? 1.55).toFixed(2))}
          min={1}
          max={2.2}
          step={0.05}
          onChange={(value) => onApplyTypography(scope, { lineHeight: Number(value.toFixed(2)) })}
        />
      </div>

      <div className="mt-3 flex gap-2 rounded-2xl bg-slate-50/90 p-2 dark:bg-white/5">
        {[
          { value: 'left', icon: <AlignLeft size={14} />, label: '左对齐' },
          { value: 'center', icon: <AlignCenter size={14} />, label: '居中' },
          { value: 'right', icon: <AlignRight size={14} />, label: '右对齐' },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onApplyTypography(scope, { textAlign: item.value as TextBlockLayout['textAlign'] })}
            className={`flex-1 rounded-xl px-3 py-2 ${layout.textAlign === item.value ? 'bg-sky-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-950/80 dark:text-slate-200'}`}
          >
            <span className="mx-auto flex w-fit items-center gap-1 text-[11px] font-semibold">{item.icon}{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const TextBlockToolbar = ({
  anchor,
  layout,
  onChange,
  onApplyWidth,
  onApplyPlacement,
  onApplyTypography,
  disableSpatialLayout = false,
  hideNumber = false,
}: {
  anchor: DOMRect | null;
  layout: TextBlockLayout;
  onChange: (updates: Partial<TextBlockLayout>) => void;
  onApplyWidth: (scope: LayoutScope, width: number) => void;
  onApplyPlacement: (scope: LayoutScope, placement: BlockPlacement) => void;
  onApplyTypography: (scope: LayoutScope, updates: Partial<TextBlockLayout>) => void;
  disableSpatialLayout?: boolean;
  hideNumber?: boolean;
}) => {
  const [openPanel, setOpenPanel] = useState<'type' | 'layout' | 'number' | null>('type');
  const [typeScope, setTypeScope] = useState<LayoutScope>('block');
  const [layoutScope, setLayoutScope] = useState<LayoutScope>('block');

  if (!anchor) return null;

  const placeAbove = anchor.top > 360;
  const top = placeAbove ? anchor.top - 14 : Math.min(window.innerHeight - 24, anchor.bottom + 14);
  const left = clamp(anchor.left + anchor.width / 2, 180, window.innerWidth - 180);

  return createPortal(
    <div
      className={`fixed z-[160] -translate-x-1/2 rounded-[24px] border border-white/60 bg-white/88 p-2 shadow-[0_26px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/86 ${placeAbove ? '-translate-y-full' : ''}`}
      style={{ top, left, maxHeight: 'min(62vh, 480px)', overflowY: 'auto' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarSection icon={<Type size={13} />} label="文字" active={openPanel === 'type'} onClick={() => setOpenPanel(openPanel === 'type' ? null : 'type')} />
        <ToolbarSection icon={<SlidersHorizontal size={13} />} label="布局" active={openPanel === 'layout'} onClick={() => setOpenPanel(openPanel === 'layout' ? null : 'layout')} />
        {!hideNumber && <ToolbarSection icon={<Hash size={13} />} label="序号" active={openPanel === 'number'} onClick={() => setOpenPanel(openPanel === 'number' ? null : 'number')} />}
      </div>

      {openPanel === 'type' && (
        <div className="mt-2 grid min-w-[340px] grid-cols-2 gap-2 rounded-2xl bg-slate-50/90 p-2 dark:bg-white/5">
          <div className="col-span-2 rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold opacity-60">文字设置范围</span>
              <span className="opacity-45">字号 / 行距支持按页或全部统一</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'block', label: '当前块' },
                { value: 'page', label: '当前页' },
                { value: 'all', label: '全部' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTypeScope(item.value as LayoutScope)}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${typeScope === item.value ? 'bg-slate-900 text-white dark:bg-sky-500' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-200'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <ToolbarNumberField
            label="字号"
            value={layout.fontSize ?? 20}
            min={12}
            max={72}
            suffix="px"
            onChange={(value) => onApplyTypography(typeScope, { fontSize: value })}
          />
          <ToolbarNumberField
            label="粗细"
            value={layout.fontWeight ?? 500}
            min={300}
            max={900}
            step={100}
            onChange={(value) => onApplyTypography(typeScope, { fontWeight: value })}
          />
          <label className="rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
            <div className="mb-1 flex items-center gap-1 font-semibold opacity-60"><Palette size={12} /> 颜色</div>
            <input
              type="color"
              value={layout.color ?? '#0f172a'}
              onChange={(e) => onApplyTypography(typeScope, { color: e.target.value })}
              className="h-10 w-full rounded-lg border border-black/10 bg-transparent dark:border-white/10"
            />
          </label>
          <ToolbarNumberField
            label="行距"
            value={Number((layout.lineHeight ?? 1.55).toFixed(2))}
            min={1}
            max={2.2}
            step={0.05}
            onChange={(value) => onApplyTypography(typeScope, { lineHeight: Number(value.toFixed(2)) })}
          />
        </div>
      )}

      {openPanel === 'layout' && (
        <div className="mt-2 grid min-w-[340px] grid-cols-2 gap-2 rounded-2xl bg-slate-50/90 p-2 dark:bg-white/5">
          {!disableSpatialLayout && (
            <>
              <div className="col-span-2 rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold opacity-60">统一布局范围</span>
                  <span className="opacity-45">支持统一设置后再手动微调</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'block', label: '当前块' },
                    { value: 'page', label: '当前页' },
                    { value: 'all', label: '全部' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setLayoutScope(item.value as LayoutScope)}
                      className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition ${layoutScope === item.value ? 'bg-slate-900 text-white dark:bg-sky-500' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-200'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="col-span-2 rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold opacity-60">块宽度</span>
                  <span className="opacity-45">{layoutScope === 'block' ? '仅当前块' : layoutScope === 'page' ? '整页统一' : '全部统一'}</span>
                </div>
                <input
                  type="number"
                  min={180}
                  max={960}
                  step={10}
                  value={layout.width ?? 320}
                  onChange={(e) => {
                    const nextWidth = Number(e.target.value);
                    if (Number.isNaN(nextWidth)) return;
                    onApplyWidth(layoutScope, nextWidth);
                  }}
                  className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm font-mono outline-none dark:border-white/10"
                />
                <div className="mt-1 text-right font-mono">{layout.width ?? 320}px</div>
              </label>

              <div className="col-span-2 rounded-xl bg-white/90 p-2 dark:bg-slate-950/80">
                <div className="mb-2 text-[11px] font-semibold opacity-60">块在画布中的位置</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'left', icon: <AlignLeft size={14} />, label: '靠左' },
                    { value: 'center', icon: <AlignCenter size={14} />, label: '居中' },
                    { value: 'right', icon: <AlignRight size={14} />, label: '靠右' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        onApplyPlacement(layoutScope, item.value as BlockPlacement);
                      }}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-sky-500/15 dark:hover:text-sky-200"
                    >
                      <span className="mx-auto flex w-fit items-center gap-1">{item.icon}{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="col-span-2 flex gap-2 rounded-xl bg-white/90 p-2 dark:bg-slate-950/80">
            {[
              { value: 'left', icon: <AlignLeft size={14} /> },
              { value: 'center', icon: <AlignCenter size={14} /> },
              { value: 'right', icon: <AlignRight size={14} /> },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onChange({ textAlign: item.value as TextBlockLayout['textAlign'] })}
                className={`flex-1 rounded-xl px-3 py-2 ${layout.textAlign === item.value ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-200'}`}
              >
                <span className="mx-auto flex w-fit items-center gap-1 text-[11px] font-semibold">{item.icon}{item.value === 'left' ? '文字左对齐' : item.value === 'center' ? '文字居中' : '文字右对齐'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!hideNumber && openPanel === 'number' && (
        <div className="mt-2 min-w-[320px] rounded-2xl bg-slate-50/90 p-2 dark:bg-white/5">
          <label className="flex items-center justify-between rounded-xl bg-white/90 px-3 py-3 text-[11px] dark:bg-slate-950/80">
            <div>
              <div className="font-semibold opacity-75">显示序号标签</div>
              <div className="mt-0.5 opacity-55">适合封面标题、步骤块、Notion 风格编号。</div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ showNumber: !layout.showNumber })}
              className={`relative h-6 w-11 rounded-full transition ${layout.showNumber ? 'bg-sky-500' : 'bg-slate-200 dark:bg-white/10'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${layout.showNumber ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
          <label className="mt-2 block rounded-xl bg-white/90 px-3 py-2 text-[11px] dark:bg-slate-950/80">
            <div className="mb-1 font-semibold opacity-60">序号内容</div>
            <input
              type="text"
              value={layout.numberLabel ?? ''}
              placeholder="例如 01 / A1 / Step 1"
              onChange={(e) => onChange({ numberLabel: e.target.value })}
              className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm outline-none dark:border-white/10"
            />
          </label>
        </div>
      )}
    </div>,
    document.body,
  );
};

const buildMarkdownComponents = (cardStyle: ReturnType<typeof useStore.getState>['cardStyle'], blockLayout: TextBlockLayout) => {
  const headingCounters = { h1: 0, h2: 0, h3: 0 };
  const blockColor = blockLayout.color || undefined;
  const blockFontSize = blockLayout.fontSize;
  const blockWeight = blockLayout.fontWeight;
  const blockLineHeight = blockLayout.lineHeight;
  const blockAlign = blockLayout.textAlign;

  const getHeadingNumber = (level: 1 | 2 | 3) => {
    if (level === 1) {
      headingCounters.h1 += 1;
      headingCounters.h2 = 0;
      headingCounters.h3 = 0;
      return `${headingCounters.h1}`.padStart(2, '0');
    }
    if (level === 2) {
      headingCounters.h2 += 1;
      headingCounters.h3 = 0;
      return `${headingCounters.h1 || 1}.${headingCounters.h2}`;
    }
    headingCounters.h3 += 1;
    return `${headingCounters.h1 || 1}.${headingCounters.h2 || 1}.${headingCounters.h3}`;
  };

  const renderHeadingNumber = (level: 1 | 2 | 3) => {
    if (!cardStyle.headingNumbering?.enabled) return null;
    const number = getHeadingNumber(level);
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1 leading-none text-[0.62em] font-black tabular-nums tracking-[0.08em] shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)]"
        style={{
          minWidth: level === 1 ? '3.2em' : 'auto',
          background: `linear-gradient(135deg, ${cardStyle.accentColor} 0%, color-mix(in srgb, ${cardStyle.accentColor} 56%, white) 100%)`,
          color: '#ffffff',
        }}
      >
        {number}
      </span>
    );
  };

  const inheritInlineColor = (style?: CSSProperties) => ({
    color: style?.color || 'inherit',
  });

  return {
    h1: ({ node: _node, style, ...props }: any) => (
      <h1
        style={{
          color: blockColor || cardStyle.h1Color || cardStyle.textColor,
          fontSize: `${blockFontSize || cardStyle.h1FontSize}px`,
          fontWeight: blockWeight || 700,
          lineHeight: blockLineHeight,
          textAlign: blockAlign,
          borderBottom: `4px solid ${cardStyle.h1LineColor || cardStyle.accentColor}`,
          ...style,
        }}
        className="flex items-center gap-3 pb-1 first:mt-0"
        {...props}
      >
        {renderHeadingNumber(1)}
        <span>{props.children}</span>
      </h1>
    ),
    h2: ({ node: _node, style, ...props }: any) => (
      <h2
        style={{
          backgroundColor: cardStyle.h2BackgroundColor || cardStyle.accentColor,
          color: blockColor || cardStyle.h2Color || '#fff',
          fontSize: `${blockFontSize || cardStyle.h2FontSize}px`,
          fontWeight: blockWeight || 700,
          lineHeight: blockLineHeight,
          textAlign: blockAlign,
          ...style,
        }}
        className="inline-flex items-center gap-3 rounded-lg px-4 py-1.5 shadow-md first:mt-0"
        {...props}
      >
        {renderHeadingNumber(2)}
        <span>{props.children}</span>
      </h2>
    ),
    h3: ({ node: _node, style, ...props }: any) => (
      <h3
        style={{
          color: blockColor || cardStyle.h3Color || cardStyle.textColor,
          borderLeftColor: cardStyle.h3LineColor || cardStyle.accentColor,
          fontSize: `${blockFontSize || cardStyle.h3FontSize}px`,
          fontWeight: blockWeight || 700,
          lineHeight: blockLineHeight,
          textAlign: blockAlign,
          ...style,
        }}
        className="flex items-center gap-3 border-l-4 pl-3 first:mt-0"
        {...props}
      >
        {renderHeadingNumber(3)}
        <span>{props.children}</span>
      </h3>
    ),
    h4: ({ node: _node, style, ...props }: any) => (
      <h4 style={{ color: blockColor || cardStyle.textColor, fontSize: `${blockFontSize || cardStyle.headingScale * 18}px`, fontWeight: blockWeight || 700, lineHeight: blockLineHeight, textAlign: blockAlign, ...style }} className="font-bold" {...props} />
    ),
    h5: ({ node: _node, style, ...props }: any) => (
      <h5 style={{ color: blockColor || cardStyle.textColor, fontSize: `${blockFontSize || cardStyle.headingScale * 16}px`, fontWeight: blockWeight || 700, lineHeight: blockLineHeight, textAlign: blockAlign, ...style }} className="font-bold" {...props} />
    ),
    h6: ({ node: _node, style, ...props }: any) => (
      <h6 style={{ color: blockColor || cardStyle.textColor, fontSize: `${blockFontSize || cardStyle.headingScale * 14}px`, fontWeight: blockWeight || 700, lineHeight: blockLineHeight, textAlign: blockAlign, ...style }} className="font-bold" {...props} />
    ),
    strong: ({ node: _node, style, ...props }: any) => <strong style={{ ...inheritInlineColor(style), fontWeight: Math.max(blockWeight || 700, 700), ...style }} {...props} />,
    em: ({ node: _node, style, ...props }: any) => <em style={{ ...inheritInlineColor(style), ...style }} {...props} />,
    u: ({ node: _node, style, ...props }: any) => <u style={{ ...inheritInlineColor(style), textDecorationColor: cardStyle.underlineColor || cardStyle.accentColor, ...style }} {...props} />,
    del: ({ node: _node, style, ...props }: any) => <del style={{ ...inheritInlineColor(style), textDecorationColor: cardStyle.strikethroughColor || cardStyle.textColor, opacity: 0.7, ...style }} {...props} />,
    p: ({ node: _node, children, style, ...props }: any) => {
      const isZwnj = Array.isArray(children) ? children.length === 1 && children[0] === '\u200C' : children === '\u200C';
      if (isZwnj) return null;
      const isEmpty = !children || (Array.isArray(children) && children.length === 0);
      return (
        <p
          style={{ color: blockColor || cardStyle.textColor, fontSize: blockFontSize ? `${blockFontSize}px` : 'inherit', fontWeight: blockWeight, lineHeight: blockLineHeight, textAlign: blockAlign, ...style }}
          className="min-h-[1.5em] opacity-95"
          {...props}
        >
          {isEmpty ? '\u00A0' : children}
        </p>
      );
    },
    div: ({ node: _node, style, children, ...props }: any) => {
      if (props['data-live-embed']) {
        return <LiveEmbedCard src={props['data-src']} title={props['data-title']} height={Number(props['data-height'])} />;
      }
      return (
        <div style={{ color: blockColor || cardStyle.textColor, fontSize: blockFontSize ? `${blockFontSize}px` : 'inherit', fontWeight: blockWeight, lineHeight: blockLineHeight, textAlign: blockAlign, ...style }} className="opacity-95" {...props}>
          {children}
        </div>
      );
    },
    span: ({ node: _node, style, children, ...props }: any) => {
      const dataColor = props['data-color'];
      const dataBg = props['data-bg'];
      const dataTag = props['data-tag'];
      const underlineMode = props['data-underline'];
      if (dataTag) {
        return (
          <span
            style={{
              color: dataColor || '#0f172a',
              background: dataBg || 'linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.28) 100%)',
              border: `1px solid ${dataColor || 'rgba(59,130,246,0.28)'}`,
            }}
            className="inline-flex items-center rounded-full px-3 py-1 text-[0.78em] font-semibold tracking-[0.01em] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)]"
            {...props}
          >
            {children}
          </span>
        );
      }
      return (
        <span
          style={{
            color: dataColor || blockColor || style?.color || cardStyle.textColor,
            fontSize: blockFontSize ? `${blockFontSize}px` : 'inherit',
            fontWeight: blockWeight,
            lineHeight: blockLineHeight,
            backgroundColor: dataBg || style?.backgroundColor,
            padding: dataBg ? '0.08em 0.32em' : style?.padding,
            borderRadius: dataBg ? '0.45em' : style?.borderRadius,
            boxDecorationBreak: dataBg ? 'clone' : style?.boxDecorationBreak,
            WebkitBoxDecorationBreak: dataBg ? 'clone' : style?.WebkitBoxDecorationBreak,
            position: underlineMode ? 'relative' : style?.position,
            '--md2-underline-color': cardStyle.underlineColor || cardStyle.accentColor,
            '--md2-underline-thickness': `${cardStyle.underlineThickness || 4}px`,
            '--md2-underline-offset': `${cardStyle.underlineOffset || 2}px`,
            ...style,
          } as CSSProperties}
          className={`${underlineMode ? 'md2-handdrawn-underline' : ''}`}
          {...props}
        >
          {children}
        </span>
      );
    },
    mark: ({ node: _node, style, children, ...props }: any) => (
      <mark
        style={{
          color: cardStyle.highlightTextColor || cardStyle.textColor,
          background: `linear-gradient(${cardStyle.highlightTilt || -2}deg, ${cardStyle.highlightColor || '#fde68a'} 0%, ${cardStyle.highlightColor || '#fde68a'} ${cardStyle.highlightSpread || 65}%, transparent ${Math.min((cardStyle.highlightSpread || 65) + 18, 100)}%)`,
          boxShadow: `inset 0 -0.72em 0 color-mix(in srgb, ${cardStyle.highlightColor || '#fde68a'} 32%, transparent)`,
          ...style,
        }}
        className="rounded-[0.45em] px-[0.32em] py-[0.08em] md2-highlight"
        {...props}
      >
        {children}
      </mark>
    ),
    ul: ({ node: _node, ...props }: any) => <ul style={{ color: blockColor || cardStyle.textColor, fontSize: blockFontSize ? `${blockFontSize}px` : 'inherit', fontWeight: blockWeight, lineHeight: blockLineHeight, textAlign: blockAlign }} className="list-disc !pl-5 space-y-1" {...props} />,
    ol: ({ node: _node, ...props }: any) => <ol style={{ color: blockColor || cardStyle.textColor, fontSize: blockFontSize ? `${blockFontSize}px` : 'inherit', fontWeight: blockWeight, lineHeight: blockLineHeight, textAlign: blockAlign }} className="list-decimal !pl-6 space-y-1" {...props} />,
    li: ({ node: _node, ...props }: any) => <li style={{ fontSize: blockFontSize ? `${blockFontSize}px` : 'inherit', fontWeight: blockWeight, lineHeight: blockLineHeight }} className="marker:opacity-70 [&>p]:inline" {...props} />,
    table: ({ node: _node, ...props }: any) => <div className="overflow-x-auto rounded-lg opacity-90"><table className="w-full text-left text-sm border-collapse border-none" {...props} /></div>,
    thead: ({ node: _node, ...props }: any) => <thead className="bg-black/5 dark:bg-white/10 font-semibold border-none" {...props} />,
    tbody: ({ node: _node, ...props }: any) => <tbody className="border-none" {...props} />,
    tr: ({ node: _node, ...props }: any) => <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-none" {...props} />,
    th: ({ node: _node, ...props }: any) => <th className="p-3 whitespace-nowrap border-none" {...props} />,
    td: ({ node: _node, ...props }: any) => <td className="p-3 border-none" {...props} />,
    hr: () => null,
    pre: ({ node: _node, children }: any) => <>{children}</>,
    blockquote: ({ node: _node, children, ...props }: any) => {
      const childArray = Array.isArray(children) ? children : [children];
      const firstChild = childArray[0];
      let firstChildText = '';
      if (firstChild && typeof firstChild === 'object' && 'props' in firstChild) {
        const nested = (firstChild as any).props?.children;
        if (Array.isArray(nested)) {
          firstChildText = nested.map((item: any) => typeof item === 'string' ? item : item?.props?.children || '').join('');
        } else if (typeof nested === 'string') {
          firstChildText = nested;
        }
      }
      const calloutMeta = extractCalloutMeta((firstChildText || '').trim());
      if (calloutMeta) {
        const iconMap: Record<string, ReactNode> = {
          note: <Info size={16} />,
          info: <Sparkles size={16} />,
          tip: <Lightbulb size={16} />,
          success: <BadgeCheck size={16} />,
          warning: <TriangleAlert size={16} />,
          danger: <ShieldAlert size={16} />,
          important: <ShieldAlert size={16} />,
          question: <Info size={16} />,
          idea: <Lightbulb size={16} />,
          quote: <Quote size={16} />,
          glass: <Sparkles size={16} />,
          check: <BadgeCheck size={16} />,
          tag: <Hash size={16} />,
        };
        const paletteMap: Record<string, { accent: string; surface: string; title: string; variant: 'soft' | 'quote' | 'glass' | 'spotlight' | 'check' | 'tags' }> = {
          note: { accent: '#3b82f6', surface: '#eff6ff', title: 'Note', variant: 'soft' },
          info: { accent: '#0ea5e9', surface: '#ecfeff', title: 'Info', variant: 'soft' },
          tip: { accent: '#14b8a6', surface: '#f0fdfa', title: 'Tip', variant: 'soft' },
          success: { accent: '#22c55e', surface: '#f0fdf4', title: 'Success', variant: 'check' },
          warning: { accent: '#f59e0b', surface: '#fffbeb', title: 'Warning', variant: 'soft' },
          danger: { accent: '#ef4444', surface: '#fef2f2', title: 'Alert', variant: 'soft' },
          important: { accent: '#8b5cf6', surface: '#f5f3ff', title: 'Important', variant: 'spotlight' },
          question: { accent: '#6366f1', surface: '#eef2ff', title: 'Question', variant: 'soft' },
          idea: { accent: '#f97316', surface: '#fff7ed', title: 'Idea', variant: 'spotlight' },
          quote: { accent: '#475569', surface: '#f8fafc', title: 'Quote', variant: 'quote' },
          glass: { accent: '#8b5cf6', surface: 'rgba(255,255,255,0.68)', title: 'Glass', variant: 'glass' },
          check: { accent: '#10b981', surface: '#ecfdf5', title: 'Checklist', variant: 'check' },
          tag: { accent: '#7c3aed', surface: '#f5f3ff', title: 'Tags', variant: 'tags' },
        };
        const palette = paletteMap[calloutMeta.type] || paletteMap.note;
        const cleanedChildren = childArray.slice(1);
        const calloutPadding = cardStyle.calloutPadding || 18;
        const calloutRadius = cardStyle.calloutRadius || 20;
        const accent = cardStyle.calloutBorderColor || palette.accent;
        const backgroundBase = cardStyle.calloutBackgroundColor || palette.surface;
        const titleColor = cardStyle.calloutTitleColor || accent;
        const bodyColor = blockColor || cardStyle.calloutTextColor || cardStyle.textColor;
        const calloutTitle = calloutMeta.title || palette.title;
        const calloutBody = cleanedChildren.length > 0 ? cleanedChildren : (<p className="mb-0 opacity-70">&nbsp;</p>);
        if (palette.variant === 'tags') {
          const rawTagText = [calloutMeta.title, ...cleanedChildren.map((child) => {
            if (typeof child === 'string') return child;
            if (typeof child === 'object' && child && 'props' in child) {
              const nested = (child as any).props?.children;
              return Array.isArray(nested) ? nested.join('') : nested || '';
            }
            return '';
          })].filter(Boolean).join('\n');
          const tags = rawTagText
            .split(/\n|,|，|\/|\|/g)
            .map((item) => item.trim())
            .filter(Boolean);
          return (
            <div
              className="overflow-hidden border relative"
              style={{
                borderRadius: `${calloutRadius}px`,
                borderColor: accent,
                background: `linear-gradient(180deg, ${backgroundBase} 0%, color-mix(in srgb, ${backgroundBase} 72%, white) 100%)`,
              }}
            >
              <div className="relative flex items-center gap-3 font-semibold" style={{ padding: `${Math.max(calloutPadding - 3, 12)}px ${calloutPadding}px 10px`, color: titleColor }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl border" style={{ borderColor: accent, background: 'rgba(255,255,255,0.7)', color: accent }}>
                  {iconMap.tag}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span>{calloutTitle || palette.title}</span>
                  <span className="text-[11px] font-medium opacity-65">支持颜色、加粗与多标签组合</span>
                </div>
              </div>
              <div className="relative flex flex-wrap gap-2 px-5 pb-5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{ color: accent, borderColor: `color-mix(in srgb, ${accent} 35%, white)` }}
                    className="inline-flex items-center rounded-full border bg-white/80 px-3 py-1.5 text-[12px] font-semibold shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        const shellStyle = palette.variant === 'glass'
          ? { background: `linear-gradient(180deg, ${backgroundBase} 0%, rgba(255,255,255,0.28) 100%)`, backdropFilter: 'blur(18px) saturate(135%)', boxShadow: '0 24px 60px -32px rgba(76, 29, 149, 0.4)' }
          : { background: `linear-gradient(180deg, ${backgroundBase} 0%, color-mix(in srgb, ${backgroundBase} 72%, white) 100%)` };
        const headerStyle = palette.variant === 'spotlight'
          ? { background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, transparent) 0%, transparent 100%)`, color: titleColor }
          : { background: palette.variant === 'quote' ? 'transparent' : `linear-gradient(135deg, color-mix(in srgb, ${accent} 12%, transparent) 0%, transparent 100%)`, color: titleColor };
        return (
          <div className={`overflow-hidden border relative ${palette.variant === 'quote' ? 'border-dashed' : ''}`} style={{ borderRadius: `${calloutRadius}px`, borderColor: accent, ...shellStyle }}>
            {palette.variant === 'glass' && <div className="pointer-events-none absolute inset-x-10 top-0 h-20 rounded-full bg-white/50 blur-3xl" />}
            {palette.variant === 'quote' && <div className="pointer-events-none absolute right-5 top-3 text-6xl font-serif opacity-10" style={{ color: accent }}>“</div>}
            <div className={`relative flex items-center gap-3 font-semibold ${palette.variant === 'quote' ? 'pb-0' : ''}`} style={{ padding: `${Math.max(calloutPadding - 3, 12)}px ${calloutPadding}px ${palette.variant === 'quote' ? 0 : Math.max(calloutPadding - 8, 10)}px`, ...headerStyle }}>
              <span className={`flex h-9 w-9 items-center justify-center border ${palette.variant === 'glass' ? 'rounded-[1.1rem]' : 'rounded-2xl'}`} style={{ borderColor: accent, background: palette.variant === 'quote' ? 'transparent' : 'rgba(255,255,255,0.7)', color: accent }}>
                {iconMap[calloutMeta.type] || iconMap.note}
              </span>
              <div className="flex flex-col gap-0.5">
                <span>{calloutTitle}</span>
                {palette.variant === 'check' && <span className="text-[11px] font-medium opacity-65">Notion-style checked block</span>}
                {palette.variant === 'glass' && <span className="text-[11px] font-medium opacity-65">Soft translucent spotlight block</span>}
              </div>
            </div>
            <div className={`relative text-[0.98em] [&>*:last-child]:mb-0 [&>*:first-child]:mt-0 ${palette.variant === 'quote' ? 'italic' : ''}`} style={{ color: bodyColor, lineHeight: blockLineHeight, padding: palette.variant === 'quote' ? `10px ${calloutPadding}px ${calloutPadding}px` : `0 ${calloutPadding}px ${calloutPadding}px` }}>
              {calloutBody}
            </div>
          </div>
        );
      }
      return (
        <blockquote style={{ borderLeft: `4px solid ${cardStyle.blockquoteBorderColor || cardStyle.accentColor}`, backgroundColor: cardStyle.blockquoteBackgroundColor, color: blockColor || cardStyle.textColor, fontSize: blockFontSize ? `${blockFontSize}px` : 'inherit', fontWeight: blockWeight, lineHeight: blockLineHeight, textAlign: blockAlign }} className="rounded-r-lg rounded-bl-sm pl-4 py-2 italic opacity-90 [&>p:last-child]:mb-0 [&>p:first-child]:mt-0" {...props}>
          {children}
        </blockquote>
      );
    },
    a: ({ node: _node, ...props }: any) => <a style={{ color: blockColor || cardStyle.accentColor }} className="underline decoration-auto underline-offset-2 break-all" {...props} />,
    img: ({ node: _node, src, alt, ...props }: any) => {
      if (src === 'spacer' || src?.startsWith('spacer?')) {
        const spacerId = src.includes('id=') ? src.split('id=')[1] : null;
        return <div data-spacer-id={spacerId} className="w-full h-48 bg-transparent my-4 pointer-events-none" />;
      }
      let imgWidth: string | undefined;
      let cleanSrc = src;
      if (src && src.includes('#width=')) {
        const parts = src.split('#width=');
        cleanSrc = parts[0];
        imgWidth = parts[1];
      }
      return <img src={cleanSrc} alt={alt} crossOrigin="anonymous" className="markdown-image" style={{ display: 'block', maxWidth: '100%', width: imgWidth || 'auto', borderRadius: '8px' }} {...props} />;
    },
    code: ({ node: _node, className, children, ...props }: any) => {
      const text = String(children ?? '');
      const isBlock = className?.includes('language-') || text.includes('\n');
      const normalizedInlineCode = text
        .replace(/&#96;|&grave;/gi, '')
        .replace(/^[`｀ˋ´‘’]+|[`｀ˋ´‘’]+$/g, '')
        .trim();
      return !isBlock ? (
        <code
          style={{ backgroundColor: cardStyle.codeBackgroundColor, color: blockColor || '#0f172a' }}
          className="rounded-md border border-black/10 px-2 py-1 text-[0.88em] font-mono tracking-[0.01em] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:border-white/10"
          {...props}
        >
          {normalizedInlineCode}
        </code>
      ) : (
        <CodeBlockRenderer codeText={text} className={className} cardStyle={cardStyle} />
      );
    },
  };
};

const MarkdownBlock = ({ content, cardStyle, layout }: { content: string; cardStyle: ReturnType<typeof useStore.getState>['cardStyle']; layout: TextBlockLayout }) => {
  const enhancedContent = preprocessMarkdown(content);
  const processedContent = enhancedContent.replace(/\n\s*\n/g, '\n\n&zwnj;\n\n');
  const components = useMemo(() => buildMarkdownComponents(cardStyle, layout), [cardStyle, layout]);

  return (
    <div className="prose prose-sm !max-w-none [&>*]:my-0 [&_p+p]:mt-3 [&_ul+*]:mt-3 [&_ol+*]:mt-3 [&_blockquote+*]:mt-3 [&_pre+*]:mt-3 prose-hr:hidden prose-blockquote:before:content-none prose-blockquote:after:content-none prose-blockquote:border-none [&_*]:border-none !prose-quotes-none">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]} components={components as any}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

const FullMarkdownContent = ({
  blocks,
  cardStyle,
  pageLayout,
  textLayoutsForCard,
  cardIndex,
  selectedTextBlock,
  setSelectedTextBlock,
  blockRefs,
}: {
  blocks: ReturnType<typeof parseMarkdownBlocks>;
  cardStyle: ReturnType<typeof useStore.getState>['cardStyle'];
  pageLayout: TextBlockLayout;
  textLayoutsForCard: Record<string, TextBlockLayout>;
  cardIndex: number;
  selectedTextBlock: { cardIndex: number; blockId: string } | null;
  setSelectedTextBlock: (value: { cardIndex: number; blockId: string } | null) => void;
  blockRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) => {
  return (
    <div className="flex flex-col gap-4 pointer-events-auto">
      {blocks.map((block) => {
        const layout = {
          ...pageLayout,
          ...(textLayoutsForCard[block.id] || {}),
        };
        const isSelected = selectedTextBlock?.cardIndex === cardIndex && selectedTextBlock.blockId === block.id;
        return (
          <div
            key={block.id}
            ref={(element) => { blockRefs.current[block.id] = element; }}
            onMouseDown={(event) => {
              if ((event.target as HTMLElement).closest('a, button, input, iframe')) return;
              setSelectedTextBlock({ cardIndex, blockId: block.id });
            }}
            className={`rounded-[20px] px-2 py-1 transition ${isSelected ? 'bg-sky-50/80 ring-1 ring-sky-300 dark:bg-sky-500/10 dark:ring-sky-400/50' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <MarkdownBlock content={block.content} cardStyle={cardStyle} layout={layout} />
          </div>
        );
      })}
    </div>
  );
};

const Card = memo(({
  content,
  index,
  scale,
  width,
  height,
  selectedImageId,
  setSelectedImageId,
  selectedTextBlock,
  setSelectedTextBlock,
  onApplyTextBlockWidth,
  onApplyTextBlockPlacement,
  onApplyTextBlockTypography,
  isEditable,
  resolvedStyle,
}: {
  content: string;
  index: number;
  scale: number;
  width: number;
  height: number;
  selectedImageId: string | null;
  setSelectedImageId: (id: string | null) => void;
  selectedTextBlock: { cardIndex: number; blockId: string } | null;
  setSelectedTextBlock: (value: { cardIndex: number; blockId: string } | null) => void;
  onApplyTextBlockWidth: (cardIndex: number, blockId: string, scope: LayoutScope, width: number) => void;
  onApplyTextBlockPlacement: (cardIndex: number, blockId: string, scope: LayoutScope, placement: BlockPlacement) => void;
  onApplyTextBlockTypography: (cardIndex: number, blockId: string, scope: LayoutScope, updates: Partial<TextBlockLayout>) => void;
  isEditable: boolean;
  resolvedStyle: ReturnType<typeof useStore.getState>['cardStyle'];
}) => {
  const cardStyle = resolvedStyle;
  const cardImages = useStore((state) => state.cardImages);
  const updateCardImage = useStore((state) => state.updateCardImage);
  const removeCardImage = useStore((state) => state.removeCardImage);
  const cardTextLayouts = useStore((state) => state.cardTextLayouts);
  const updateCardTextLayout = useStore((state) => state.updateCardTextLayout);
  const isResetting = useStore((state) => state.isResetting);

  const cardRef = useRef<HTMLDivElement>(null);
  const textWorkspaceRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [toolbarTick, setToolbarTick] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [isSnapX, setIsSnapX] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingTextBlockId, setDraggingTextBlockId] = useState<string | null>(null);

  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  const textLayoutsForCard = useMemo(() => cardTextLayouts[index] || {}, [cardTextLayouts, index]);
  const images = useMemo(() => cardImages[index] || [], [cardImages, index]);
  const centerX = width / 2;
  const availableTextWidth = Math.max(220, width - (cardStyle.cardPadding.left + cardStyle.cardPadding.right));
  const fixedContentHeight = Math.max(120, height - (cardStyle.cardPadding.top + cardStyle.cardPadding.bottom));
  const fullPageLayout = useMemo<TextBlockLayout>(() => ({
    x: 0,
    y: 0,
    width: availableTextWidth,
    fontSize: textLayoutsForCard[PAGE_LAYOUT_KEY]?.fontSize ?? cardStyle.fontSize,
    fontWeight: textLayoutsForCard[PAGE_LAYOUT_KEY]?.fontWeight ?? 500,
    lineHeight: textLayoutsForCard[PAGE_LAYOUT_KEY]?.lineHeight ?? 1.55,
    color: textLayoutsForCard[PAGE_LAYOUT_KEY]?.color ?? cardStyle.textColor,
    textAlign: textLayoutsForCard[PAGE_LAYOUT_KEY]?.textAlign ?? 'left',
    showNumber: false,
    numberLabel: '',
  }), [availableTextWidth, cardStyle.fontSize, cardStyle.textColor, textLayoutsForCard]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const hasSelectedTextBlock = selectedTextBlock?.cardIndex === index && selectedTextBlock.blockId;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImageId) {
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
        removeCardImage(index, selectedImageId);
        setSelectedImageId(null);
      }
      if (e.key === 'Escape' && hasSelectedTextBlock) {
        setSelectedTextBlock(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, index, removeCardImage, setSelectedImageId, selectedTextBlock, setSelectedTextBlock]);

  useLayoutEffect(() => {
    const observers = Object.entries(blockRefs.current).map(([blockId, element]) => {
      if (!element) return null;
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        setMeasuredHeights((current) => {
          const nextHeight = Math.ceil(entry.contentRect.height);
          if (current[blockId] === nextHeight) return current;
          return { ...current, [blockId]: nextHeight };
        });
      });
      resizeObserver.observe(element);
      return resizeObserver;
    }).filter(Boolean) as ResizeObserver[];

    return () => observers.forEach((observer) => observer.disconnect());
  }, [blocks, textLayoutsForCard, cardStyle]);

  const autoPositions = useMemo(() => {
    const positions: Record<string, number> = {};
    let cursorY = 0;
    blocks.forEach((block) => {
      positions[block.id] = cursorY;
      cursorY += (measuredHeights[block.id] ?? 72) + BLOCK_GAP;
    });
    return positions;
  }, [blocks, measuredHeights]);

  const workspaceHeight = useMemo(() => {
    const maxBottom = blocks.reduce((bottom, block) => {
      const layout = textLayoutsForCard[block.id];
      const y = layout?.y ?? autoPositions[block.id] ?? 0;
      const blockHeight = measuredHeights[block.id] ?? 72;
      return Math.max(bottom, y + blockHeight);
    }, 0);
    return Math.max(cardStyle.autoHeight ? 180 : fixedContentHeight, maxBottom + 24);
  }, [autoPositions, blocks, cardStyle.autoHeight, fixedContentHeight, measuredHeights, textLayoutsForCard]);

  useEffect(() => {
    if (selectedTextBlock?.cardIndex !== index) return;

    const updateRect = () => {
      setToolbarTick((tick) => tick + 1);
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [index, selectedTextBlock?.blockId, selectedTextBlock?.cardIndex]);

  const toolbarRect = useMemo(() => {
    if (selectedTextBlock?.cardIndex !== index) return null;
    const element = blockRefs.current[selectedTextBlock.blockId];
    return element ? element.getBoundingClientRect() : null;
  }, [index, measuredHeights, selectedTextBlock, textLayoutsForCard, toolbarTick]);

  useEffect(() => {
    if (!cardRef.current) return;
    const timer = setTimeout(() => {
      images.forEach((image) => {
        if (image.spacerId && image.isAttachedToSpacer) {
          const spacer = cardRef.current?.querySelector(`[data-spacer-id="${image.spacerId}"]`);
          if (spacer) {
            const rect = spacer.getBoundingClientRect();
            const cardRect = cardRef.current?.getBoundingClientRect();
            if (cardRect) {
              const targetX = (rect.left - cardRect.left) + (rect.width / 2) - (image.width / 2);
              const targetY = (rect.top - cardRect.top) + (rect.height / 2) - (image.height / 2);
              if (Math.abs(image.x - targetX) > 0.5 || Math.abs(image.y - targetY) > 0.5) {
                updateCardImage(index, image.id, { x: targetX, y: targetY });
              }
            }
          }
        }
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [content, images, index, updateCardImage]);

  const outerStyle = {
    width: `${width}px`,
    height: cardStyle.autoHeight ? 'auto' : `${height}px`,
    minHeight: cardStyle.autoHeight ? `${workspaceHeight + cardStyle.cardPadding.top + cardStyle.cardPadding.bottom}px` : undefined,
    padding: cardStyle.enableBackground ? `${cardStyle.padding}px` : '0',
    background: 'transparent',
  };

  const innerStyle = {
    fontFamily: ['serif', 'monospace', 'sans-serif', 'cursive', 'fantasy', 'system-ui'].includes(cardStyle.fontFamily)
      ? `${cardStyle.fontFamily}, system-ui, sans-serif`
      : `"${cardStyle.fontFamily}", system-ui, sans-serif`,
    backgroundColor: 'transparent',
    color: cardStyle.textColor,
    fontSize: `${cardStyle.fontSize}px`,
    borderRadius: `${cardStyle.borderRadius}px`,
    borderWidth: `${cardStyle.borderWidth}px`,
    borderColor: cardStyle.borderColor,
    boxShadow: cardStyle.shadow,
    paddingTop: `${cardStyle.cardPadding.top}px`,
    paddingRight: `${cardStyle.cardPadding.right}px`,
    paddingBottom: `${cardStyle.cardPadding.bottom}px`,
    paddingLeft: `${cardStyle.cardPadding.left}px`,
  };

  const renderOuterBackground = () => {
    if (!cardStyle.enableBackground) return null;
    if (cardStyle.backgroundType === 'image' && cardStyle.backgroundImage) {
      return (
        <div className="absolute inset-0 overflow-hidden -z-10 rounded-none pointer-events-none">
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url(${cardStyle.backgroundImage})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
              transform: `translate(${cardStyle.backgroundConfig.x}px, ${cardStyle.backgroundConfig.y}px) scale(${cardStyle.backgroundConfig.scale})`,
              filter: `blur(${cardStyle.backgroundConfig.blur}px)`,
            }}
          />
        </div>
      );
    }
    if (cardStyle.backgroundType === 'gradient') {
      return <div className="absolute inset-0 -z-10 pointer-events-none" style={{ background: cardStyle.backgroundValue }} />;
    }
    return <div className="absolute inset-0 -z-10 pointer-events-none" style={{ background: cardStyle.backgroundValue }} />;
  };

  const renderInnerBackground = () => {
    const type = cardStyle.cardBackgroundType || 'solid';
    const innerRadius = Math.max(0, cardStyle.borderRadius - cardStyle.borderWidth);
    const radiusStyle = { borderRadius: `${innerRadius}px` };
    if (type === 'image' && cardStyle.cardBackgroundImage) {
      return (
        <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none" style={radiusStyle}>
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url(${cardStyle.cardBackgroundImage})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
              transform: `translate(${cardStyle.cardBackgroundConfig.x}px, ${cardStyle.cardBackgroundConfig.y}px) scale(${cardStyle.cardBackgroundConfig.scale})`,
              filter: `blur(${cardStyle.cardBackgroundConfig.blur}px)`,
            }}
          />
        </div>
      );
    }
    if (type === 'gradient') {
      return <div className="absolute inset-0 -z-10 pointer-events-none" style={{ ...radiusStyle, background: cardStyle.cardGradientValue }} />;
    }
    return <div className="absolute inset-0 -z-10 pointer-events-none bg-current" style={{ ...radiusStyle, color: cardStyle.backgroundColor }} />;
  };

  const handleBlockDragStart = (blockId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a, button, input, iframe')) return;
    const workspace = textWorkspaceRef.current;
    if (!workspace) return;

    const blockRef = blockRefs.current[blockId];
    if (!blockRef) return;

    const workspaceRect = workspace.getBoundingClientRect();
    const currentLayout = textLayoutsForCard[blockId] || { x: 0, y: autoPositions[blockId] ?? 0, width: availableTextWidth };
    const offsetX = event.clientX - workspaceRect.left - currentLayout.x;
    const offsetY = event.clientY - workspaceRect.top - currentLayout.y;
    const blockHeight = measuredHeights[blockId] ?? blockRef.offsetHeight ?? 72;
    const blockWidth = currentLayout.width || availableTextWidth;

    setSelectedImageId(null);
    setSelectedTextBlock({ cardIndex: index, blockId });
    setDraggingTextBlockId(blockId);

    const handleMove = (moveEvent: PointerEvent) => {
      const nextX = clamp(moveEvent.clientX - workspaceRect.left - offsetX, 0, Math.max(0, availableTextWidth - blockWidth));
      const nextY = clamp(moveEvent.clientY - workspaceRect.top - offsetY, 0, Math.max(0, workspaceHeight - blockHeight));
      updateCardTextLayout(index, blockId, { x: nextX, y: nextY, width: blockWidth });
    };

    const handleUp = () => {
      setDraggingTextBlockId(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const selectedBlockLayout = selectedTextBlock?.cardIndex === index
    ? ({
      ...fullPageLayout,
      ...(textLayoutsForCard[selectedTextBlock.blockId] || {}),
    } as TextBlockLayout)
    : null;

  return (
    <div style={{ width: width * scale, height: cardStyle.autoHeight ? 'auto' : height * scale, transition: draggingId || draggingTextBlockId ? 'none' : 'all 0.3s ease' }} className="relative flex-shrink-0">
      <div style={{ width, height: cardStyle.autoHeight ? 'auto' : height, transform: `scale(${scale})`, transformOrigin: 'top left', transition: draggingId || draggingTextBlockId ? 'none' : 'transform 0.3s ease' }}>
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`md2-card-shell relative flex flex-col flex-shrink-0 group select-none overflow-hidden ${isResetting && !draggingId && !draggingTextBlockId ? 'transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]' : ''}`}
          style={{
            ...outerStyle,
            ['--md2-h1-size' as string]: `${cardStyle.h1FontSize}px`,
            ['--md2-h2-size' as string]: `${cardStyle.h2FontSize}px`,
            ['--md2-h3-size' as string]: `${cardStyle.h3FontSize}px`,
          }}
          id={`card-${index}`}
          data-page-scope={`card-${index}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedImageId(null);
              setSelectedTextBlock(null);
            }
          }}
        >
          {renderOuterBackground()}
          {cardStyle.customCSS && <style>{cardStyle.customCSS.replace(/:card\b/g, `.md2-card-shell[data-page-scope="card-${index}"]`).replace(/:embed\b/g, `.md2-card-shell[data-page-scope="card-${index}"] .md2-live-embed`)}</style>}
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/40 dark:border-white/10 opacity-80" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-white/40 blur-3xl dark:bg-white/10" />
          <div className="pointer-events-none absolute inset-x-10 bottom-[-18%] h-32 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-300/10" />

          <div className={`relative w-full h-full flex flex-col ${isResetting && !draggingId && !draggingTextBlockId ? 'transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]' : ''}`} style={innerStyle}>
            {renderInnerBackground()}

            <div className="relative z-10 flex-1 pointer-events-none">
              {isEditable ? (
                <div
                  ref={textWorkspaceRef}
                  className="relative pointer-events-auto"
                  style={{ minHeight: `${workspaceHeight}px`, height: cardStyle.autoHeight ? 'auto' : `${fixedContentHeight}px` }}
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelectedImageId(null);
                      setSelectedTextBlock(null);
                    }
                  }}
                >
                  {blocks.map((block) => {
                    const layout = textLayoutsForCard[block.id] || { x: 0, y: autoPositions[block.id] ?? 0, width: availableTextWidth, fontSize: cardStyle.fontSize, fontWeight: 500, lineHeight: 1.55, color: cardStyle.textColor, textAlign: 'left', showNumber: false, numberLabel: '' };
                    const isSelected = selectedTextBlock?.cardIndex === index && selectedTextBlock.blockId === block.id;
                    const blockWidth = clamp(layout.width || availableTextWidth, 180, availableTextWidth);
                    return (
                      <div
                        key={block.id}
                        ref={(element) => { blockRefs.current[block.id] = element; }}
                        className={`md2-text-block absolute cursor-grab rounded-[24px] border transition ${isSelected ? 'border-sky-400 bg-sky-50/70 shadow-[0_18px_50px_-30px_rgba(14,165,233,0.55)] dark:bg-sky-500/10' : 'border-transparent hover:border-black/10 hover:bg-white/35 dark:hover:border-white/10 dark:hover:bg-white/5'} ${draggingTextBlockId === block.id ? 'cursor-grabbing' : ''}`}
                        style={{ left: layout.x || 0, top: layout.y ?? 0, width: blockWidth, padding: '14px 16px' }}
                        onPointerDown={(event) => handleBlockDragStart(block.id, event)}
                        onMouseDown={() => {
                          setSelectedImageId(null);
                          setSelectedTextBlock({ cardIndex: index, blockId: block.id });
                        }}
                      >
                        <div className="md2-text-block-handle pointer-events-none absolute left-3 top-3 text-slate-500">
                          <DragHandleDots />
                        </div>
                        {layout.showNumber && (
                          <div className="mb-3 inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-slate-900/20">
                            {layout.numberLabel || String(blocks.findIndex((item) => item.id === block.id) + 1).padStart(2, '0')}
                          </div>
                        )}
                        <div className="mt-4">
                          <MarkdownBlock content={block.content} cardStyle={cardStyle} layout={layout} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <FullMarkdownContent
                  blocks={blocks}
                  cardStyle={cardStyle}
                  pageLayout={fullPageLayout}
                  textLayoutsForCard={textLayoutsForCard}
                  cardIndex={index}
                  selectedTextBlock={selectedTextBlock}
                  setSelectedTextBlock={setSelectedTextBlock}
                  blockRefs={blockRefs}
                />
              )}
            </div>

            {(cardStyle.watermark?.enabled || cardStyle.pageNumber?.enabled) && (
              <div className="absolute left-0 right-0 bottom-0 flex items-center pointer-events-none z-20" style={{ height: `${cardStyle.cardPadding.bottom}px`, paddingLeft: `${cardStyle.cardPadding.left}px`, paddingRight: `${cardStyle.cardPadding.right}px` }}>
                <div className="flex-1 flex justify-start items-center gap-3">
                  {cardStyle.pageNumber?.enabled && cardStyle.pageNumber.position === 'left' && <span style={{ opacity: cardStyle.pageNumber.opacity, fontSize: `${cardStyle.pageNumber.fontSize}px`, color: cardStyle.pageNumber.color || cardStyle.textColor, fontFamily: 'inherit', fontWeight: 'bold' }}>{index + 1}</span>}
                  {cardStyle.watermark?.enabled && cardStyle.watermark.position === 'left' && <span style={{ opacity: cardStyle.watermark.opacity, fontSize: `${cardStyle.watermark.fontSize}px`, color: cardStyle.watermark.color || cardStyle.textColor, fontFamily: 'inherit', textTransform: cardStyle.watermark.uppercase ? 'uppercase' : 'none', letterSpacing: '0.05em' }}>{cardStyle.watermark.content}</span>}
                </div>
                <div className="flex-1 flex justify-center items-center gap-3">
                  {cardStyle.pageNumber?.enabled && cardStyle.pageNumber.position === 'center' && <span style={{ opacity: cardStyle.pageNumber.opacity, fontSize: `${cardStyle.pageNumber.fontSize}px`, color: cardStyle.pageNumber.color || cardStyle.textColor, fontFamily: 'inherit', fontWeight: 'bold' }}>{index + 1}</span>}
                  {cardStyle.watermark?.enabled && cardStyle.watermark.position === 'center' && <span style={{ opacity: cardStyle.watermark.opacity, fontSize: `${cardStyle.watermark.fontSize}px`, color: cardStyle.watermark.color || cardStyle.textColor, fontFamily: 'inherit', textTransform: cardStyle.watermark.uppercase ? 'uppercase' : 'none', letterSpacing: '0.05em' }}>{cardStyle.watermark.content}</span>}
                </div>
                <div className="flex-1 flex justify-end items-center gap-3">
                  {cardStyle.pageNumber?.enabled && cardStyle.pageNumber.position === 'right' && <span style={{ opacity: cardStyle.pageNumber.opacity, fontSize: `${cardStyle.pageNumber.fontSize}px`, color: cardStyle.pageNumber.color || cardStyle.textColor, fontFamily: 'inherit', fontWeight: 'bold' }}>{index + 1}</span>}
                  {cardStyle.watermark?.enabled && cardStyle.watermark.position === 'right' && <span style={{ opacity: cardStyle.watermark.opacity, fontSize: `${cardStyle.watermark.fontSize}px`, color: cardStyle.watermark.color || cardStyle.textColor, fontFamily: 'inherit', textTransform: cardStyle.watermark.uppercase ? 'uppercase' : 'none', letterSpacing: '0.05em' }}>{cardStyle.watermark.content}</span>}
                </div>
              </div>
            )}

            {isSnapX && <div className="absolute top-0 bottom-0 w-px bg-blue-500/50 z-[100] pointer-events-none" style={{ height: '100%', left: `${centerX}px`, transform: 'translateX(-0.5px)' }} />}

            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
              {images.filter((img) => img.src && img.src.length > 0).map((image) => (
                <Rnd
                  key={image.id}
                  size={{ width: image.width, height: image.height }}
                  position={{ x: image.x, y: image.y }}
                  onDragStart={() => {
                    setDraggingId(image.id);
                    if (image.isAttachedToSpacer) updateCardImage(index, image.id, { isAttachedToSpacer: false });
                  }}
                  onDrag={(_e, d) => {
                    const imageCenterX = d.x + (image.width / 2);
                    let newX = d.x;
                    const isSnapped = Math.abs(imageCenterX - centerX) < 10;
                    if (isSnapped) newX = centerX - (image.width / 2);
                    updateCardImage(index, image.id, { x: newX, y: d.y });
                    setIsSnapX(isSnapped);
                  }}
                  onDragStop={(_e, d) => {
                    setDraggingId(null);
                    setIsSnapX(false);
                    const imageCenterX = d.x + (image.width / 2);
                    const finalX = Math.abs(imageCenterX - centerX) < 10 ? centerX - (image.width / 2) : d.x;
                    updateCardImage(index, image.id, { x: finalX, y: d.y });
                  }}
                  onResizeStart={() => setDraggingId(image.id)}
                  onResize={(_e, _direction, ref, _delta, position) => {
                    const newWidth = parseInt(ref.style.width, 10);
                    const newHeight = parseInt(ref.style.height, 10);
                    if (image.resizeMode === 'none') {
                      const dx = position.x - image.x;
                      const dy = position.y - image.y;
                      updateCardImage(index, image.id, { width: newWidth, height: newHeight, x: position.x, y: position.y, crop: { ...image.crop, x: (image.crop.x || 0) - dx, y: (image.crop.y || 0) - dy } });
                    } else {
                      updateCardImage(index, image.id, { width: newWidth, height: newHeight, ...position });
                    }
                  }}
                  onResizeStop={() => setDraggingId(null)}
                  bounds="parent"
                  className={`pointer-events-auto ${selectedImageId === image.id ? 'z-30' : 'z-20'}`}
                  enableResizing={selectedImageId === image.id}
                  lockAspectRatio={image.resizeMode === 'contain'}
                >
                  <div className={`relative w-full h-full group cursor-move ${selectedImageId === image.id ? 'ring-2 ring-blue-500 bg-blue-500/5' : ''}`} onMouseDown={() => { setSelectedTextBlock(null); setSelectedImageId(image.id); }}>
                    <div
                      className="w-full h-full overflow-hidden pointer-events-none"
                      style={{
                        borderRadius: `${image.borderRadius}px`,
                        border: `${image.borderWidth}px solid ${image.borderColor}`,
                        boxShadow: getImageShadow(image),
                      }}
                    >
                      <img
                        src={image.src}
                        alt=""
                        className="max-w-none"
                        style={{ width: image.resizeMode === 'none' ? 'auto' : '100%', height: image.resizeMode === 'none' ? 'auto' : '100%', objectFit: image.resizeMode === 'none' ? undefined : image.resizeMode, transform: image.resizeMode === 'none' ? `translate(${image.crop.x}px, ${image.crop.y}px) scale(${image.crop.scale})` : `scale(${image.crop.scale})`, transformOrigin: '0 0' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                      />
                    </div>
                    {selectedImageId === image.id && (
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-xl border border-black/5 dark:border-white/10 z-[60] pointer-events-auto">
                        <button onClick={(e) => { e.stopPropagation(); updateCardImage(index, image.id, { resizeMode: 'cover', crop: { x: 0, y: 0, scale: 1 } }); }} className={`p-1.5 rounded-lg transition-colors ${image.resizeMode === 'cover' ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`} title="Cover"><Square size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); const ratio = (image.naturalHeight || 1) / (image.naturalWidth || 1); updateCardImage(index, image.id, { resizeMode: 'contain', height: image.width * ratio, crop: { x: 0, y: 0, scale: 1 } }); }} className={`p-1.5 rounded-lg transition-colors ${image.resizeMode === 'contain' ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`} title="Contain (Keep Ratio)"><Maximize2 size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); updateCardImage(index, image.id, { resizeMode: 'fill', crop: { x: 0, y: 0, scale: 1 } }); }} className={`p-1.5 rounded-lg transition-colors ${image.resizeMode === 'fill' ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`} title="Fill"><StretchHorizontal size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); const naturalWidth = image.naturalWidth || image.width; const initialScale = image.width / naturalWidth; updateCardImage(index, image.id, { resizeMode: 'none', crop: { ...image.crop, scale: initialScale, x: 0, y: 0 } }); }} className={`p-1.5 rounded-lg transition-colors ${image.resizeMode === 'none' ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`} title="Crop Mode (Figma Style)"><Crop size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200" title="Image Style"><Sliders size={16} /></button>
                        <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
                        <button onClick={(e) => { e.stopPropagation(); removeCardImage(index, image.id); setSelectedImageId(null); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    )}
                    {selectedImageId === image.id && (
                      <ImageStylePanel
                        image={image}
                        onChange={(updates) => updateCardImage(index, image.id, updates as any)}
                      />
                    )}
                  </div>
                </Rnd>
              ))}
            </div>
          </div>

          {selectedBlockLayout && (
            <TextBlockToolbar
              anchor={toolbarRect}
              layout={selectedBlockLayout}
              onChange={(updates) => updateCardTextLayout(index, selectedTextBlock!.blockId, updates)}
              onApplyWidth={(scope, nextWidth) => onApplyTextBlockWidth(index, selectedTextBlock!.blockId, scope, nextWidth)}
              onApplyPlacement={(scope, placement) => onApplyTextBlockPlacement(index, selectedTextBlock!.blockId, scope, placement)}
              onApplyTypography={(scope, updates) => onApplyTextBlockTypography(index, selectedTextBlock!.blockId, scope, updates)}
              disableSpatialLayout={!isEditable}
              hideNumber={!isEditable}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
});

Card.displayName = 'Card';

export const Preview = () => {
  const { markdown, setIsScrolled, setActiveCardIndex, cardStyle, isEditorOpen, isSidebarOpen, previewZoom, setPreviewZoom, cardTextLayouts, setCardTextLayouts, blockEditMode, blockEditScope, setBlockEditMode, setBlockEditScope, activeCardIndex } = useStore();
  const debouncedMarkdown = useDebounce(markdown, 300);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedTextBlock, setSelectedTextBlock] = useState<{ cardIndex: number; blockId: string } | null>(null);
  const [showPageTypographyPanel, setShowPageTypographyPanel] = useState(false);
  const { width, height } = getCardDimensions(cardStyle);
  const [autoScale, setAutoScale] = useState(1);
  const scale = previewZoom > 0 ? previewZoom : autoScale;

  useEffect(() => {
    const calculateScale = () => {
      const isDesktop = window.innerWidth >= 1024;
      const editorSpace = (isDesktop && isEditorOpen) ? 448 : 40;
      const sidebarSpace = (isDesktop && isSidebarOpen) ? 398 : 40;
      const horizontalOccupied = editorSpace + sidebarSpace;
      const verticalSpace = 180;
      const availableWidth = Math.max(300, window.innerWidth - horizontalOccupied);
      const availableHeight = Math.max(300, window.innerHeight - verticalSpace);
      const wScale = availableWidth / width;
      const hScale = availableHeight / height;
      let s = cardStyle.autoHeight ? Math.min(wScale, 1) : Math.min(wScale, hScale, 1);
      if (s < 0.2) s = 0.2;
      setAutoScale(s);
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [width, height, isEditorOpen, isSidebarOpen, cardStyle.autoHeight]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && scrollRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const currentScale = previewZoom > 0 ? previewZoom : autoScale;
        setPreviewZoom(Math.max(0.2, Math.min(4, currentScale + delta)));
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [previewZoom, autoScale, setPreviewZoom]);

  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('textarea, input, [contenteditable="true"]'))) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== 'string') return;
          const state = useStore.getState();
          const imageId = crypto.randomUUID();
          const { width: cardWidth } = getCardDimensions(state.cardStyle);
          state.addCardImage(state.activeCardIndex, result, imageId);
          state.updateCardImage(state.activeCardIndex, imageId, { x: Math.max(24, cardWidth * 0.15), y: 48 });
          setSelectedImageId(imageId);
          setSelectedTextBlock(null);
        };
        reader.readAsDataURL(file);
        return;
      }
    };
    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        setIsScrolled(scrollRef.current.scrollTop > 20);
        const cards = document.querySelectorAll('[id^="card-"]');
        let closestCardIndex = 0;
        let minDistance = Infinity;
        const center = window.innerHeight / 2;
        cards.forEach((card, index) => {
          const rect = card.getBoundingClientRect();
          const distance = Math.abs(rect.top + rect.height / 2 - center);
          if (distance < minDistance) {
            minDistance = distance;
            closestCardIndex = index;
          }
        });
        setActiveCardIndex(closestCardIndex);
      }
    };
    const el = scrollRef.current;
    el?.addEventListener('scroll', handleScroll);
    return () => el?.removeEventListener('scroll', handleScroll);
  }, [setIsScrolled, setActiveCardIndex]);

  useEffect(() => {
    if (!blockEditMode) {
      setSelectedTextBlock(null);
    } else {
      setShowPageTypographyPanel(false);
    }
  }, [blockEditMode]);

  useEffect(() => {
    if (blockEditScope === 'page' && selectedTextBlock && selectedTextBlock.cardIndex !== activeCardIndex) {
      setSelectedTextBlock(null);
    }
  }, [activeCardIndex, blockEditScope, selectedTextBlock]);

  const pages = (cardStyle.layoutMode === 'long' ? [debouncedMarkdown] : debouncedMarkdown.split(/\n\s*---\s*\n|^\s*---\s*$/m).filter((page) => page.trim() !== ''))
    .map((page) => {
      const parsed = extractPageStyleDirective(page);
      return { content: parsed.content, styleId: parsed.styleId, resolvedStyle: resolvePageCardStyle(cardStyle, parsed.styleId) };
    });


  const getAvailableTextWidth = (style: ReturnType<typeof useStore.getState>['cardStyle']) => Math.max(220, width - (style.cardPadding.left + style.cardPadding.right));

  const resolvePlacementX = (placement: BlockPlacement, blockWidth: number, availableWidth: number) => {
    if (placement === 'left') return 0;
    if (placement === 'center') return Math.max(0, (availableWidth - blockWidth) / 2);
    return Math.max(0, availableWidth - blockWidth);
  };

  const updateTextLayoutsByScope = (cardIndex: number, blockId: string, scope: LayoutScope, recipe: (existing: TextBlockLayout, availableWidth: number) => TextBlockLayout) => {
    const nextLayouts = structuredClone(cardTextLayouts || {});
    const targetPages = pages.filter((_, pageIndex) => scope === 'all' || pageIndex === cardIndex);

    targetPages.forEach((page) => {
      const realPageIndex = scope === 'all' ? pages.indexOf(page) : cardIndex;
      const blockIds = scope === 'block' ? [blockId] : parseMarkdownBlocks(page.content).map((item) => item.id);
      const availableWidth = getAvailableTextWidth(page.resolvedStyle);

      blockIds.forEach((targetBlockId) => {
        const currentLayout = nextLayouts[realPageIndex]?.[targetBlockId] || cardTextLayouts[realPageIndex]?.[targetBlockId] || { x: 0, y: 0, width: availableWidth };
        const normalizedWidth = clamp(currentLayout.width || availableWidth, 180, availableWidth);
        const nextLayout = recipe({ ...currentLayout, width: normalizedWidth }, availableWidth);
        nextLayouts[realPageIndex] = {
          ...(nextLayouts[realPageIndex] || {}),
          [targetBlockId]: nextLayout,
        };
      });
    });

    setCardTextLayouts(nextLayouts);
  };

  const handleApplyTextBlockWidth = (cardIndex: number, blockId: string, scope: LayoutScope, nextWidth: number) => {
    updateTextLayoutsByScope(cardIndex, blockId, scope, (existing, availableWidth) => {
      const widthValue = clamp(nextWidth, 180, availableWidth);
      return {
        ...existing,
        width: widthValue,
        x: clamp(existing.x ?? 0, 0, Math.max(0, availableWidth - widthValue)),
      };
    });
  };

  const handleApplyTextBlockPlacement = (cardIndex: number, blockId: string, scope: LayoutScope, placement: BlockPlacement) => {
    updateTextLayoutsByScope(cardIndex, blockId, scope, (existing, availableWidth) => {
      const widthValue = clamp(existing.width || availableWidth, 180, availableWidth);
      return {
        ...existing,
        width: widthValue,
        x: resolvePlacementX(placement, widthValue, availableWidth),
      };
    });
  };

  const handleApplyTextBlockTypography = (cardIndex: number, blockId: string, scope: LayoutScope, updates: Partial<TextBlockLayout>) => {
    updateTextLayoutsByScope(cardIndex, blockId, scope, (existing) => ({
      ...existing,
      ...updates,
    }));
  };

  const activePageTypographyLayout = (cardTextLayouts[activeCardIndex]?.[PAGE_LAYOUT_KEY] || {
    x: 0,
    y: 0,
    width,
    fontSize: cardStyle.fontSize,
    fontWeight: 500,
    lineHeight: 1.55,
    color: cardStyle.textColor,
    textAlign: 'left',
    showNumber: false,
    numberLabel: '',
  }) as TextBlockLayout;

  const handleApplyPageTypography = (scope: 'page' | 'all', updates: Partial<TextBlockLayout>) => {
    const nextLayouts = structuredClone(cardTextLayouts || {});
    pages.forEach((_, pageIndex) => {
      if (scope === 'page' && pageIndex !== activeCardIndex) return;
      nextLayouts[pageIndex] = {
        ...(nextLayouts[pageIndex] || {}),
        [PAGE_LAYOUT_KEY]: {
          ...(nextLayouts[pageIndex]?.[PAGE_LAYOUT_KEY] || cardTextLayouts[pageIndex]?.[PAGE_LAYOUT_KEY] || {
            x: 0,
            y: 0,
            width,
            fontSize: cardStyle.fontSize,
            fontWeight: 500,
            lineHeight: 1.55,
            color: cardStyle.textColor,
            textAlign: 'left',
            showNumber: false,
            numberLabel: '',
          }),
          ...updates,
        },
      };
    });
    setCardTextLayouts(nextLayouts);
  };

  const cycleBlockEditMode = () => {
    if (!blockEditMode) {
      setBlockEditScope('page');
      setBlockEditMode(true);
      return;
    }
    if (blockEditScope === 'page') {
      setBlockEditScope('all');
      return;
    }
    setBlockEditMode(false);
    setSelectedTextBlock(null);
  };

  const blockEditLabel = !blockEditMode
    ? '块编辑：关'
    : blockEditScope === 'page'
      ? '块编辑：当前页'
      : '块编辑：全局';

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const paddingLeft = (isDesktop && isEditorOpen) ? '448px' : '2rem';
  const paddingRight = (isDesktop && isSidebarOpen) ? '398px' : '2rem';

  return (
    <div
      ref={scrollRef}
      className="w-full h-full overflow-y-auto pt-24 flex flex-col items-center gap-12 custom-scrollbar pb-32 transition-all duration-300"
      style={{ paddingLeft, paddingRight }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedImageId(null);
          setSelectedTextBlock(null);
        }
      }}
    >
      <div className="sticky top-20 z-30 -mt-8 flex w-full justify-end px-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {!blockEditMode && (
            <button
              type="button"
              onClick={() => setShowPageTypographyPanel((value) => !value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-xl transition ${showPageTypographyPanel ? 'border-emerald-400/70 bg-emerald-500 text-white shadow-emerald-500/25' : 'border-white/40 bg-white/80 text-slate-700 shadow-slate-900/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200'}`}
            >
              <Type size={14} />
              页面文字
            </button>
          )}
          <button
            type="button"
            onClick={cycleBlockEditMode}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-xl transition ${blockEditMode ? 'border-sky-400/60 bg-sky-500 text-white shadow-sky-500/25' : 'border-white/40 bg-white/80 text-slate-700 shadow-slate-900/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-200'}`}
          >
            {!blockEditMode ? <PenSquare size={14} /> : blockEditScope === 'page' ? <FileText size={14} /> : <Globe2 size={14} />}
            {blockEditLabel}
          </button>
        </div>
      </div>

      {!blockEditMode && showPageTypographyPanel && (
        <PageTypographyPanel
          layout={activePageTypographyLayout}
          onApplyTypography={handleApplyPageTypography}
        />
      )}

      {pages.map((page, index) => (
        <Card
          key={index}
          content={page.content}
          index={index}
          scale={scale}
          width={width}
          height={height}
          selectedImageId={selectedImageId}
          setSelectedImageId={setSelectedImageId}
          selectedTextBlock={selectedTextBlock}
          setSelectedTextBlock={setSelectedTextBlock}
          onApplyTextBlockWidth={handleApplyTextBlockWidth}
          onApplyTextBlockPlacement={handleApplyTextBlockPlacement}
          onApplyTextBlockTypography={handleApplyTextBlockTypography}
          isEditable={blockEditMode && (blockEditScope === 'all' || index === activeCardIndex)}
          resolvedStyle={page.resolvedStyle}
        />
      ))}
    </div>
  );
};
