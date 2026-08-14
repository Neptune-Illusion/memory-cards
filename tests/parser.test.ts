import { describe, expect, it } from 'vitest';
import { parseNote, renderCardMarkdown, splitFrontmatter } from '../src/parser';

const options = { questionSeparator: '???', noteSeparator: ':::' };

describe('splitFrontmatter', () => {
  it('reads tags and id', () => {
    const result = splitFrontmatter('---\nmemtype: card\nid: cell-resp\ntags: [记忆卡, 生物]\n---\n\nbody');
    expect(result.frontmatter.tags).toEqual(['记忆卡', '生物']);
    expect(result.frontmatter.id).toBe('cell-resp');
    expect(result.body.trim()).toBe('body');
  });

  it('treats a note without frontmatter as all body', () => {
    const result = splitFrontmatter('问题：x\n\n??? \n\n答案：y');
    expect(result.frontmatter.tags).toEqual([]);
    expect(result.bodyStartLine).toBe(1);
  });
});

describe('parseNote', () => {
  it('parses question, answer and optional note, stripping labels', () => {
    const content = [
      '---',
      'tags: [生物]',
      '---',
      '',
      '问题：细胞呼吸的三阶段？',
      '',
      '??? 答案',
      '',
      '答案：糖酵解、柠檬酸循环、氧化磷酸化。',
      '',
      '::: 注解',
      '',
      '注解：糖酵解在细胞质。',
    ].join('\n');

    const cards = parseNote('卡片/生物.md', content, options);
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('细胞呼吸的三阶段？');
    expect(cards[0].answer).toBe('糖酵解、柠檬酸循环、氧化磷酸化。');
    expect(cards[0].note).toBe('糖酵解在细胞质。');
    expect(cards[0].tags).toEqual(['生物']);
  });

  it('parses several cards from one note, each with its own id', () => {
    const content = ['Q1', '', '???', '', 'A1', '', '---', '', 'Q2', '', '???', '', 'A2'].join('\n');
    const cards = parseNote('卡片/多卡.md', content, options);
    expect(cards.map((card) => card.id)).toEqual(['卡片/多卡.md::0', '卡片/多卡.md::1']);
    expect(cards.map((card) => card.answer)).toEqual(['A1', 'A2']);
  });

  it('uses the frontmatter id for the first card so renames keep progress', () => {
    const content = ['---', 'id: stable', '---', '', 'Q', '', '???', '', 'A'].join('\n');
    expect(parseNote('卡片/a.md', content, options)[0].id).toBe('卡片/a.md::stable');
  });

  it('skips blocks without a separator or with an empty side', () => {
    expect(parseNote('n.md', 'just prose', options)).toHaveLength(0);
    expect(parseNote('n.md', 'Q\n\n???\n\n', options)).toHaveLength(0);
    expect(parseNote('n.md', '\n\n???\n\nA', options)).toHaveLength(0);
  });

  it('honours custom separators', () => {
    const cards = parseNote('n.md', 'Q\n\n--答案--\n\nA', {
      questionSeparator: '--答案--',
      noteSeparator: '--注解--',
    });
    expect(cards[0].answer).toBe('A');
  });

  it('round-trips rendered markdown', () => {
    const markdown = renderCardMarkdown('Q', 'A', options, 'N');
    const cards = parseNote('n.md', markdown, options);
    expect(cards[0]).toMatchObject({ question: 'Q', answer: 'A', note: 'N' });
  });
});
