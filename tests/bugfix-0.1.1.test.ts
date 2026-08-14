import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf-8');
}

describe('Bugfix 0.1.1 — mobile quick-add entry point', () => {
  it('main.ts registers a ribbon icon for quick-add', () => {
    const src = read('src/main.ts');
    // Must have addRibbonIcon for quick-add (not just review)
    expect(src).toContain("addRibbonIcon('plus'");
    expect(src).toContain('this.quickAdd()');
  });

  it('main.ts registers quick-add command', () => {
    const src = read('src/main.ts');
    expect(src).toContain("id: 'quick-add-card'");
    expect(src).toContain("name: '新建记忆卡'");
  });

  it('two distinct ribbon icons exist (review + quick-add)', () => {
    const src = read('src/main.ts');
    const ribbonMatches = src.match(/addRibbonIcon\(/g);
    expect(ribbonMatches).not.toBeNull();
    expect(ribbonMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it('review summary offers an in-UI touch quick-add button when empty', () => {
    const src = read('src/ui/reviewModal.ts');
    expect(src).toContain('onQuickAdd');
    expect(src).toContain('新建卡片');
    expect(src).toContain("this.onQuickAdd?.()");
  });

  it('main.ts threads quickAdd into ReviewModal', () => {
    const src = read('src/main.ts');
    expect(src).toContain('() => this.quickAdd()');
    expect(src).toContain('initialRevealed');
  });
});

describe('Bugfix 0.1.1 — MarkdownRenderer lifecycle in review', () => {
  it('reviewModal uses MarkdownRenderer.render with a per-card owner', () => {
    const src = read('src/ui/reviewModal.ts');
    // Must call MarkdownRenderer.render
    expect(src).toContain('MarkdownRenderer.render');
    // Must NOT register renders on the long-lived plugin owner directly
    expect(src).toContain('this.renderMarkdown');
  });

  it('reviewModal imports MarkdownRenderer and Component from obsidian', () => {
    const src = read('src/ui/reviewModal.ts');
    expect(src).toContain('MarkdownRenderer');
    expect(src).toContain('Component');
  });

  it('renders question, answer, and note via MarkdownRenderer', () => {
    const src = read('src/ui/reviewModal.ts');
    const renderCalls = (src.match(/this\.renderMarkdown\(/g) || []).length;
    expect(renderCalls).toBeGreaterThanOrEqual(3); // question + answer + note
  });

  it('uses a per-card Component that is unloaded on switch and close', () => {
    const src = read('src/ui/reviewModal.ts');
    // A per-card render component must be created, loaded, and disposed.
    expect(src).toContain('new Component()');
    expect(src).toContain('.load()');
    expect(src).toContain('.unload()');
    expect(src).toContain('disposeCardRender');
    // Must NOT pass this.owner directly to MarkdownRenderer.render
    expect(src).not.toContain('MarkdownRenderer.render(this.app, card.question, question, card.notePath, this.owner)');
    expect(src).not.toContain('MarkdownRenderer.render(this.app, card.answer, answer, card.notePath, this.owner)');
  });

  it('renderMarkdown receives the formula content from the card', () => {
    const src = read('src/ui/reviewModal.ts');
    // Content flows from card fields into the render helper.
    expect(src).toContain('this.renderMarkdown(card.question, question, card.notePath)');
    expect(src).toContain('this.renderMarkdown(card.answer, answer, card.notePath)');
    expect(src).toContain('this.renderMarkdown(card.note, extra, card.notePath)');
  });
});

describe('Bugfix 0.1.1 — CSS contract for math/LaTeX', () => {
  const css = read('styles.css');

  it('has overflow-x: auto on math containers', () => {
    expect(css).toContain('overflow-x: auto');
  });

  it('has max-width: 100% on math elements', () => {
    expect(css).toContain('.memory-cards-modal .math');
    expect(css).toContain('max-width: 100%');
  });

  it('handles mjx-container for MathJax/KaTeX output', () => {
    expect(css).toContain('mjx-container');
    expect(css).toContain('[display="true"]');
  });

  it('has block display for displayed math', () => {
    expect(css).toContain('display: block');
  });
});

describe('Bugfix 0.1.1 — CSS contract for QuickAdd label spacing', () => {
  const css = read('styles.css');

  it('mc-field has adequate gap between label and input', () => {
    const fieldBlock = css.slice(
      css.indexOf('.memory-cards-modal .mc-field {'),
      css.indexOf('.memory-cards-modal .mc-field {') + 200
    );
    // gap must be ≥ 6px to prevent label/input overlap
    const gapMatch = fieldBlock.match(/gap:\s*(\d+)px/);
    expect(gapMatch).not.toBeNull();
    expect(parseInt(gapMatch![1], 10)).toBeGreaterThanOrEqual(6);
  });

  it('mc-field label has explicit margin-bottom', () => {
    const labelBlock = css.slice(
      css.indexOf('.memory-cards-modal .mc-field label {'),
      css.indexOf('.memory-cards-modal .mc-field label {') + 200
    );
    expect(labelBlock).toContain('margin-bottom');
  });
});
