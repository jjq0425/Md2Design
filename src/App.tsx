import { useEffect } from 'react';
import { useStore } from './store';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';

import { injectAllLocalFonts } from './utils/fonts';

function App() {
  const { theme, cardStyle } = useStore();
  const { undo, redo } = useStore.temporal.getState();

  useEffect(() => {
    fetch('fonts.json')
      .then(res => res.json())
      .then(fonts => {
        injectAllLocalFonts(fonts);
      })
      .catch(err => console.error('Failed to load fonts:', err));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const styleId = 'custom-fonts-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const getFormat = (url: string) => {
      if (url.startsWith('data:')) {
        const mime = url.slice(5, url.indexOf(';'));
        if (mime.includes('woff2')) return 'woff2';
        if (mime.includes('woff')) return 'woff';
        if (mime.includes('otf') || mime.includes('opentype')) return 'opentype';
        if (mime.includes('ttf') || mime.includes('truetype')) return 'truetype';
        return 'truetype';
      }

      const lower = url.toLowerCase();
      if (lower.endsWith('.woff2')) return 'woff2';
      if (lower.endsWith('.woff')) return 'woff';
      if (lower.endsWith('.otf')) return 'opentype';
      return 'truetype';
    };

    const css = (cardStyle.customFonts || [])
      .map((font) => {
        const format = getFormat(font.url);
        const safeName = font.name.replace(/['"\\]/g, '');
        const fontWeight = font.weight === 'variable' ? '100 900' : 'normal';

        return `@font-face {
          font-family: "${safeName}";
          src: url("${font.url}") format("${format}");
          font-weight: ${fontWeight};
          font-style: normal italic;
          font-display: swap;
        }`;
      })
      .join('\n');

    styleEl.textContent = css;
  }, [cardStyle.customFonts]);

  return (
    <div className={`relative h-screen w-full overflow-hidden font-sans transition-colors duration-500 ${theme === 'dark' ? 'studio-bg text-white' : 'studio-bg-light text-slate-900'}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="ambient-orb ambient-orb-primary" />
        <div className="ambient-orb ambient-orb-secondary" />
        <div className="ambient-orb ambient-orb-tertiary" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.14),transparent_28%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.18),transparent_24%)]" />
      </div>

      <TopBar />

      <div className="relative z-10 h-full w-full overflow-hidden pt-14">
        <Preview />
        <Editor />
        <Sidebar />
      </div>
    </div>
  );
}

export default App;
