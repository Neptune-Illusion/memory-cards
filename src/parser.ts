import type { Card } from './types';

/**
 * Card parsing (SPEC §2). Pure functions only — no Obsidian API — so this is unit testable.
 *
 * Format inside a note:
 *
 *   ---
 *   memtype: card
 *   tags: [记忆卡, 生物]
 *   ---
 *
 *   问题：细胞呼吸的三阶段分别是什么？
 *
 *   ??? 答案
 *
 *   糖酵解、柠檬酸循环、氧化磷酸化。
 *
 *   ::: 注解
 *
 *   糖酵解在细胞质，后两者在线粒体。
 *
 * Several cards can live in one note; separate them with a `---` horizontal rule.
 * A block without the question separator is not a card and is skipped.
 */

export interface ParseOptions {
  questionSeparator: string;
  noteSeparator: string;
}

export interface Frontmatter {
  tags: string[];
  id?: string;
  memtype?: string;
}

interface SplitResult {
  frontmatter: Frontmatter;
  body: string;
  /** 1-based line number on which the body starts. */
  bodyStartLine: number;
}

const LABEL_PREFIX = /^(问题|答案|注解|Q|A|Question|Answer|Note)\s*[:：]\s*/i;

/** Extract YAML-ish frontmatter. Only the few keys we need are read, no YAML dependency. */
export function splitFrontmatter(content: string): SplitResult {
  const lines = content.split(/\r?\n/);
  const empty: Frontmatter = { tags: [] };
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: empty, body: content, bodyStartLine: 1 };
  }
  const end = lines.indexOf('---', 1);
  if (end === -1) {
    return { frontmatter: empty, body: content, bodyStartLine: 1 };
  }
  const fm: Frontmatter = { tags: [] };
  for (const raw of lines.slice(1, end)) {
    const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(raw);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'tags') {
      fm.tags = parseTagList(value);
    } else if (key === 'id') {
      fm.id = stripQuotes(value);
    } else if (key === 'memtype') {
      fm.memtype = stripQuotes(value);
    }
  }
  return {
    frontmatter: fm,
    body: lines.slice(end + 1).join('\n'),
    bodyStartLine: end + 2,
  };
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function parseTagList(value: string): string[] {
  const inner = value.startsWith('[') ? value.slice(1, value.endsWith(']') ? -1 : undefined) : value;
  return inner
    .split(',')
    .map((tag) => stripQuotes(tag).replace(/^#/, ''))
    .filter((tag) => tag.length > 0);
}

function isSeparator(line: string, separator: string): boolean {
  return line.trim().startsWith(separator);
}

/** A `---` on its own line separates cards inside one note. */
function isCardBreak(line: string): boolean {
  return /^\s*-{3,}\s*$/.test(line);
}

function clean(lines: string[]): string {
  return lines
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .trim()
    .replace(LABEL_PREFIX, '')
    .trim();
}

/**
 * Parse one note into cards. `notePath` is used to build stable card ids so that
 * renaming a heading does not lose review progress.
 */
export function parseNote(notePath: string, content: string, options: ParseOptions): Card[] {
  const { frontmatter, body, bodyStartLine } = splitFrontmatter(content);
  const lines = body.split(/\r?\n/);

  const blocks: { lines: string[]; startLine: number }[] = [];
  let current: { lines: string[]; startLine: number } = { lines: [], startLine: bodyStartLine };
  lines.forEach((line, index) => {
    if (isCardBreak(line)) {
      blocks.push(current);
      current = { lines: [], startLine: bodyStartLine + index + 1 };
      return;
    }
    current.lines.push(line);
  });
  blocks.push(current);

  const cards: Card[] = [];
  for (const block of blocks) {
    const separatorIndex = block.lines.findIndex((line) => isSeparator(line, options.questionSeparator));
    if (separatorIndex === -1) continue;

    const question = clean(block.lines.slice(0, separatorIndex));
    const rest = block.lines.slice(separatorIndex + 1);
    const noteIndex = rest.findIndex((line) => isSeparator(line, options.noteSeparator));
    const answer = clean(noteIndex === -1 ? rest : rest.slice(0, noteIndex));
    const extra = noteIndex === -1 ? '' : clean(rest.slice(noteIndex + 1));

    if (question.length === 0 || answer.length === 0) continue;

    const ordinal = cards.length;
    const id =
      frontmatter.id && ordinal === 0
        ? `${notePath}::${frontmatter.id}`
        : `${notePath}::${ordinal}`;

    cards.push({
      id,
      notePath,
      question,
      answer,
      note: extra.length > 0 ? extra : undefined,
      tags: frontmatter.tags,
      line: block.startLine,
    });
  }
  return cards;
}

/** Markdown body for a manually created card (Quick Add). */
export function renderCardMarkdown(
  question: string,
  answer: string,
  options: ParseOptions,
  extraNote?: string
): string {
  const parts = [question.trim(), '', options.questionSeparator, '', answer.trim()];
  if (extraNote && extraNote.trim().length > 0) {
    parts.push('', options.noteSeparator, '', extraNote.trim());
  }
  return parts.join('\n') + '\n';
}
