import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS_PATH = resolve(__dirname, '..', 'styles.css');
const css = readFileSync(CSS_PATH, 'utf-8');

describe('CSS static contract — Baseline alignment', () => {
  it('uses semantic Obsidian variables, not hardcoded colors', () => {
    // Should reference these variables
    expect(css).toContain('--background-secondary');
    expect(css).toContain('--background-modifier-border');
    expect(css).toContain('--text-normal');
    expect(css).toContain('--text-muted');
    expect(css).toContain('--interactive-accent');
    expect(css).toContain('--font-ui-smaller');
  });

  it('does not hardcode hex colors in rules (except comments)', () => {
    // Extract actual rule lines (not comments)
    const ruleLines = css.split('\n').filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    });
    // Allow hex in comments but not in property values
    for (const line of ruleLines) {
      if (line.includes(':') && line.includes(';')) {
        // This is a CSS property line
        const hexMatch = line.match(/#[0-9a-fA-F]{3,8}/g);
        if (hexMatch) {
          // Only allow hex in var() fallbacks or comments
          for (const hex of hexMatch) {
            const beforeHex = line.substring(0, line.indexOf(hex));
            // If hex is inside var() fallback, it's OK
            if (beforeHex.includes('var(')) continue;
            // If hex is in a comment, it's OK
            if (beforeHex.includes('/*')) continue;
            // Otherwise fail
            expect.fail(`Hardcoded hex color ${hex} found in: ${line.trim()}`);
          }
        }
      }
    }
  });

  it('does not use position: fixed in plugin rules', () => {
    // Strip comments before checking
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const fixedMatches = stripped.match(/position\s*:\s*fixed/gi);
    expect(fixedMatches).toBeNull();
  });

  it('uses safe-area-inset for mobile padding', () => {
    expect(css).toContain('safe-area-inset');
    expect(css).toContain('env(safe-area-inset-top');
    expect(css).toContain('env(safe-area-inset-bottom');
  });

  it('sets font-size: 16px to prevent iOS auto-zoom', () => {
    expect(css).toContain('font-size: 16px');
  });

  it('uses dvh for modal max-height', () => {
    expect(css).toContain('100dvh');
  });

  it('has min-height: 0 on scrollable flex child for proper shrinking', () => {
    expect(css).toContain('min-height: 0');
  });

  it('has overscroll-behavior: contain on scrollable area', () => {
    expect(css).toContain('overscroll-behavior: contain');
  });

  it('touch targets are at least 44px', () => {
    // Find --mc-touch variable definition
    const touchMatch = css.match(/--mc-touch\s*:\s*(\d+)px/);
    expect(touchMatch).not.toBeNull();
    const touchSize = parseInt(touchMatch![1], 10);
    expect(touchSize).toBeGreaterThanOrEqual(44);
  });

  it('uses prefers-reduced-motion media query', () => {
    expect(css).toContain('prefers-reduced-motion');
  });

  it('has responsive breakpoints for small phone, tablet, desktop', () => {
    expect(css).toContain('max-width: 480px');
    expect(css).toContain('min-width: 600px');
    expect(css).toContain('min-width: 1024px');
  });

  it('handles landscape orientation', () => {
    expect(css).toContain('orientation: landscape');
  });

  it('grade buttons have border (Baseline thin-border style)', () => {
    expect(css).toContain('.mc-grade');
    expect(css).toContain('border: 1px solid');
  });

  it('grade bar is sticky at bottom for reachability on long answers', () => {
    const gradesBlock = css.slice(css.indexOf('.mc-grades'));
    expect(gradesBlock).toContain('position: sticky');
    expect(gradesBlock).toContain('bottom: 0');
  });

  it('header leaves room for the modal close button (top-right)', () => {
    const headerBlock = css.slice(css.indexOf('.memory-cards-modal .mc-header'));
    expect(headerBlock).toContain('40px');
  });

  it('landscape grade buttons keep a ≥44px touch target', () => {
    const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const landscapeBlock = cssNoComments.slice(cssNoComments.indexOf('orientation: landscape'));
    // Find the .mc-grade rule within the landscape media block
    const gradeIdx = landscapeBlock.indexOf('.mc-grade {');
    expect(gradeIdx).toBeGreaterThan(-1);
    const gradeRule = landscapeBlock.slice(gradeIdx, landscapeBlock.indexOf('}', gradeIdx));
    const mh = gradeRule.match(/min-height:\s*(\d+)px/);
    expect(mh).not.toBeNull();
    expect(parseInt(mh![1], 10)).toBeGreaterThanOrEqual(44);
  });

  it('long content (pre/table/img) is contained and horizontally scrollable', () => {
    expect(css).toContain('.modal-content pre');
    expect(css).toContain('.modal-content table');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('.modal-content img');
    expect(css).toContain('max-width: 100%');
  });

  it('uses var() for border-radius (not hardcoded)', () => {
    expect(css).toContain('--mc-radius');
    expect(css).toContain('var(--mc-radius');
  });

  it('uses var() for transition timing (not hardcoded)', () => {
    expect(css).toContain('--anim-duration-fast');
  });

  it('modal uses flex column layout for proper content scrolling', () => {
    expect(css).toContain('flex-direction: column');
    expect(css).toContain('overflow: hidden');
  });
});

describe('CSS static contract — Mobile safety', () => {
  it('content area has -webkit-overflow-scrolling for iOS', () => {
    expect(css).toContain('-webkit-overflow-scrolling: touch');
  });

  it('modal-content has flex: 1 1 0% for proper scrolling', () => {
    expect(css).toContain('flex: 1 1 0%');
  });

  it('actions/header are flex-shrink: 0 (never collapse)', () => {
    const shrinkZeroCount = (css.match(/flex-shrink:\s*0/g) || []).length;
    expect(shrinkZeroCount).toBeGreaterThanOrEqual(2); // header + actions
  });

  it('grade buttons use touch-action: manipulation (no delay)', () => {
    expect(css).toContain('touch-action: manipulation');
  });

  it('inputs have box-sizing: border-box', () => {
    expect(css).toContain('box-sizing: border-box');
  });

  it('form inputs have min-height: 40px for touch targets', () => {
    expect(css).toContain('min-height: 40px');
  });

  it('mc-field label has line-height ≥ 1.4 to prevent text clipping', () => {
    const labelBlock = css.slice(
      css.indexOf('.memory-cards-modal .mc-field label {'),
      css.indexOf('}', css.indexOf('.memory-cards-modal .mc-field label {'))
    );
    const lhMatch = labelBlock.match(/line-height:\s*([\d.]+)/);
    expect(lhMatch).not.toBeNull();
    expect(parseFloat(lhMatch![1])).toBeGreaterThanOrEqual(1.4);
  });

  it('mc-field label has padding ≥ 3px vertical to prevent clipping', () => {
    const labelBlock = css.slice(
      css.indexOf('.memory-cards-modal .mc-field label {'),
      css.indexOf('}', css.indexOf('.memory-cards-modal .mc-field label {'))
    );
    const padMatch = labelBlock.match(/padding:\s*(\d+)px\s+0/);
    expect(padMatch).not.toBeNull();
    expect(parseInt(padMatch![1], 10)).toBeGreaterThanOrEqual(3);
  });
});

describe('CSS contract — DOM structure for QuickAdd label clipping', () => {
  it('mc-field uses flex-column so label is separate from input', () => {
    const fieldBlock = css.slice(
      css.indexOf('.memory-cards-modal .mc-field {'),
      css.indexOf('}', css.indexOf('.memory-cards-modal .mc-field {'))
    );
    expect(fieldBlock).toContain('display: flex');
    expect(fieldBlock).toContain('flex-direction: column');
  });

  it('label has display:block and overflow:visible to prevent clipping', () => {
    const labelBlock = css.slice(
      css.indexOf('.memory-cards-modal .mc-field label {'),
      css.indexOf('}', css.indexOf('.memory-cards-modal .mc-field label {'))
    );
    expect(labelBlock).toContain('display: block');
    expect(labelBlock).toContain('overflow: visible');
  });
});

describe('CSS contract — SettingsTab AIConfig integration', () => {
  it('settingsTab imports AIConfigPanel', () => {
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, '../src/ui/settingsTab.ts'),
      'utf-8'
    );
    expect(src).toContain('AIConfigPanel');
    expect(src).toContain('aiConfigPanel');
    expect(src).toContain('aiConfigPanel.containerEl');
    expect(src).toContain('aiConfigPanel.display()');
  });

  it('aiConfigPanel has provider dropdown with 3 options', () => {
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, '../src/ui/aiConfigPanel.ts'),
      'utf-8'
    );
    expect(src).toContain('anthropic');
    expect(src).toContain('openai');
    expect(src).toContain('gemini');
    expect(src).toContain('Provider');
    expect(src).toContain('addDropdown');
  });

  it('aiConfigPanel saves provider to store via plugin', () => {
    const src = require('fs').readFileSync(
      require('path').resolve(__dirname, '../src/ui/aiConfigPanel.ts'),
      'utf-8'
    );
    expect(src).toContain('saveAIConfig');
    expect(src).toContain('this.plugin.saveAIConfig');
  });
});
