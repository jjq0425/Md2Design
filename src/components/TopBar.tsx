import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { useTranslation } from '../i18n';
import { Moon, Sun, Download, Upload, Languages, Info, X, ChevronDown, Check, Github, Sparkles, MessageSquare, Check as CheckIcon, RotateCcw, FileJson, FileImage, Smartphone, MonitorSmartphone, Copy, Send, ExternalLink } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ChangelogModal } from './ChangelogModal';

import logoSvg from '../assets/logo.svg';
import { splitMarkdownPages, extractPageStyleDirective } from '../utils/pageStyles';

type ExportFormat = 'png' | 'jpg';
type ExportScale = 1 | 2 | 3 | 4;
type ExportMode = 'single' | 'multiple';
type ExportTarget = 'folder' | 'zip';
type NamingMode = 'system' | 'custom';
type NamingPart = 'prefix' | 'date' | 'custom' | 'number';

type ExportData = {
  version: string;
  timestamp: number;
  content?: string;
  style?: unknown;
  title?: string;
};

type FileSystemWritableFileStreamLike = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandleLike = {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
};

type FileSystemDirectoryHandleLike = {
  getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<FileSystemFileHandleLike>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>;
};

export const TopBar = () => {
  const { theme, toggleTheme, toggleLanguage, isScrolled, previewZoom, setPreviewZoom, setMarkdown, updateCardStyle, markdown, activeCardIndex } = useStore();
  const t = useTranslation();
  const [showContact, setShowContact] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportType, setExportType] = useState<'image' | 'data'>('image');
  const [dataExportConfig, setDataExportConfig] = useState({
    markdown: true,
    style: true
  });
  const [showChangelog, setShowChangelog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showXhsPreview, setShowXhsPreview] = useState(false);
  const [xhsViewport, setXhsViewport] = useState<'web' | 'mobile'>('web');
  const [xhsPreviewImage, setXhsPreviewImage] = useState<string>('');
  const [isGeneratingXhsPreview, setIsGeneratingXhsPreview] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');

  // Onboarding & Support tooltip logic
  useEffect(() => {
    // Onboarding
    const onboardingTimer = setTimeout(() => {
      setShowOnboarding(true);
    }, 1500);

    return () => {
      clearTimeout(onboardingTimer);
    };
  }, []);

  const closeOnboarding = () => {
    setShowOnboarding(false);
  };

  // Custom Dropdown Component
  const CustomDropdown = <T extends string>({ 
    value, 
    options, 
    onChange, 
    className = "" 
  }: { 
    value: T, 
    options: { id: T, label: string }[], 
    onChange: (val: T) => void,
    className?: string
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(o => o.id === value);

    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-lg p-2 text-xs flex items-center justify-between hover:border-blue-500/30 transition-all"
        >
          <span className="truncate">{selectedOption?.label}</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                className="absolute left-0 right-0 top-full mt-1 z-[101] bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden py-1"
              >
                {options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                      value === option.id 
                        ? 'bg-blue-500 text-white' 
                        : 'text-slate-700 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {option.label}
                    {value === option.id && <CheckIcon size={12} />}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Export Settings
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState<ExportScale>(2);
  const [exportMode, setExportMode] = useState<ExportMode>('multiple');
  const [exportTarget, setExportTarget] = useState<ExportTarget>('zip');
  const [folderName, setFolderName] = useState('cards-export'); 
  const [namingMode, setNamingMode] = useState<NamingMode>('system');
  const [namingParts, setNamingParts] = useState<NamingPart[]>(['prefix', 'date', 'custom', 'number']);
  const [namingConfigs, setNamingConfigs] = useState({
    prefix: 'Md2Design',
    custom: 'MyCard',
    includeTime: true,
    dateFormat: 'dateFormatFull' as 'dateFormatFull' | 'dateFormatShort' | 'dateFormatMDY' | 'dateFormatDMY' | 'dateFormatYMD',
    numberType: 'arabic' as 'arabic' | 'chinese',
    numberOrder: 'asc' as 'asc' | 'desc',
    zeroStart: false,
  });

  const generateFileName = (index: number, total: number) => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const getFormattedDate = () => {
      const yy = now.getFullYear().toString().slice(-2);
      const mm = pad(now.getMonth() + 1);
      const dd = pad(now.getDate());
      
      switch (namingConfigs.dateFormat) {
        case 'dateFormatFull': return `${yy}${mm}${dd}`;
        case 'dateFormatShort': return `${mm}${dd}`;
        case 'dateFormatMDY': return `${mm}${dd}${yy}`;
        case 'dateFormatDMY': return `${dd}${mm}${yy}`;
        case 'dateFormatYMD': return `${yy}${mm}${dd}`;
        default: return `${yy}${mm}${dd}`;
      }
    };

    const dateStr = getFormattedDate();
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}`;
    
    if (namingMode === 'system') {
      return `Md2Design_${dateStr}_${timeStr}_${namingConfigs.custom}_${index + 1}`;
    }

    const parts = namingParts.map(part => {
      switch (part) {
        case 'prefix': return namingConfigs.prefix;
        case 'date': return namingConfigs.includeTime ? `${dateStr}_${timeStr}` : dateStr;
        case 'custom': return namingConfigs.custom;
        case 'number': {
          let num = namingConfigs.numberOrder === 'asc' ? index : (total - 1 - index);
          if (!namingConfigs.zeroStart) num += 1;
          
          if (namingConfigs.numberType === 'chinese') {
            const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
            return num <= 10 ? chineseNums[num] : num.toString();
          }
          return num.toString();
        }
        default: return '';
      }
    });

    return parts.filter(Boolean).join('_');
  };

  const [isExporting, setIsExporting] = useState(false);

  const setExportSnapshotMode = (enabled: boolean) => {
    if (enabled) {
      document.body.setAttribute('data-md2-exporting', 'true');
    } else {
      document.body.removeAttribute('data-md2-exporting');
    }
  };

  const generateCardPreviewBlob = useCallback(async (cardIndex: number) => {
    const target = document.getElementById(`card-${cardIndex}`) as HTMLElement | null;
    if (!target) throw new Error('Card not found');

    setExportSnapshotMode(true);
    try {
      const dataUrl = await toPng(target, { pixelRatio: 2, cacheBust: true });
      const response = await fetch(dataUrl);
      return await response.blob();
    } finally {
      setExportSnapshotMode(false);
    }
  }, []);

  const handleCopyXhsDraft = async () => {
    const text = `${xhsPreviewMeta.title}

${xhsPreviewMeta.excerpt}

${xhsPreviewMeta.hashtags.join(' ')}`;
    await navigator.clipboard.writeText(text);
    setShareFeedback('已复制标题和文案，可直接去小红书/飞书/微信粘贴。');
  };

  const handleShareToPhone = async () => {
    try {
      const blob = await generateCardPreviewBlob(activeCardIndex);
      const file = new File([blob], `${xhsPreviewMeta.title || 'card-preview'}.png`, { type: 'image/png' });
      const shareText = `${xhsPreviewMeta.title}
${xhsPreviewMeta.hashtags.join(' ')}`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: xhsPreviewMeta.title,
          text: shareText,
          files: [file],
        });
        setShareFeedback('已调用系统分享面板，可发送到微信 / QQ / 飞书等支持接收图片的 App。');
      } else {
        saveAs(file);
        await navigator.clipboard.writeText(shareText);
        setShareFeedback('当前浏览器不支持直接分享，已下载图片并复制文案。');
      }
    } catch (error) {
      console.error(error);
      setShareFeedback('发送失败，请改用“导出图片”或移动端浏览器分享。');
    }
  };
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [previewSize, setPreviewSize] = useState<{ single: string, total: string }>({ single: '-', total: '-' });

  const currentPages = useMemo(() => {
    const pages = splitMarkdownPages(markdown);
    return pages.length > 0 ? pages : [markdown];
  }, [markdown]);

  const activePageMarkdown = useMemo(() => {
    const raw = currentPages[Math.min(activeCardIndex, Math.max(currentPages.length - 1, 0))] || markdown;
    return extractPageStyleDirective(raw).content;
  }, [currentPages, activeCardIndex, markdown]);

  const xhsPreviewMeta = useMemo(() => {
    const lines = activePageMarkdown
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('![') && !line.startsWith(':::') && !line.startsWith('>'));

    const heading = lines.find((line) => /^#{1,3}\s+/.test(line))?.replace(/^#{1,3}\s+/, '') || '今天的设计笔记';
    const body = lines
      .map((line) => line.replace(/^#{1,6}\s+/, ''))
      .join(' ')
      .replace(/[*_`>#\-[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      title: heading.slice(0, 20),
      excerpt: body.slice(0, 120) || '把当前卡片内容整理成适合小红书预览和分享的封面图。',
      hashtags: ['#AI设计', '#内容排版', '#小红书封面', '#Md2Design'],
    };
  }, [activePageMarkdown]);

  // Calculate size estimation
  useEffect(() => {
    if (!showExport) return;
    
    const calculateSize = async () => {
      // Find first card for estimation
      const firstCard = document.querySelector('[id^="card-"]') as HTMLElement;
      if (!firstCard) return;

      try {
        setPreviewSize({ single: t.calculating, total: t.calculating });
        
        // Generate sample blob
        const options = { 
            pixelRatio: scale,
            filter: (node: HTMLElement) => !node.classList?.contains('export-ignore')
        };
        
        let blob;
        setExportSnapshotMode(true);
        try {
          if (format === 'png') {
             const dataUrl = await toPng(firstCard, options);
             blob = await (await fetch(dataUrl)).blob();
          } else {
             const dataUrl = await toJpeg(firstCard, { ...options, quality: 0.9 });
             blob = await (await fetch(dataUrl)).blob();
          }
        } finally {
          setExportSnapshotMode(false);
        }

        const singleSize = blob.size / 1024 / 1024; // MB
        const cardCount = document.querySelectorAll('[id^="card-"]').length;
        const totalSize = singleSize * cardCount;

        setPreviewSize({ 
          single: `${singleSize.toFixed(2)} MB`, 
          total: `${totalSize.toFixed(2)} MB`
        });
      } catch (e) {
        console.error(e);
        setPreviewSize({ single: 'Error', total: 'Error' });
      }
    };

    const timer = setTimeout(calculateSize, 500); // Debounce
    return () => clearTimeout(timer);
  }, [showExport, format, scale, t.calculating]);

  useEffect(() => {
    if (!showXhsPreview) return;

    let cancelled = false;
    const renderPreview = async () => {
      setIsGeneratingXhsPreview(true);
      try {
        const blob = await generateCardPreviewBlob(activeCardIndex);
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        setXhsPreviewImage((prev) => {
          if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setIsGeneratingXhsPreview(false);
      }
    };

    renderPreview();
    return () => {
      cancelled = true;
    };
  }, [showXhsPreview, activeCardIndex, markdown, generateCardPreviewBlob]);

  useEffect(() => {
    return () => {
      if (xhsPreviewImage.startsWith('blob:')) {
        URL.revokeObjectURL(xhsPreviewImage);
      }
    };
  }, [xhsPreviewImage]);

  const handleExportData = () => {
    try {
      const state = useStore.getState();
      const data: ExportData = {
        version: '1.0.0',
        timestamp: Date.now(),
      };

      if (dataExportConfig.markdown) {
        data.content = state.markdown;
      }

      if (dataExportConfig.style) {
        data.style = state.cardStyle;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      saveAs(blob, `Md2Design_Backup_${new Date().toISOString().slice(0, 10)}.d2d`);
      
      setShowExport(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Export data failed:', error);
      alert('Export failed');
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.content) {
          setMarkdown(data.content);
        }
        
        if (data.style) {
          // Update style one by one to ensure merge works correctly if needed
          // But here we might want a full replace or deep merge.
          // Store's updateCardStyle usually does a shallow merge on top level, 
          // but for nested objects like 'watermark', we need to be careful.
          // Let's assume the store handles it or we pass the full object.
          // updateCardStyle is: (style) => set((state) => ({ cardStyle: { ...state.cardStyle, ...style } }))
          // So it merges.
          updateCardStyle(data.style);
        }

        alert(t.importSuccess);
      } catch (error) {
        console.error('Import failed:', error);
        alert(t.importError);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const handleExport = async () => {
    if (exportType === 'data') {
      handleExportData();
      return;
    }

    setIsExporting(true);
    setProgress(0);
    try {
        const cards = Array.from(document.querySelectorAll('[id^="card-"]')) as HTMLElement[];
        const options = { 
            pixelRatio: scale,
            filter: (node: HTMLElement) => !node.classList?.contains('export-ignore')
        };
        
        let completed = 0;
        const total = cards.length;
        const updateProgress = () => {
            completed++;
            setProgress(Math.round((completed / total) * 100));
        };

        // Helper to generate blob
        const generateBlob = async (card: HTMLElement) => {
            // Pre-process images to Base64 to avoid html-to-image caching/cloning bugs
            // This is critical for fixing the "all images look like the first one" bug.
            const images = Array.from(card.querySelectorAll('img'));
            const originalSrcs = new Map<HTMLImageElement, string>();

            try {
                await Promise.all(images.map(async (img) => {
                    const src = img.src;
                    if (src.startsWith('data:')) return; // Already base64

                    try {
                        // Keep track to restore later
                        originalSrcs.set(img, src);
                        
                        // Fetch and convert
                        const response = await fetch(src);
                        const blob = await response.blob();
                        const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        
                        img.src = base64;
                    } catch (e) {
                        console.warn('Failed to inline image:', src, e);
                    }
                }));

                let dataUrl;
                const currentOptions = { 
                    ...options, 
                    useCORS: true,
                    skipAutoScale: true
                };

                setExportSnapshotMode(true);
                try {
                  if (format === 'png') {
                      dataUrl = await toPng(card, currentOptions);
                  } else {
                      dataUrl = await toJpeg(card, { ...currentOptions, quality: 0.9 });
                  }
                } finally {
                  setExportSnapshotMode(false);
                }
                const res = await fetch(dataUrl);
                return await res.blob();
            } finally {
                // Restore original src to not break the DOM
                originalSrcs.forEach((src, img) => {
                    img.src = src;
                });
            }
        };

        if (exportMode === 'multiple') {
            const runZipExport = async () => {
                const zip = new JSZip();
                const chunkSize = 3;
                for (let i = 0; i < cards.length; i += chunkSize) {
                    const chunk = cards.slice(i, i + chunkSize);
                    await Promise.all(chunk.map(async (card, idx) => {
                        const globalIdx = i + idx;
                        const blob = await generateBlob(card);
                        zip.file(`${generateFileName(globalIdx, cards.length)}.${format}`, blob);
                        updateProgress();
                    }));
                }
                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `${folderName || 'cards-export'}.zip`);
            };

            // Folder Export (File System Access API)
            const windowWithDirectoryPicker = window as WindowWithDirectoryPicker;
            if (exportTarget === 'folder' && windowWithDirectoryPicker.showDirectoryPicker) {
                try {
                    const dirHandle = await windowWithDirectoryPicker.showDirectoryPicker();
                    let targetHandle = dirHandle;
                    if (folderName) {
                        targetHandle = await dirHandle.getDirectoryHandle(folderName, { create: true });
                    }

                    // Process with concurrency limit
                    const CONCURRENCY = 3;
                    const tasks = cards.map((card, i) => async () => {
                        const blob = await generateBlob(card);
                        const fileName = `${generateFileName(i, cards.length)}.${format}`;
                        const fileHandle = await targetHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        updateProgress();
                    });

                    // Run tasks
                    const running: Promise<void>[] = [];
                    for (const task of tasks) {
                        const p = task().then(() => {
                            running.splice(running.indexOf(p), 1);
                        });
                        running.push(p);
                        if (running.length >= CONCURRENCY) {
                            await Promise.race(running);
                        }
                    }
                    await Promise.all(running);
                } catch (err) {
                    if ((err as Error).name === 'AbortError') {
                        setIsExporting(false);
                        return;
                    }
                    
                    console.error('Directory picker failed, falling back to ZIP', err);
                    // Automatic fallback to ZIP on security error or other issues
                    await runZipExport();
                }
            } else {
                // Default to ZIP for 'zip' target or unsupported browsers
                await runZipExport();
            }
        } else {
            // Direct Download (Single Images)
            // Process sequentially with small delay to prevent browser blocking
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const blob = await generateBlob(card);
                saveAs(blob, `${generateFileName(i, cards.length)}.${format}`);
                updateProgress();
                // Small delay to prevent browser from blocking multiple downloads
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        // Show success
        setShowExport(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);

    } catch (err) {
        console.error('Export failed', err);
    } finally {
        setIsExporting(false);
    }
  };

  const contactLinks = [
    {
      main: '公众号 LuN3cy的实验房',
      sub: '',
      url: 'https://mp.weixin.qq.com/s/sAIYq8gaezAumyIbGHiJ_w',
      color: 'hover:border-[#07C160] hover:bg-[#07C160]/10'
    },
    {
      main: '小红书 LuN3cy',
      sub: '',
      url: 'https://www.xiaohongshu.com/user/profile/61bbb882000000001000e80d',
      color: 'hover:border-[#FF2442] hover:bg-[#FF2442]/10'
    },
    {
      main: 'Bilibili LuN3cy',
      sub: '',
      url: 'https://b23.tv/i42oxgt',
      color: 'hover:border-[#00AEEC] hover:bg-[#00AEEC]/10'
    }
  ];

  return (
    <>
      <div className={`h-14 w-full flex items-center justify-between px-6 shrink-0 z-50 fixed top-0 left-0 transition-all duration-300 ${isScrolled ? 'glass-bar' : 'bg-transparent'}`}>
        <div className="flex items-center gap-4">
          <div className="font-bold text-lg tracking-tight flex items-center gap-2">
             <img src={logoSvg} alt="Logo" className="w-6 h-6" />
             <span className="opacity-90">{t.title}</span>
          </div>


          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChangelog(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold transition-all relative group overflow-hidden"
            >
              {/* Outer soft glow (Diffuse) */}
              <motion.div 
                className="absolute inset-0 rounded-full bg-blue-500/20 blur-md -z-20 pointer-events-none"
                animate={{ 
                  opacity: [0.4, 0.8, 0.4],
                  scale: [1, 1.15, 1]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              
              {/* Inner precise glow (Border-like) */}
              <motion.div 
                className="absolute inset-0 rounded-full border border-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.4)] -z-10 pointer-events-none"
                animate={{ 
                  opacity: [0.5, 1, 0.5],
                  boxShadow: [
                    "0 0 2px rgba(59,130,246,0.2)",
                    "0 0 10px rgba(59,130,246,0.5)",
                    "0 0 2px rgba(59,130,246,0.2)"
                  ]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              
              <div className="relative w-3 h-3 flex items-center justify-center">
                <Sparkles size={12} className="relative z-10 group-hover:scale-110 transition-transform" />
                <Sparkles 
                  size={12} 
                  className="absolute inset-0 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:animate-ping" 
                />
              </div>
              <span className="relative z-10">{t.changelogTitle}</span>
            </button>

            <div className="relative flex items-center">
              <a
                href="https://dcnzkep5lste.feishu.cn/share/base/form/shrcn2yBpNQA0NpeZjZwt8NShJh"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-green-600 dark:text-green-400 rounded-full text-xs font-bold transition-all relative group"
              >
                {/* Outer soft glow (Diffuse) */}
                <motion.div 
                  className="absolute inset-0 rounded-full bg-green-500/20 blur-md -z-20 pointer-events-none"
                  animate={{ 
                    opacity: [0.4, 0.8, 0.4],
                    scale: [1, 1.15, 1]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                
                {/* Inner precise glow (Border-like) */}
                <motion.div 
                  className="absolute inset-0 rounded-full border border-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.4)] -z-10 pointer-events-none"
                  animate={{ 
                    opacity: [0.5, 1, 0.5],
                    boxShadow: [
                      "0 0 2px rgba(34,197,94,0.2)",
                      "0 0 10px rgba(34,197,94,0.5)",
                      "0 0 2px rgba(34,197,94,0.2)"
                    ]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                
                <MessageSquare size={12} className="relative z-10 group-hover:animate-bounce" />
                <span className="relative z-10">{t.feedback}</span>
              </a>

              {/* Onboarding Tooltip with Morphing Animation */}
              <AnimatePresence>
                {showOnboarding && (
                  <motion.div
                    initial={{ 
                      opacity: 0, 
                      scaleX: 0, 
                      scaleY: 0,
                      originX: 0,
                      x: 10,
                      borderRadius: "100px"
                    }}
                    animate={{ 
                      opacity: 1, 
                      scaleX: 1, 
                      scaleY: 1,
                      originX: 0,
                      x: 12,
                      borderRadius: "12px"
                    }}
                    exit={{ 
                      opacity: 0, 
                      scaleX: 0, 
                      scaleY: 0,
                      originX: 0,
                      x: 10,
                      borderRadius: "100px"
                    }}
                    transition={{ 
                      type: "spring",
                      stiffness: 260,
                      damping: 20
                    }}
                    className="absolute left-full whitespace-nowrap z-[100]"
                   >
                     <div className="bg-orange-400/85 dark:bg-orange-500/80 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-[0_10px_30px_-10px_rgba(251,146,60,0.5)] text-xs font-bold flex items-center gap-2 border border-white/20">
                         <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                         {t.onboardingTip}
                         <button 
                           onClick={closeOnboarding}
                           className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
                         >
                           <X size={12} className="text-white" />
                         </button>
                       </div>
                   </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom Slider */}
          <div className="hidden lg:flex items-center gap-2 mr-2">
            <span className="text-xs font-mono opacity-70 w-8 text-right">
                {previewZoom > 0 ? `${Math.round(previewZoom * 100)}%` : 'Auto'}
            </span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.1"
              value={previewZoom || 1}
              onChange={(e) => setPreviewZoom(parseFloat(e.target.value))}
              className="w-24 accent-blue-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
             {previewZoom > 0 && (
               <button 
                 onClick={() => setPreviewZoom(0)}
                 className="ml-1 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-blue-500"
                 title="Reset to Auto"
               >
                 <RotateCcw size={12} />
               </button>
             )}
          </div>

          <div className="relative flex items-center">
            <button
              onClick={() => setShowContact(true)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-inherit opacity-80 hover:opacity-100"
              title={t.aboutProject}
            >
              <Info size={18} />
            </button>

          </div>

          <a
            href="https://github.com/LuN3cy/Md2Design"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-inherit opacity-80 hover:opacity-100"
          >
            <Github size={18} />
          </a>

          <button
            onClick={toggleLanguage}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-inherit opacity-80 hover:opacity-100"
          >
            <Languages size={18} />
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-inherit opacity-80 hover:opacity-100"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="h-6 w-px bg-black/20 dark:bg-white/20 mx-1" />

          <button 
             onClick={() => document.getElementById('import-file')?.click()}
             className="flex items-center gap-2 px-4 py-1.5 bg-white/10 text-black dark:text-white rounded-full text-sm font-medium hover:bg-black/5 dark:hover:bg-white/20 transition-all border border-black/10 dark:border-white/10"
             title={t.importData}
          >
            <Upload size={16} />
            <span className="hidden sm:inline">{t.importData}</span>
          </button>
          <input 
            type="file" 
            id="import-file" 
            className="hidden" 
            accept=".d2d,.json"
            onChange={handleImportFile}
          />

          <button 
             onClick={() => setShowXhsPreview(true)}
             className="flex items-center gap-2 px-4 py-1.5 bg-[#ff2442] text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#ff2442]/20"
          >
            <MonitorSmartphone size={16} />
            <span className="hidden sm:inline">小红书预览</span>
          </button>

          <button 
             onClick={() => setShowExport(true)}
             className="flex items-center gap-2 px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded-full text-sm font-medium hover:opacity-90 transition-opacity shadow-lg"
          >
            <Download size={16} />
            {t.exportBtn}
          </button>
        </div>
      </div>

      {/* Export Modal */}
      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      
      <AnimatePresence>
        {showXhsPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
            onClick={() => setShowXhsPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-6xl rounded-[32px] border border-white/15 bg-white/92 p-6 shadow-2xl dark:bg-[#0b1220]/95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">小红书预览</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-white/55">生成接近小红书网页版 / 手机版的发布页预览，并支持直接发送到手机分享面板。</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
                    <button
                      onClick={() => setXhsViewport('web')}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${xhsViewport === 'web' ? 'bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-white/55'}`}
                    >
                      <MonitorSmartphone size={14} /> 网页版
                    </button>
                    <button
                      onClick={() => setXhsViewport('mobile')}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${xhsViewport === 'mobile' ? 'bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-white/55'}`}
                    >
                      <Smartphone size={14} /> 手机版
                    </button>
                  </div>
                  <button onClick={() => setShowXhsPreview(false)} className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]">
                <div className="rounded-[28px] border border-black/8 bg-[#f7f8fa] p-4 dark:border-white/10 dark:bg-[#111827]">
                  {xhsViewport === 'web' ? (
                    <div className="overflow-hidden rounded-[26px] border border-black/6 bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#0f172a]">
                      <div className="flex items-center justify-between border-b border-black/6 px-5 py-3 dark:border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-[#ff2442]/12 text-[#ff2442] flex items-center justify-center font-black">薯</div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{xhsPreviewMeta.title}</div>
                            <div className="text-xs text-slate-400">推荐笔记预览 · Web</div>
                          </div>
                        </div>
                        <div className="rounded-full bg-[#ff2442] px-4 py-1.5 text-xs font-semibold text-white">去发布</div>
                      </div>
                      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="bg-[#fafafa] p-4 dark:bg-[#111827]">
                          <div className="overflow-hidden rounded-[24px] bg-white shadow-sm dark:bg-slate-900">
                            {isGeneratingXhsPreview ? (
                              <div className="flex h-[560px] items-center justify-center text-sm text-slate-400">正在生成预览图…</div>
                            ) : (
                              <img src={xhsPreviewImage} alt="小红书预览图" className="block h-[560px] w-full object-cover" />
                            )}
                          </div>
                        </div>
                        <div className="border-l border-black/6 bg-white p-5 dark:border-white/10 dark:bg-slate-950/60">
                          <div className="mb-4 flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full bg-linear-to-br from-pink-500 to-orange-400" />
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">Md2Design 创作者</div>
                              <div className="text-xs text-slate-400">刚刚 · 广东</div>
                            </div>
                          </div>
                          <div className="text-xl font-bold leading-snug text-slate-900 dark:text-white">{xhsPreviewMeta.title}</div>
                          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/70">{xhsPreviewMeta.excerpt}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {xhsPreviewMeta.hashtags.map((tag) => (
                              <span key={tag} className="rounded-full bg-[#ff2442]/8 px-3 py-1 text-xs font-medium text-[#ff2442]">{tag}</span>
                            ))}
                          </div>
                          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-slate-500 dark:text-white/55">
                            <div className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/5"><div className="text-lg font-bold text-slate-900 dark:text-white">3.2k</div>赞</div>
                            <div className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/5"><div className="text-lg font-bold text-slate-900 dark:text-white">286</div>收藏</div>
                            <div className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/5"><div className="text-lg font-bold text-slate-900 dark:text-white">98</div>评论</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto w-[360px] rounded-[40px] border border-black/10 bg-black p-3 shadow-[0_28px_80px_-32px_rgba(15,23,42,0.6)]">
                      <div className="overflow-hidden rounded-[30px] bg-white dark:bg-[#0f172a]">
                        <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                          <span>9:41</span>
                          <span className="rounded-full bg-[#ff2442]/10 px-3 py-1 text-[#ff2442]">小红书</span>
                          <span>5G</span>
                        </div>
                        <div className="border-b border-black/6 px-4 py-3 dark:border-white/10">
                          <div className="text-center text-sm font-semibold text-slate-900 dark:text-white">笔记详情</div>
                        </div>
                        <div className="max-h-[720px] overflow-y-auto bg-[#f8f8f8] p-3 dark:bg-[#111827]">
                          <div className="rounded-[26px] bg-white p-3 shadow-sm dark:bg-slate-950/70">
                            {isGeneratingXhsPreview ? (
                              <div className="flex h-[420px] items-center justify-center text-sm text-slate-400">正在生成预览图…</div>
                            ) : (
                              <img src={xhsPreviewImage} alt="小红书移动端预览图" className="block h-[420px] w-full rounded-[22px] object-cover" />
                            )}
                            <div className="mt-4 text-[19px] font-bold leading-snug text-slate-900 dark:text-white">{xhsPreviewMeta.title}</div>
                            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-white/70">{xhsPreviewMeta.excerpt}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {xhsPreviewMeta.hashtags.map((tag) => (
                                <span key={tag} className="text-xs font-medium text-[#ff2442]">{tag}</span>
                              ))}
                            </div>
                            <div className="mt-4 flex items-center gap-3 border-t border-black/6 pt-4 dark:border-white/10">
                              <div className="h-10 w-10 rounded-full bg-linear-to-br from-pink-500 to-orange-400" />
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">Md2Design 创作者</div>
                                <div className="text-xs text-slate-400">点击右上角分享给微信 / QQ / 飞书</div>
                              </div>
                              <button className="rounded-full bg-[#ff2442] px-4 py-1.5 text-xs font-semibold text-white">关注</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-black/8 bg-white/90 p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#0b1220]/85">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">分发 / 发布辅助</div>
                  <div className="mt-2 text-xs leading-6 text-slate-500 dark:text-white/55">纯前端下，我可以帮你生成预览、复制文案、调起系统分享面板；但不能稳定实现“小红书自动发帖”，因为浏览器端没有可靠的官方发布接口可直接调用。</div>

                  <div className="mt-4 space-y-3">
                    <button onClick={handleShareToPhone} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                      <Send size={16} /> 发送到手机 / 微信 / QQ / 飞书
                    </button>
                    <button onClick={handleCopyXhsDraft} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/5">
                      <Copy size={16} /> 复制标题 + 文案
                    </button>
                    <a href="https://www.xiaohongshu.com/explore" target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ff2442]/20 bg-[#ff2442]/6 px-4 py-3 text-sm font-semibold text-[#ff2442] transition hover:bg-[#ff2442]/10">
                      <ExternalLink size={16} /> 打开小红书网页版
                    </a>
                    <div className="rounded-2xl bg-black/[0.03] p-4 text-xs leading-6 text-slate-500 dark:bg-white/5 dark:text-white/55">
                      <div className="mb-1 font-semibold text-slate-900 dark:text-white">自动发帖说明</div>
                      当前实现不接数据库，也不走后端。基于这个前提，只能做“预览 + 复制 + 系统分享”。如果未来你有可用的小红书开放接口或企业内部发布 API，我可以再帮你接成真正的一键发布。
                    </div>
                    {shareFeedback && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">{shareFeedback}</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showExport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowExport(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
               {/* Background Glow */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none -z-0" />
               <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none -z-0" />

               <div className="relative z-10 flex flex-col h-full overflow-hidden">
                 <div className="flex items-center justify-between mb-6 shrink-0">
                   <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                     <Download size={20} className="text-blue-500 dark:text-blue-400" />
                     {t.exportSettings}
                   </h3>
                   <button 
                     onClick={() => setShowExport(false)}
                     className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                   >
                     <X size={20} />
                   </button>
                 </div>

                 <div className="space-y-6 flex-1 overflow-y-auto min-h-0 pr-2 -mr-2 custom-scrollbar">
                   {/* Export Type Selector */}
                   <div>
                     <label className="text-xs font-medium text-slate-500 dark:text-white/50 mb-2 block uppercase tracking-wider">{t.exportType}</label>
                     <div className="grid grid-cols-2 gap-2">
                       <button
                         onClick={() => setExportType('image')}
                         className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                           exportType === 'image'
                             ? 'bg-blue-500/10 border-blue-500/50 text-blue-500 dark:text-blue-400'
                             : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                         }`}
                       >
                         <FileImage size={24} />
                         <span className="text-xs font-bold">{t.imageExport}</span>
                       </button>
                       <button
                         onClick={() => setExportType('data')}
                         className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                           exportType === 'data'
                             ? 'bg-blue-500/10 border-blue-500/50 text-blue-500 dark:text-blue-400'
                             : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                         }`}
                       >
                         <FileJson size={24} />
                         <span className="text-xs font-bold">{t.dataExport}</span>
                       </button>
                     </div>
                   </div>

                   {exportType === 'data' ? (
                     <div className="space-y-6">
                        <div>
                           <label className="text-xs font-medium text-slate-500 dark:text-white/50 mb-2 block uppercase tracking-wider">{t.exportSettings}</label>
                           <div className="flex flex-col gap-2">
                              <button
                                onClick={() => setDataExportConfig(prev => ({ ...prev, markdown: !prev.markdown }))}
                                className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between group ${
                                  dataExportConfig.markdown
                                    ? 'bg-blue-500/10 border-blue-500/50'
                                    : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                                }`}
                              >
                                <div className="text-sm font-medium text-slate-700 dark:text-white/80">{t.includeMarkdown}</div>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                   dataExportConfig.markdown ? 'bg-blue-500 border-blue-500 text-white' : 'border-black/20 dark:border-white/20'
                                }`}>
                                  {dataExportConfig.markdown && <Check size={14} />}
                                </div>
                              </button>

                              <button
                                onClick={() => setDataExportConfig(prev => ({ ...prev, style: !prev.style }))}
                                className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between group ${
                                  dataExportConfig.style
                                    ? 'bg-blue-500/10 border-blue-500/50'
                                    : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                                }`}
                              >
                                <div className="text-sm font-medium text-slate-700 dark:text-white/80">{t.includeStyle}</div>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                                   dataExportConfig.style ? 'bg-blue-500 border-blue-500 text-white' : 'border-black/20 dark:border-white/20'
                                }`}>
                                  {dataExportConfig.style && <Check size={14} />}
                                </div>
                              </button>
                           </div>
                        </div>
                        
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                          <div className="flex items-start gap-3">
                             <Info size={16} className="text-amber-500 mt-0.5 shrink-0" />
                             <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                               {t.dataProtection}
                             </p>
                          </div>
                        </div>
                     </div>
                   ) : (
                   <>
                   {/* Format & Scale Row */}
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-xs font-medium text-slate-500 dark:text-white/50 mb-2 block uppercase tracking-wider">{t.format}</label>
                       <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
                         {(['png', 'jpg'] as ExportFormat[]).map((f) => (
                           <button
                             key={f}
                             onClick={() => setFormat(f)}
                             className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all uppercase ${
                               format === f ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                             }`}
                           >
                             {f}
                           </button>
                         ))}
                       </div>
                     </div>
                     <div>
                       <label className="text-xs font-medium text-slate-500 dark:text-white/50 mb-2 block uppercase tracking-wider">{t.scale}</label>
                       <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
                         {[1, 2, 3, 4].map((s) => (
                           <button
                             key={s}
                             onClick={() => setScale(s as ExportScale)}
                             className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                               scale === s ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                             }`}
                           >
                             {s}x
                           </button>
                         ))}
                       </div>
                     </div>
                   </div>

                   {/* Export Mode */}
                   <div>
                     <label className="text-xs font-medium text-slate-500 dark:text-white/50 mb-2 block uppercase tracking-wider">{t.exportMode}</label>
                     <div className="flex flex-col gap-2">
                       {[
                         { value: 'multiple', label: t.multipleFiles, desc: 'Package multiple cards' },
                         { value: 'single', label: t.singleFile, desc: 'Download cards one by one' }
                       ].map((mode) => (
                         <button
                           key={mode.value}
                           onClick={() => setExportMode(mode.value as ExportMode)}
                           className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between group ${
                             exportMode === mode.value 
                               ? 'bg-blue-500/10 border-blue-500/50' 
                               : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/10 dark:hover:border-white/10'
                           }`}
                         >
                           <div>
                             <div className={`text-sm font-medium ${exportMode === mode.value ? 'text-blue-500 dark:text-blue-400' : 'text-slate-700 dark:text-white/80'}`}>
                               {mode.label}
                             </div>
                             <div className="text-xs opacity-50 mt-0.5">{mode.desc}</div>
                           </div>
                           <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                             exportMode === mode.value ? 'border-blue-500' : 'border-black/20 dark:border-white/20 group-hover:border-black/40 dark:group-hover:border-white/40'
                           }`}>
                             {exportMode === mode.value && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                           </div>
                         </button>
                       ))}
                     </div>
                   </div>

                   {/* Export Target (Only for multiple mode) */}
                   {exportMode === 'multiple' && (
                     <div>
                       <label className="text-xs font-medium text-slate-500 dark:text-white/50 mb-2 block uppercase tracking-wider">{t.exportTarget}</label>
                       <div className="flex flex-col gap-2">
                         {[
                           { value: 'zip', label: t.targetZip, desc: 'Compatible with all folders' },
                           { value: 'folder', label: t.targetFolder, desc: 'Requires folder permission' }
                         ].map((target) => (
                           <button
                             key={target.value}
                             onClick={() => setExportTarget(target.value as ExportTarget)}
                             className={`p-3 rounded-xl border transition-all text-left flex items-center justify-between group ${
                               exportTarget === target.value 
                                 ? 'bg-blue-500/10 border-blue-500/50' 
                                 : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/10 dark:hover:border-white/10'
                             }`}
                           >
                             <div>
                               <div className={`text-sm font-medium ${exportTarget === target.value ? 'text-blue-500 dark:text-blue-400' : 'text-slate-700 dark:text-white/80'}`}>
                                 {target.label}
                               </div>
                               <div className="text-xs opacity-50 mt-0.5">{target.desc}</div>
                             </div>
                             <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                               exportTarget === target.value ? 'border-blue-500' : 'border-black/20 dark:border-white/20 group-hover:border-black/40 dark:group-hover:border-white/40'
                             }`}>
                               {exportTarget === target.value && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                             </div>
                           </button>
                         ))}
                       </div>
                       {exportTarget === 'folder' && (
                         <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400/80 leading-relaxed px-1">
                           {t.systemFolderWarning}
                         </p>
                       )}
                     </div>
                   )}

                   {/* Folder Name (Only for multiple mode) */}
                   {exportMode === 'multiple' && (
                     <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-white/50 mb-2 block uppercase tracking-wider">{t.folderName}</label>
                        <input 
                          type="text" 
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                          placeholder="cards-export"
                          className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white placeholder-black/30 dark:placeholder-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                        />
                     </div>
                   )}

                   {/* File Name Customization */}
                   <div className="space-y-4">
                      <label className="text-xs font-medium text-slate-500 dark:text-white/50 mb-2 block uppercase tracking-wider">{t.fileNameCustom}</label>
                      
                      {/* Naming Mode Toggle */}
                      <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5">
                        {[
                          { id: 'system', label: t.namingModeSystem },
                          { id: 'custom', label: t.namingModeCustom }
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setNamingMode(m.id as NamingMode)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                              namingMode === m.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>

                      {namingMode === 'system' ? (
                        <div className="space-y-3">
                          <input 
                            type="text" 
                            value={namingConfigs.custom}
                            onChange={(e) => setNamingConfigs({ ...namingConfigs, custom: e.target.value })}
                            placeholder={t.namingCustom}
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                          />
                          <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                            <label className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 mb-1 block">{t.namingPreview}</label>
                            <div className="text-xs font-mono text-slate-500 dark:text-white/60 truncate">
                              {generateFileName(0, 10)}.{format}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Part Selectors (Multi-select) */}
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: 'prefix', label: t.namingPrefix },
                              { id: 'date', label: t.namingDate },
                              { id: 'custom', label: t.namingCustom },
                              { id: 'number', label: t.namingNumber }
                            ].map((part) => (
                              <button
                                key={part.id}
                                onClick={() => {
                                  if (namingParts.includes(part.id as NamingPart)) {
                                    setNamingParts(namingParts.filter(p => p !== part.id));
                                  } else {
                                    setNamingParts([...namingParts, part.id as NamingPart]);
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  namingParts.includes(part.id as NamingPart)
                                    ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                                    : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-black/40 dark:text-white/40'
                                }`}
                              >
                                {part.label}
                                {namingParts.includes(part.id as NamingPart) && (
                                  <span className="ml-1.5 opacity-60">{namingParts.indexOf(part.id as NamingPart) + 1}</span>
                                )}
                              </button>
                            ))}
                          </div>

                          {/* Dynamic Content Boxes */}
                          <div className="space-y-3">
                            {namingParts.map((part) => (
                              <motion.div 
                                key={part}
                                layout
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 space-y-3"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500/60">{t[`naming${part.charAt(0).toUpperCase() + part.slice(1)}` as keyof typeof t]}</span>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => {
                                        const idx = namingParts.indexOf(part);
                                        if (idx > 0) {
                                          const newParts = [...namingParts];
                                          [newParts[idx], newParts[idx-1]] = [newParts[idx-1], newParts[idx]];
                                          setNamingParts(newParts);
                                        }
                                      }}
                                      className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
                                    >
                                      <ChevronDown size={12} className="rotate-180 opacity-40" />
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const idx = namingParts.indexOf(part);
                                        if (idx < namingParts.length - 1) {
                                          const newParts = [...namingParts];
                                          [newParts[idx], newParts[idx+1]] = [newParts[idx+1], newParts[idx]];
                                          setNamingParts(newParts);
                                        }
                                      }}
                                      className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
                                    >
                                      <ChevronDown size={12} className="opacity-40" />
                                    </button>
                                  </div>
                                </div>

                                {part === 'prefix' && (
                                  <input 
                                    type="text" 
                                    value={namingConfigs.prefix}
                                    onChange={(e) => setNamingConfigs({ ...namingConfigs, prefix: e.target.value })}
                                    className="w-full bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500/30"
                                  />
                                )}
                                {part === 'custom' && (
                                  <input 
                                    type="text" 
                                    value={namingConfigs.custom}
                                    onChange={(e) => setNamingConfigs({ ...namingConfigs, custom: e.target.value })}
                                    className="w-full bg-white/50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500/30"
                                  />
                                )}
                                {part === 'date' && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-slate-500 dark:text-white/40">{t.namingIncludeTime}</span>
                                      <button 
                                        onClick={() => setNamingConfigs({ ...namingConfigs, includeTime: !namingConfigs.includeTime })}
                                        className={`w-8 h-4 rounded-full transition-colors relative ${namingConfigs.includeTime ? 'bg-blue-500' : 'bg-black/20 dark:bg-white/20'}`}
                                      >
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${namingConfigs.includeTime ? 'right-0.5' : 'left-0.5'}`} />
                                      </button>
                                    </div>
                                    <CustomDropdown
                                      value={namingConfigs.dateFormat}
                                      options={[
                                        { id: 'dateFormatFull', label: t.dateFormatFull },
                                        { id: 'dateFormatShort', label: t.dateFormatShort },
                                        { id: 'dateFormatMDY', label: t.dateFormatMDY },
                                        { id: 'dateFormatDMY', label: t.dateFormatDMY },
                                        { id: 'dateFormatYMD', label: t.dateFormatYMD }
                                      ]}
                                      onChange={(val) => setNamingConfigs({ ...namingConfigs, dateFormat: val })}
                                    />
                                  </div>
                                )}
                                {part === 'number' && (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <CustomDropdown
                                        className="flex-1"
                                        value={namingConfigs.numberType}
                                        options={[
                                          { id: 'arabic', label: t.namingArabic },
                                          { id: 'chinese', label: t.namingChinese }
                                        ]}
                                        onChange={(val) => setNamingConfigs({ ...namingConfigs, numberType: val })}
                                      />
                                      <CustomDropdown
                                        className="flex-1"
                                        value={namingConfigs.numberOrder}
                                        options={[
                                          { id: 'asc', label: t.namingOrderAsc },
                                          { id: 'desc', label: t.namingOrderDesc }
                                        ]}
                                        onChange={(val) => setNamingConfigs({ ...namingConfigs, numberOrder: val })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-slate-500 dark:text-white/40">{t.namingZeroStart}</span>
                                      <button 
                                        onClick={() => setNamingConfigs({ ...namingConfigs, zeroStart: !namingConfigs.zeroStart })}
                                        className={`w-8 h-4 rounded-full transition-colors relative ${namingConfigs.zeroStart ? 'bg-blue-500' : 'bg-black/20 dark:bg-white/20'}`}
                                      >
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${namingConfigs.zeroStart ? 'right-0.5' : 'left-0.5'}`} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>

                          {/* Preview for Number Order */}
                          <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                            <label className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 mb-1 block">{t.namingPreview}</label>
                            <div className="space-y-1 font-mono text-[10px] text-slate-500 dark:text-white/60">
                              {namingParts.includes('number') ? (
                                <>
                                  <div className="truncate">{generateFileName(0, 5)}.{format}</div>
                                  <div className="opacity-40">...</div>
                                  <div className="truncate">{generateFileName(4, 5)}.{format}</div>
                                </>
                              ) : (
                                <div className="truncate">{generateFileName(0, 1)}.{format}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                   </div>
                   </>)}

                   </div>

                   {/* Footer Section */}
                   <div className="mt-6 space-y-4 shrink-0 z-10">
                     {/* Info Stats - Only for Image Export */}
                     {exportType === 'image' && (
                       <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40">Single Size</span>
                          <span className="text-sm font-mono text-slate-700 dark:text-white/80">{previewSize.single}</span>
                        </div>
                        <div className="w-px h-8 bg-black/10 dark:bg-white/10" />
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40">{t.total} Size</span>
                          <span className="text-sm font-mono text-blue-500 dark:text-blue-400">{previewSize.total}</span>
                        </div>
                       </div>
                     )}

                     {/* Action Button */}
                     <div className="space-y-3">
                     {isExporting && (
                       <div className="w-full bg-black/5 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                         <motion.div 
                           className="h-full bg-blue-500 rounded-full"
                           initial={{ width: 0 }}
                           animate={{ width: `${progress}%` }}
                           transition={{ duration: 0.2 }}
                         />
                       </div>
                     )}
                     
                     <button
                       onClick={handleExport}
                       disabled={isExporting}
                       className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl text-sm font-bold shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.98]"
                     >
                       {isExporting ? (
                         <>
                           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                           {t.calculating} ({progress}%)
                         </>
                       ) : (
                         <>
                           {t.exportBtn}
                           <ChevronDown size={16} className="-rotate-90 opacity-60" />
                         </>
                       )}
                     </button>
                   </div>
                   </div>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              className="bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 pointer-events-auto"
            >
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                <Check size={20} strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.exportSuccess}</h3>
                <p className="text-xs text-slate-500 dark:text-white/60">{t.exportSuccessMsg}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowContact(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white/90 dark:bg-black/90 backdrop-blur-xl border border-black/20 dark:border-white/20 p-6 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">{t.aboutProject}</h3>
                <button 
                  onClick={() => setShowContact(false)}
                  className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-3">
                {contactLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block p-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl transition-all hover:scale-[1.02] ${link.color}`}
                  >
                    <div className="font-bold mb-1">{link.main}</div>
                  </a>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-600 dark:text-white/65">
                <div className="font-semibold text-slate-900 dark:text-white mb-1">Md2Design</div>
                <p>Markdown cards with richer Feishu-style blocks, polished visuals, and local-first export workflow.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
};
