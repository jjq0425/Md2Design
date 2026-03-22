import { useRef, useEffect, useState, memo, useMemo, type ReactNode, type CSSProperties } from 'react';
import { useStore } from '../store';
import { useDebounce } from '../hooks/useDebounce';
import { getCardDimensions } from '../utils/cardUtils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { motion } from 'framer-motion';
import { Rnd } from 'react-rnd';
import { Info, Lightbulb, BadgeCheck, TriangleAlert, ShieldAlert, Sparkles, Quote, Trash2, Maximize2, StretchHorizontal, Crop, Square } from 'lucide-react';
import { preprocessMarkdown, extractCalloutMeta } from '../utils/markdownEnhancer';
import { LIVE_EMBED_PRESETS, isSafeEmbedUrl, buildLiveEmbedPosterDataUrl } from '../utils/liveEmbeds';
import { extractPageStyleDirective, resolvePageCardStyle } from '../utils/pageStyles';

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
    <div className="md2-live-embed group my-5 overflow-hidden rounded-[28px] border border-sky-200/70 bg-white/80 shadow-[0_24px_60px_-34px_rgba(14,165,233,0.38)]">
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

const Card = memo(({
  content,
  index,
  scale,
  width,
  height,
  selectedImageId,
  setSelectedImageId,
  resolvedStyle
}: {
  content: string,
  index: number,
  scale: number,
  width: number,
  height: number,
  selectedImageId: string | null,
  setSelectedImageId: (id: string | null) => void,
  resolvedStyle: ReturnType<typeof useStore.getState>['cardStyle']
}) => {
  const cardStyle = resolvedStyle;
  const cardImages = useStore(state => state.cardImages);
  const updateCardImage = useStore(state => state.updateCardImage);
  const removeCardImage = useStore(state => state.removeCardImage);
  const isResetting = useStore(state => state.isResetting);

  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSnapX, setIsSnapX] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImageId) {
        // Don't delete if we are in an input or textarea
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

        removeCardImage(index, selectedImageId);
        setSelectedImageId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, index, removeCardImage, setSelectedImageId]);

  const centerX = width / 2;

  // Dynamic styles based on settings
  const outerStyle = {
    width: `${width}px`,
    height: cardStyle.autoHeight ? 'auto' : `${height}px`,
    minHeight: cardStyle.layoutMode === 'flexible' ? '100px' : (cardStyle.autoHeight ? `${height}px` : undefined),
    padding: cardStyle.enableBackground ? `${cardStyle.padding}px` : '0',
    background: 'transparent', // Handled by separate layer
  };

  const innerStyle = {
    fontFamily: ['serif', 'monospace', 'sans-serif', 'cursive', 'fantasy', 'system-ui'].includes(cardStyle.fontFamily)
      ? `${cardStyle.fontFamily}, system-ui, sans-serif`
      : `"${cardStyle.fontFamily}", system-ui, sans-serif`,
    backgroundColor: 'transparent', // Handled by separate layer
    color: cardStyle.textColor,
    fontSize: `${cardStyle.fontSize}px`,
    borderRadius: `${cardStyle.borderRadius}px`,
    borderWidth: `${cardStyle.borderWidth}px`,
    borderColor: cardStyle.borderColor,
    boxShadow: cardStyle.shadow,
    paddingTop: `${cardStyle.cardPadding?.top ?? cardStyle.contentPadding}px`,
    paddingRight: `${cardStyle.cardPadding?.right ?? cardStyle.contentPadding}px`,
    paddingBottom: `${cardStyle.cardPadding?.bottom ?? cardStyle.contentPadding}px`,
    paddingLeft: `${cardStyle.cardPadding?.left ?? cardStyle.contentPadding}px`,
  };

  const images = cardImages[index] || [];

  // Sync images with spacers
  useEffect(() => {
    if (!cardRef.current) return;

    // We use a small delay to ensure markdown has rendered and DOM is ready
     const timer = setTimeout(() => {
       images.forEach((image) => {
         if (image.spacerId && image.isAttachedToSpacer) {
           const spacer = cardRef.current?.querySelector(`[data-spacer-id="${image.spacerId}"]`);
          if (spacer) {
            const rect = spacer.getBoundingClientRect();
            const cardRect = cardRef.current?.getBoundingClientRect();

            if (cardRect) {
              // Calculate center position of spacer relative to card
              const targetX = (rect.left - cardRect.left) + (rect.width / 2) - (image.width / 2);
              const targetY = (rect.top - cardRect.top) + (rect.height / 2) - (image.height / 2);

              // Only update if position is significantly different to avoid loops or unnecessary state updates
              if (Math.abs(image.x - targetX) > 0.5 || Math.abs(image.y - targetY) > 0.5) {
                updateCardImage(index, image.id, { x: targetX, y: targetY });
              }
            }
          }
        }
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [content, images, index, updateCardImage, width, height, cardStyle]);

  const enhancedContent = preprocessMarkdown(content);

  // 修复 Markdown 空行渲染问题：使用更通用的方式处理空行，确保连续换行被保留
  const processedContent = enhancedContent.replace(/\n\s*\n/g, '\n\n&zwnj;\n\n');

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
                 filter: `blur(${cardStyle.backgroundConfig.blur}px)`
               }}
             />
          </div>
        );
    } else if (cardStyle.backgroundType === 'gradient') {
        return <div className="absolute inset-0 -z-10 pointer-events-none" style={{ background: cardStyle.backgroundValue }} />;
    } else {
        // Solid
        return <div className="absolute inset-0 -z-10 pointer-events-none" style={{ background: cardStyle.backgroundValue }} />;
    }
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
                 filter: `blur(${cardStyle.cardBackgroundConfig.blur}px)`
               }}
             />
          </div>
        );
     } else if (type === 'gradient') {
        return <div className="absolute inset-0 -z-10 pointer-events-none" style={{ ...radiusStyle, background: cardStyle.cardGradientValue }} />;
     } else {
        // Solid (default)
        return <div className="absolute inset-0 -z-10 pointer-events-none bg-current" style={{ ...radiusStyle, color: cardStyle.backgroundColor }} />;
     }
  };

  const components = useMemo(() => {
    const headingCounters = { h1: 0, h2: 0, h3: 0 };

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

    return ({
    h1: ({ node: _node, style, ...props }: any) => (
      <h1
        style={{
          color: cardStyle.h1Color || cardStyle.textColor,
          fontSize: `${cardStyle.h1FontSize}px`,
          borderBottom: `4px solid ${cardStyle.h1LineColor || cardStyle.accentColor}`,
          ...style
        }}
        className="mb-4 mt-4 flex items-center gap-3 font-bold first:mt-0 pb-1 overflow-visible"
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
          color: cardStyle.h2Color || '#fff',
          fontSize: `${cardStyle.h2FontSize}px`,
          ...style
        }}
        className="mb-4 mt-4 inline-flex items-center gap-3 rounded-lg px-4 py-1.5 shadow-md first:mt-0 overflow-visible"
        {...props}
      >
        {renderHeadingNumber(2)}
        <span>{props.children}</span>
      </h2>
    ),
    h3: ({ node: _node, style, ...props }: any) => (
      <h3
        style={{
          color: cardStyle.h3Color || cardStyle.textColor,
          borderLeftColor: cardStyle.h3LineColor || cardStyle.accentColor,
          fontSize: `${cardStyle.h3FontSize}px`,
          ...style
        }}
        className="mb-4 mt-4 flex items-center gap-3 border-l-4 pl-3 font-bold first:mt-0 overflow-visible"
        {...props}
      >
        {renderHeadingNumber(3)}
        <span>{props.children}</span>
      </h3>
    ),
    h4: ({ node: _node, style, ...props }: any) => (
       <h4
        style={{
          color: cardStyle.textColor,
          fontSize: `${cardStyle.headingScale * 1.125}rem`,
          ...style
        }}
        className="font-bold mb-2 mt-4 first:mt-0"
        {...props}
       />
    ),
    h5: ({ node: _node, style, ...props }: any) => (
       <h5
        style={{
          color: cardStyle.textColor,
          fontSize: `${cardStyle.headingScale * 1}rem`,
          ...style
        }}
        className="font-bold mb-2 mt-4 first:mt-0"
        {...props}
       />
    ),
    h6: ({ node: _node, style, ...props }: any) => (
       <h6
        style={{
          color: cardStyle.textColor,
          fontSize: `${cardStyle.headingScale * 0.875}rem`,
          ...style
        }}
        className="font-bold mb-2 mt-4 first:mt-0"
        {...props}
       />
    ),
    strong: ({ node: _node, style, ...props }: any) => <strong style={{color: cardStyle.textColor, fontWeight: 'bold', ...style}} {...props} />,
    em: ({ node: _node, style, ...props }: any) => <em style={{color: cardStyle.textColor, fontStyle: 'italic', ...style}} {...props} />,
    u: ({ node: _node, style, ...props }: any) => <u style={{color: cardStyle.underlineColor || cardStyle.accentColor, textDecoration: 'underline', ...style}} {...props} />,
    del: ({ node: _node, style, ...props }: any) => <del style={{color: cardStyle.strikethroughColor || cardStyle.textColor, opacity: 0.7, ...style}} {...props} />,
    p: ({ node: _node, children, style, ...props }: any) => {
      // Check if children is just the &zwnj; character
      const isZwnj = Array.isArray(children)
        ? children.length === 1 && children[0] === '\u200C'
        : children === '\u200C';

      if (isZwnj) return null;

      const isEmpty = !children || (Array.isArray(children) && children.length === 0);
      return (
        <p
          style={{ color: cardStyle.textColor, fontSize: 'inherit', ...style }}
          className="mb-4 leading-relaxed opacity-90 first:mt-0 min-h-[1.5em]"
          {...props}
        >
          {isEmpty ? '\u00A0' : children}
        </p>
      );
    },
    div: ({ node: _node, style, children, ...props }: any) => {
       if (props['data-live-embed']) {
         return (
           <LiveEmbedCard
             src={props['data-src']}
             title={props['data-title']}
             height={Number(props['data-height'])}
           />
         );
       }

       const isAlignment = style?.textAlign;
       return (
         <div
           style={{ color: cardStyle.textColor, fontSize: 'inherit', ...style }}
           className={`${isAlignment ? 'my-0' : 'mb-4'} leading-relaxed opacity-90 first:mt-0 min-h-[1.5em]`}
           {...props}
         >
           {children}
         </div>
       );
     },
     span: ({ node: _node, style, children, ...props }: any) => {
       const isAlignment = style?.textAlign;
       const dataColor = props['data-color'];
       const dataBg = props['data-bg'];
       const underlineMode = props['data-underline'];

       return (
         <span
           style={{
             color: dataColor || style?.color || cardStyle.textColor,
             fontSize: 'inherit',
             backgroundColor: dataBg || style?.backgroundColor,
             padding: dataBg ? '0.08em 0.32em' : style?.padding,
             borderRadius: dataBg ? '0.45em' : style?.borderRadius,
             boxDecorationBreak: dataBg ? 'clone' : style?.boxDecorationBreak,
             WebkitBoxDecorationBreak: dataBg ? 'clone' : style?.WebkitBoxDecorationBreak,
             position: underlineMode ? 'relative' : style?.position,
             '--md2-underline-color': cardStyle.underlineColor || cardStyle.accentColor,
             '--md2-underline-thickness': `${cardStyle.underlineThickness || 4}px`,
             '--md2-underline-offset': `${cardStyle.underlineOffset || 2}px`,
             ...style
           } as CSSProperties}
           className={`${isAlignment ? 'block my-0' : ''} leading-relaxed opacity-90 ${underlineMode ? 'md2-handdrawn-underline' : ''}`}
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
           ...style
         }}
         className="rounded-[0.45em] px-[0.32em] py-[0.08em] md2-highlight"
         {...props}
       >
         {children}
       </mark>
     ),
    ul: ({ node: _node, ...props }: any) => <ul style={{color: cardStyle.textColor, fontSize: 'inherit'}} className="mb-4 list-disc list-outside !pl-5 m-0 space-y-1" {...props} />,
    ol: ({ node: _node, ...props }: any) => <ol style={{color: cardStyle.textColor, fontSize: 'inherit'}} className="mb-4 list-decimal list-outside !pl-6 m-0 space-y-1" {...props} />,
    li: ({ node: _node, ...props }: any) => <li style={{ fontSize: 'inherit' }} className="marker:opacity-70 [&>p]:inline" {...props} />,
    table: ({ node: _node, ...props }: any) => <div className="overflow-x-auto mb-6 rounded-lg opacity-90"><table className="w-full text-left text-sm border-collapse border-none" {...props} /></div>,
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
        };

        const paletteMap: Record<string, { accent: string; surface: string; title: string; variant: 'soft' | 'quote' | 'glass' | 'spotlight' | 'check' }> = {
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
        };

        const palette = paletteMap[calloutMeta.type] || paletteMap.note;
        const cleanedChildren = childArray.slice(1);
        const calloutPadding = cardStyle.calloutPadding || 18;
        const calloutRadius = cardStyle.calloutRadius || 20;
        const accent = cardStyle.calloutBorderColor || palette.accent;
        const backgroundBase = cardStyle.calloutBackgroundColor || palette.surface;
        const titleColor = cardStyle.calloutTitleColor || accent;
        const bodyColor = cardStyle.calloutTextColor || cardStyle.textColor;
        const calloutTitle = calloutMeta.title || palette.title;
        const calloutBody = cleanedChildren.length > 0 ? cleanedChildren : (
          <p className="mb-0 opacity-70">&nbsp;</p>
        );

        const shellStyle = palette.variant === 'glass'
          ? {
              background: `linear-gradient(180deg, ${backgroundBase} 0%, rgba(255,255,255,0.28) 100%)`,
              backdropFilter: 'blur(18px) saturate(135%)',
              boxShadow: '0 24px 60px -32px rgba(76, 29, 149, 0.4)',
            }
          : {
              background: `linear-gradient(180deg, ${backgroundBase} 0%, color-mix(in srgb, ${backgroundBase} 72%, white) 100%)`,
            };

        const headerStyle = palette.variant === 'spotlight'
          ? {
              background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, transparent) 0%, transparent 100%)`,
              color: titleColor,
            }
          : {
              background: palette.variant === 'quote'
                ? 'transparent'
                : `linear-gradient(135deg, color-mix(in srgb, ${accent} 12%, transparent) 0%, transparent 100%)`,
              color: titleColor,
            };

        return (
          <div
            className={`my-5 overflow-hidden border relative ${palette.variant === 'quote' ? 'border-dashed' : ''}`}
            style={{
              borderRadius: `${calloutRadius}px`,
              borderColor: accent,
              ...shellStyle,
            }}
          >
            {palette.variant === 'glass' && (
              <div className="pointer-events-none absolute inset-x-10 top-0 h-20 rounded-full bg-white/50 blur-3xl" />
            )}
            {palette.variant === 'quote' && (
              <div className="pointer-events-none absolute right-5 top-3 text-6xl font-serif opacity-10" style={{ color: accent }}>
                “
              </div>
            )}

            <div
              className={`relative flex items-center gap-3 font-semibold ${palette.variant === 'quote' ? 'pb-0' : ''}`}
              style={{
                padding: `${Math.max(calloutPadding - 3, 12)}px ${calloutPadding}px ${palette.variant === 'quote' ? 0 : Math.max(calloutPadding - 8, 10)}px`,
                ...headerStyle,
              }}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center border ${palette.variant === 'glass' ? 'rounded-[1.1rem]' : 'rounded-2xl'}`}
                style={{
                  borderColor: accent,
                  background: palette.variant === 'quote' ? 'transparent' : 'rgba(255,255,255,0.7)',
                  color: accent,
                }}
              >
                {iconMap[calloutMeta.type] || iconMap.note}
              </span>
              <div className="flex flex-col gap-0.5">
                <span>{calloutTitle}</span>
                {palette.variant === 'check' && <span className="text-[11px] font-medium opacity-65">Notion-style checked block</span>}
                {palette.variant === 'glass' && <span className="text-[11px] font-medium opacity-65">Soft translucent spotlight block</span>}
              </div>
            </div>
            <div
              className={`relative text-[0.98em] leading-relaxed [&>*:last-child]:mb-0 [&>*:first-child]:mt-0 ${palette.variant === 'quote' ? 'italic' : ''}`}
              style={{
                color: bodyColor,
                padding: palette.variant === 'quote'
                  ? `10px ${calloutPadding}px ${calloutPadding}px`
                  : `0 ${calloutPadding}px ${calloutPadding}px`,
              }}
            >
              {calloutBody}
            </div>
          </div>
        );
      }

      return (
        <blockquote
          style={{
            borderLeft: `4px solid ${cardStyle.blockquoteBorderColor || cardStyle.accentColor}`,
            backgroundColor: cardStyle.blockquoteBackgroundColor,
            color: cardStyle.textColor,
            fontSize: 'inherit'
          }}
          className="pl-4 py-2 my-4 italic opacity-90 rounded-r-lg rounded-bl-sm [&>p:last-child]:mb-0 [&>p:first-child]:mt-0 break-words before:content-none after:content-none [&_p]:before:content-none [&_p]:after:content-none"
          {...props}
        >
          {children}
        </blockquote>
      );
    },
    a: ({ node: _node, ...props }: any) => <a style={{color: cardStyle.accentColor}} className="underline decoration-auto underline-offset-2 break-all" {...props} />,
    img: ({ node: _node, src, alt, ...props }: any) => {
      if (src === 'spacer' || src?.startsWith('spacer?')) {
        const spacerId = src.includes('id=') ? src.split('id=')[1] : null;
        return (
          <div
            data-spacer-id={spacerId}
            className="w-full h-48 bg-transparent my-4 pointer-events-none"
          />
        );
      }
      let imgWidth: string | undefined;
      let cleanSrc = src;
      if (src && src.includes('#width=')) {
        const parts = src.split('#width=');
        cleanSrc = parts[0];
        imgWidth = parts[1];
      }
      return (
        <img
          src={cleanSrc}
          alt={alt}
          crossOrigin="anonymous"
          className="markdown-image"
          style={{
            display: 'block',
            maxWidth: '100%',
            width: imgWidth || 'auto',
            borderRadius: '8px',
            marginTop: '1rem',
            marginBottom: '1rem'
          }}
          {...props}
        />
      );
    },
    code: ({ node: _node, children, ...props }: any) => {
      const text = String(children ?? '');
      return !text.includes('\n') ? (
        <code style={{ backgroundColor: cardStyle.codeBackgroundColor }} className="rounded px-1.5 py-0.5 text-[0.9em] font-mono border-none" {...props}>
          {children}
        </code>
      ) : (
        <code style={{ backgroundColor: cardStyle.codeBackgroundColor, fontSize: '0.8em' }} className="block rounded-lg p-4 font-mono my-4 overflow-x-auto whitespace-pre-wrap break-words border-none" {...props}>
          {children}
        </code>
      );
    }
    });
  }, [cardStyle]);

  return (
    <div
      style={{
        width: width * scale,
        height: cardStyle.autoHeight ? 'auto' : height * scale,
        transition: draggingId ? 'none' : 'all 0.3s ease'
      }}
      className="relative flex-shrink-0"
    >
      <div
        style={{
          width: width,
          height: cardStyle.autoHeight ? 'auto' : height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          transition: draggingId ? 'none' : 'transform 0.3s ease'
        }}
      >
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`md2-card-shell relative flex flex-col flex-shrink-0 group select-none overflow-hidden ${isResetting && !draggingId ? 'transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]' : ''}`}
          style={outerStyle}
          id={`card-${index}`}
          data-page-scope={`card-${index}`}
          onMouseDown={(e) => {
            // Only deselect if we click exactly on the card background, not on images or toolbars
            if (e.target === e.currentTarget) {
              setSelectedImageId(null);
            }
          }}
        >
          {renderOuterBackground()}
          {cardStyle.customCSS && (
            <style>{cardStyle.customCSS.replace(/:card\b/g, `.md2-card-shell[data-page-scope="card-${index}"]`).replace(/:embed\b/g, `.md2-card-shell[data-page-scope="card-${index}"] .md2-live-embed`)}</style>
          )}
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/40 dark:border-white/10 opacity-80" />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-white/40 blur-3xl dark:bg-white/10" />
          <div className="pointer-events-none absolute inset-x-10 bottom-[-18%] h-32 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-300/10" />

          <div
            ref={contentRef}
            className={`relative w-full h-full flex flex-col ${isResetting && !draggingId ? 'transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]' : ''}`}
            style={innerStyle}
            onMouseDown={(e) => {
              // Also allow deselection when clicking the inner container background
              if (e.target === e.currentTarget) {
                setSelectedImageId(null);
              }
            }}
          >
            {renderInnerBackground()}

            <div className="relative z-10 h-full flex flex-col pointer-events-none">
              <div
                className="prose prose-sm max-w-none flex-1 pointer-events-auto overflow-hidden break-words [&>*:first-child]:mt-0 prose-hr:hidden prose-blockquote:before:content-none prose-blockquote:after:content-none prose-blockquote:border-none [&_*]:border-none !prose-quotes-none"
                onMouseDown={(e) => {
                  // If clicking on prose text area, deselect image
                  if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'P' || (e.target as HTMLElement).tagName === 'DIV') {
                    setSelectedImageId(null);
                  }
                }}
                style={{
                padding: 0,
                maxHeight: cardStyle.autoHeight ? 'none' : '100%',
                fontFamily: 'inherit',
                fontSize: `${cardStyle.fontSize}px`
              }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  rehypePlugins={[rehypeRaw]}
                  components={components}
                >
                  {processedContent}
                </ReactMarkdown>
              </div>
            </div>

            {/* Footer: Watermark and Page Number (Absolute Positioned in Bottom Padding Area) */}
            {(cardStyle.watermark?.enabled || cardStyle.pageNumber?.enabled) && (
              <div
                className="absolute left-0 right-0 bottom-0 flex items-center pointer-events-none z-20"
                style={{
                  height: `${cardStyle.cardPadding.bottom}px`,
                  paddingLeft: `${cardStyle.cardPadding.left}px`,
                  paddingRight: `${cardStyle.cardPadding.right}px`,
                }}
              >
                {/* Left Position */}
                <div className="flex-1 flex justify-start items-center gap-3">
                  {cardStyle.pageNumber?.enabled && cardStyle.pageNumber.position === 'left' && (
                    <span style={{
                      opacity: cardStyle.pageNumber.opacity,
                      fontSize: `${cardStyle.pageNumber.fontSize}px`,
                      color: cardStyle.pageNumber.color || cardStyle.textColor,
                      fontFamily: 'inherit',
                      fontWeight: 'bold'
                    }}>
                      {index + 1}
                    </span>
                  )}
                  {cardStyle.watermark?.enabled && cardStyle.watermark.position === 'left' && (
                    <span style={{
                      opacity: cardStyle.watermark.opacity,
                      fontSize: `${cardStyle.watermark.fontSize}px`,
                      color: cardStyle.watermark.color || cardStyle.textColor,
                      fontFamily: 'inherit',
                      textTransform: cardStyle.watermark.uppercase ? 'uppercase' : 'none',
                      letterSpacing: '0.05em'
                    }}>
                      {cardStyle.watermark.content}
                    </span>
                  )}
                </div>

                {/* Center Position */}
                <div className="flex-1 flex justify-center items-center gap-3">
                  {cardStyle.pageNumber?.enabled && cardStyle.pageNumber.position === 'center' && (
                    <span style={{
                      opacity: cardStyle.pageNumber.opacity,
                      fontSize: `${cardStyle.pageNumber.fontSize}px`,
                      color: cardStyle.pageNumber.color || cardStyle.textColor,
                      fontFamily: 'inherit',
                      fontWeight: 'bold'
                    }}>
                      {index + 1}
                    </span>
                  )}
                  {cardStyle.watermark?.enabled && cardStyle.watermark.position === 'center' && (
                    <span style={{
                      opacity: cardStyle.watermark.opacity,
                      fontSize: `${cardStyle.watermark.fontSize}px`,
                      color: cardStyle.watermark.color || cardStyle.textColor,
                      fontFamily: 'inherit',
                      textTransform: cardStyle.watermark.uppercase ? 'uppercase' : 'none',
                      letterSpacing: '0.05em'
                    }}>
                      {cardStyle.watermark.content}
                    </span>
                  )}
                </div>

                {/* Right Position */}
                <div className="flex-1 flex justify-end items-center gap-3">
                  {cardStyle.pageNumber?.enabled && cardStyle.pageNumber.position === 'right' && (
                    <span style={{
                      opacity: cardStyle.pageNumber.opacity,
                      fontSize: `${cardStyle.pageNumber.fontSize}px`,
                      color: cardStyle.pageNumber.color || cardStyle.textColor,
                      fontFamily: 'inherit',
                      fontWeight: 'bold'
                    }}>
                      {index + 1}
                    </span>
                  )}
                  {cardStyle.watermark?.enabled && cardStyle.watermark.position === 'right' && (
                    <span style={{
                      opacity: cardStyle.watermark.opacity,
                      fontSize: `${cardStyle.watermark.fontSize}px`,
                      color: cardStyle.watermark.color || cardStyle.textColor,
                      fontFamily: 'inherit',
                      textTransform: cardStyle.watermark.uppercase ? 'uppercase' : 'none',
                      letterSpacing: '0.05em'
                    }}>
                      {cardStyle.watermark.content}
                    </span>
                  )}
                </div>
              </div>
            )}

            {isSnapX && (
              <div
                className="absolute top-0 bottom-0 w-px bg-blue-500/50 z-[100] pointer-events-none"
                style={{
                  height: '100%',
                  left: `${centerX}px`,
                  transform: 'translateX(-0.5px)'
                }}
              />
            )}

            {/* Images Layer */}
            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
              {images.filter(img => img.src && img.src.length > 0).map((image) => (
                <Rnd
                  key={image.id}
                  size={{ width: image.width, height: image.height }}
                  position={{ x: image.x, y: image.y }}
                  onDragStart={() => {
                    setDraggingId(image.id);
                    // Detach from spacer when user starts dragging manually
                    if (image.isAttachedToSpacer) {
                      updateCardImage(index, image.id, { isAttachedToSpacer: false });
                    }
                  }}
                  onDrag={(_e, d) => {
                      const imageCenterX = d.x + (image.width / 2);

                      let newX = d.x;
                      const isSnapped = Math.abs(imageCenterX - centerX) < 10;

                      if (isSnapped) {
                        newX = centerX - (image.width / 2);
                      }

                      updateCardImage(index, image.id, { x: newX, y: d.y });
                      setIsSnapX(isSnapped);
                    }}
                    onDragStop={(_e, d) => {
                      setDraggingId(null);
                      setIsSnapX(false);

                      const imageCenterX = d.x + (image.width / 2);

                      const finalX = Math.abs(imageCenterX - centerX) < 10
                        ? centerX - (image.width / 2)
                        : d.x;

                      updateCardImage(index, image.id, { x: finalX, y: d.y });
                    }}
                  onResizeStart={() => setDraggingId(image.id)}
                  onResize={(_e, _direction, ref, _delta, position) => {
                    const newWidth = parseInt(ref.style.width);
                    const newHeight = parseInt(ref.style.height);

                    if (image.resizeMode === 'none') {
                      // Real-time crop compensation
                      const dx = position.x - image.x;
                      const dy = position.y - image.y;

                      updateCardImage(index, image.id, {
                        width: newWidth,
                        height: newHeight,
                        x: position.x,
                        y: position.y,
                        crop: {
                          ...image.crop,
                          x: (image.crop.x || 0) - dx,
                          y: (image.crop.y || 0) - dy
                        }
                      });
                    } else {
                      updateCardImage(index, image.id, {
                        width: newWidth,
                        height: newHeight,
                        ...position,
                      });
                    }
                  }}
                  onResizeStop={() => {
                    setDraggingId(null);
                  }}
                  bounds="parent"
                  className={`pointer-events-auto ${selectedImageId === image.id ? 'z-30' : 'z-20'}`}
                  enableResizing={selectedImageId === image.id}
                  lockAspectRatio={image.resizeMode === 'contain'}
                >
                  <div
                    className={`relative w-full h-full group cursor-move ${selectedImageId === image.id ? 'ring-2 ring-blue-500 bg-blue-500/5' : ''}`}
                    onMouseDown={() => {
                      setSelectedImageId(image.id);
                    }}
                  >
                    <div className="w-full h-full overflow-hidden rounded-sm pointer-events-none">
                      <img
                          src={image.src}
                          alt=""
                          className="max-w-none"
                          style={{
                            width: image.resizeMode === 'none' ? 'auto' : '100%',
                            height: image.resizeMode === 'none' ? 'auto' : '100%',
                            objectFit: image.resizeMode === 'none' ? undefined : image.resizeMode,
                            transform: image.resizeMode === 'none'
                              ? `translate(${image.crop.x}px, ${image.crop.y}px) scale(${image.crop.scale})`
                              : `scale(${image.crop.scale})`,
                            transformOrigin: '0 0',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = '0';
                          }}
                        />
                      </div>

                      {selectedImageId === image.id && (
                        <>
                          {/* Image Toolbar */}
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-xl border border-black/5 dark:border-white/10 z-[60] pointer-events-auto">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCardImage(index, image.id, { resizeMode: 'cover', crop: { x: 0, y: 0, scale: 1 } });
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${image.resizeMode === 'cover' ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`}
                              title="Cover"
                            >
                              <Square size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const ratio = (image.naturalHeight || 1) / (image.naturalWidth || 1);
                                updateCardImage(index, image.id, {
                                  resizeMode: 'contain',
                                  height: image.width * ratio,
                                  crop: { x: 0, y: 0, scale: 1 }
                                });
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${image.resizeMode === 'contain' ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`}
                              title="Contain (Keep Ratio)"
                            >
                              <Maximize2 size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCardImage(index, image.id, { resizeMode: 'fill', crop: { x: 0, y: 0, scale: 1 } });
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${image.resizeMode === 'fill' ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`}
                              title="Fill"
                            >
                              <StretchHorizontal size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Calculate initial scale to match current visual size
                                const naturalWidth = image.naturalWidth || image.width;
                                const initialScale = image.width / naturalWidth;

                                updateCardImage(index, image.id, {
                                  resizeMode: 'none',
                                  crop: {
                                    ...image.crop,
                                    scale: initialScale,
                                    x: 0,
                                    y: 0
                                  }
                                });
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${image.resizeMode === 'none' ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'}`}
                              title="Crop Mode (Figma Style)"
                            >
                              <Crop size={16} />
                            </button>
                            <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCardImage(index, image.id);
                                setSelectedImageId(null);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                      </>
                    )}
                  </div>
                </Rnd>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
});

Card.displayName = 'Card';

export const Preview = () => {
  const { markdown, setIsScrolled, setActiveCardIndex, cardStyle, isEditorOpen, isSidebarOpen, previewZoom, setPreviewZoom } = useStore();
  const debouncedMarkdown = useDebounce(markdown, 300);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const { width, height } = getCardDimensions(cardStyle);
  const [scale, setScale] = useState(1);
  const [autoScale, setAutoScale] = useState(1);

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
    setScale(previewZoom > 0 ? previewZoom : autoScale);
  }, [previewZoom, autoScale]);

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
          state.updateCardImage(state.activeCardIndex, imageId, {
            x: Math.max(24, cardWidth * 0.15),
            y: 48,
          });
          setSelectedImageId(imageId);
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

  const pages = (cardStyle.layoutMode === 'long'
    ? [debouncedMarkdown]
    : debouncedMarkdown.split(/\n\s*---\s*\n|^\s*---\s*$/m).filter(page => page.trim() !== ''))
    .map((page) => {
      const parsed = extractPageStyleDirective(page);
      return {
        content: parsed.content,
        styleId: parsed.styleId,
        resolvedStyle: resolvePageCardStyle(cardStyle, parsed.styleId),
      };
    });

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const paddingLeft = (isDesktop && isEditorOpen) ? '448px' : '2rem';
  const paddingRight = (isDesktop && isSidebarOpen) ? '398px' : '2rem';

  return (
    <div
      ref={scrollRef}
      className="w-full h-full overflow-y-auto pt-24 flex flex-col items-center gap-12 custom-scrollbar pb-32 transition-all duration-300"
      style={{ paddingLeft, paddingRight }}
      onMouseDown={(e) => {
        // If clicking on the main scroll container (empty space), deselect image
        if (e.target === e.currentTarget) {
          setSelectedImageId(null);
        }
      }}
    >
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
          resolvedStyle={page.resolvedStyle}
        />
      ))}
    </div>
  );
};
