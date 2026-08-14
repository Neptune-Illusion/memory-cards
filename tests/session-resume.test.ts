import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  return { ...actual };
});

import { ConfirmDialog, ConfirmDecision, type ConfirmModalLike } from '../src/ui/confirmDialog';
import { mapConfirmResult, type ConfirmResult } from '../src/ui/confirmResult';
import { SessionManager } from '../src/session';

/** Minimal DOM stand-in: real EventTarget + addEventListener + dispatchEvent. */
class FakeEl extends EventTarget {
  tag: string;
  cls = '';
  text = '';
  children: FakeEl[] = [];
  constructor(tag = 'div') {
    super();
    this.tag = tag;
  }
  addClass(c: string): void {
    this.cls = this.cls ? `${this.cls} ${c}` : c;
  }
  setText(t: string): void {
    this.text = t;
  }
  createEl(tag: string, opts?: { text?: string; cls?: string } | string): FakeEl {
    const el = new FakeEl(tag);
    if (typeof opts === 'string') {
      el.cls = opts;
    } else {
      if (opts?.text) el.text = opts.text;
      if (opts?.cls) el.cls = opts.cls;
    }
    this.children.push(el);
    return el;
  }
  createDiv(clsOrOpts: { text?: string; cls?: string } | string = ''): FakeEl {
    return this.createEl('div', clsOrOpts);
  }
  buttons(): FakeEl[] {
    const found: FakeEl[] = [];
    const walk = (el: FakeEl) => {
      for (const c of el.children) {
        if (c.tag === 'button') found.push(c);
        walk(c);
      }
    };
    walk(this);
    return found;
  }
  click(): void {
    this.dispatchEvent(new Event('click'));
  }
}

class FakeModal implements ConfirmModalLike {
  modalEl = new FakeEl();
  titleEl = new FakeEl();
  contentEl = new FakeEl();
  opened = false;
  closed = false;
  onClose: (() => void) | null = null;
  open(): void {
    this.opened = true;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onClose?.();
  }
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function makeDialog(): {
  dialog: ConfirmDialog;
  modal: FakeModal;
  results: ConfirmResult[];
  confirmBtn: FakeEl;
  cancelBtn: FakeEl;
} {
  const modal = new FakeModal();
  const results: ConfirmResult[] = [];
  const dialog = new ConfirmDialog({} as never, '继续上次的复习？', '继续或放弃', '继续', '放弃', () => modal);
  dialog.then((r) => results.push(r));
  const buttons = modal.contentEl.buttons();
  return { dialog, modal, results, confirmBtn: buttons[0], cancelBtn: buttons[1] };
}

describe('ConfirmDialog — real click dispatch (mobile resume flow)', () => {
  it('继续 click resolves confirm exactly once and closes the modal', async () => {
    const { results, confirmBtn, modal } = makeDialog();
    confirmBtn.click();
    await flush();
    expect(results).toEqual(['confirm']);
    expect(modal.closed).toBe(true);
    // Second click must NOT resolve again (settle-once)
    confirmBtn.click();
    expect(results).toEqual(['confirm']);
  });

  it('放弃 click resolves cancel exactly once and closes the modal', async () => {
    const { results, cancelBtn, modal } = makeDialog();
    cancelBtn.click();
    await flush();
    expect(results).toEqual(['cancel']);
    expect(modal.closed).toBe(true);
    cancelBtn.click();
    expect(results).toEqual(['cancel']);
  });

  it('close via X / overlay / Escape resolves dismiss (promise never hangs)', async () => {
    const { modal, results } = makeDialog();
    modal.close();
    await flush();
    expect(results).toEqual(['dismiss']);
    expect(modal.closed).toBe(true);
  });

  it('button click then onClose double-fire resolves only once', async () => {
    const { results, confirmBtn, modal } = makeDialog();
    confirmBtn.click();
    modal.close(); // onClose fires after already settled — no double resolve
    await flush();
    expect(results).toEqual(['confirm']);
  });

  it('onClose fires first, later button click cannot override dismiss', async () => {
    const { results, modal, confirmBtn } = makeDialog();
    modal.close(); // dismiss
    confirmBtn.click(); // already settled — no-op
    await flush();
    expect(results).toEqual(['dismiss']);
  });

  it('modal opens on construction', () => {
    const { modal } = makeDialog();
    expect(modal.opened).toBe(true);
  });

  it('buttons are ≥44px target per CSS contract', () => {
    // CSS contract lives in styles.css; here we assert the class hooks exist
    // so the styling applies (mod-cta confirm + plain cancel in .mc-actions).
    const { confirmBtn, cancelBtn } = makeDialog();
    expect(confirmBtn.cls).toContain('mod-cta');
    expect(cancelBtn.tag).toBe('button');
  });
});

describe('ConfirmDecision — pure resolve-once state', () => {
  it('settles first result, rejects later ones', () => {
    const values: ConfirmResult[] = [];
    const decision = new ConfirmDecision((v) => values.push(v));
    expect(decision.isSettled).toBe(false);
    expect(decision.settle('confirm')).toBe(true);
    expect(decision.isSettled).toBe(true);
    expect(decision.settle('cancel')).toBe(false);
    expect(decision.settle('dismiss')).toBe(false);
    expect(values).toEqual(['confirm']);
  });
});

describe('mapConfirmResult — 3-way decision mapping', () => {
  it('maps confirm → continue / cancel → abandon / dismiss → dismiss', () => {
    expect(mapConfirmResult('confirm', 'continue', 'abandon', 'dismiss')).toBe('continue');
    expect(mapConfirmResult('cancel', 'continue', 'abandon', 'dismiss')).toBe('abandon');
    expect(mapConfirmResult('dismiss', 'continue', 'abandon', 'dismiss')).toBe('dismiss');
  });

  it('defaults dismissValue to cancelValue when omitted (back-compat)', () => {
    expect(mapConfirmResult('dismiss', 'continue', 'abandon')).toBe('abandon');
  });
});

describe('SessionManager restore preserves revealed state (continue path)', () => {
  it('restored session carries revealed=true and correct index/queue', () => {
    const session = SessionManager.serialize(['c1', 'c2', 'c3'], 1, true);
    const restored = SessionManager.restore(session, new Set(['c1', 'c2', 'c3']));
    expect(restored.valid).toBe(true);
    expect(restored.queueIds).toEqual(['c1', 'c2', 'c3']);
    expect(restored.currentIndex).toBe(1);
    expect(restored.revealed).toBe(true);
  });

  it('abandon clears the active session (Store integration)', async () => {
    const { Store } = await import('../src/store');
    const store = new Store({ loadData: async () => null, saveData: async () => {} });
    await store.load();
    store.setActiveSession(SessionManager.serialize(['c1'], 0, false));
    expect(store.getActiveSession()).toBeDefined();
    store.setActiveSession(undefined); // abandon path
    expect(store.getActiveSession()).toBeUndefined();
  });
});
