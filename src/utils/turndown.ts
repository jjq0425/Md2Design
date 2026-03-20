import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  br: '  ',
});

turndownService.use(gfm);

turndownService.addRule('paragraph', {
  filter: 'p',
  replacement: function (content) {
    const isBlank = !content || content.trim() === '' || content === '<br>' || content === '&nbsp;';
    if (isBlank) {
      return '\n&nbsp;\n';
    }
    return '\n' + content + '\n';
  }
});

turndownService.addRule('advancedInlineStyle', {
  filter: (node) => {
    if (!(node instanceof HTMLElement)) return false;
    if (!['SPAN', 'MARK', 'FONT'].includes(node.tagName)) return false;

    const style = node.getAttribute('style') || '';
    return /color\s*:|background(?:-color)?\s*:|text-decoration\s*:/i.test(style) || node.tagName === 'MARK';
  },
  replacement: (_content, node) => {
    if (!(node instanceof HTMLElement)) return '';

    const text = node.textContent || '';
    const style = node.getAttribute('style') || '';
    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    const backgroundMatch = style.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i);
    const underlineMatch = style.match(/(?:^|;)\s*text-decoration[^:]*:\s*([^;]+)/i);

    let content = text;

    if (node.tagName === 'MARK' || backgroundMatch) {
      const bgColor = backgroundMatch?.[1]?.trim();
      content = bgColor ? `[bg=${bgColor}]${content}[/bg]` : `==${content}==`;
    }

    if (colorMatch) {
      content = `[color=${colorMatch[1].trim()}]${content}[/color]`;
    }

    if (underlineMatch && /underline/i.test(underlineMatch[1])) {
      content = `++${content}++`;
    }

    return content;
  }
});

export const htmlToMarkdown = (html: string): string => {
  return turndownService.turndown(html);
};
