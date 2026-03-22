export type ParsedMarkdownBlock = {
  id: string;
  content: string;
};

const normalizeBlockId = (content: string, index: number) => {
  const compact = content
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);

  return `block-${index}-${compact || 'content'}`;
};

export const parseMarkdownBlocks = (markdown: string): ParsedMarkdownBlock[] => {
  const lines = markdown.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inCodeFence = false;
  let inCallout = false;

  const flush = () => {
    const value = current.join('\n').trim();
    if (value) blocks.push(value);
    current = [];
  };

  const isListLine = (line: string) => /^\s*(?:[-*+]\s|\d+\.\s)/.test(line);
  const isQuoteLine = (line: string) => /^\s*>/.test(line);
  const isTableLine = (line: string) => /^\s*\|.+\|\s*$/.test(line);
  const isDirectiveFence = (line: string) => /^\s*:::.*/.test(line);
  const isHtmlBlockStart = (line: string) => /^\s*<(?:div|section|article|span|p|blockquote)[\s>]/i.test(line);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      current.push(line);
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      current.push(line);
      continue;
    }

    if (isDirectiveFence(trimmed)) {
      current.push(line);
      inCallout = !inCallout;
      continue;
    }

    if (inCallout) {
      current.push(line);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flush();
      continue;
    }

    const prev = lines[index - 1]?.trim() ?? '';
    const next = lines[index + 1]?.trim() ?? '';

    const continuesStructuredBlock = current.length > 0 && (
      isListLine(line) ||
      isQuoteLine(line) ||
      isTableLine(line) ||
      isHtmlBlockStart(line) ||
      (prev && (isListLine(prev) || isQuoteLine(prev) || isTableLine(prev)))
    );

    if (!continuesStructuredBlock && current.length > 0) {
      const previousLine = current[current.length - 1]?.trim() ?? '';
      const startsOwnBlock = /^#{1,6}\s/.test(trimmed) || /^!\[/.test(trimmed) || /^---$/.test(trimmed);
      const previousLooksStandalone = /^#{1,6}\s/.test(previousLine) || /^!\[/.test(previousLine) || isHtmlBlockStart(previousLine);
      if (startsOwnBlock || previousLooksStandalone || (next && /^#{1,6}\s/.test(next))) {
        flush();
      }
    }

    current.push(line);
  }

  flush();

  return blocks
    .filter((content) => content !== '---' && !/^!\[spacer\]\(spacer/i.test(content.trim()))
    .map((content, index) => ({
      id: normalizeBlockId(content, index),
      content,
    }));
};
