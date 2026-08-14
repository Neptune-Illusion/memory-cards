import { describe, expect, it, vi } from 'vitest';
import { mapConfirmResult } from '../src/ui/confirmResult';
import { SessionManager } from '../src/session';

describe('mapConfirmResult', () => {
  it('maps confirm to first value', () => {
    expect(mapConfirmResult('confirm', 'continue', 'abandon')).toBe('continue');
  });

  it('maps cancel to second value', () => {
    expect(mapConfirmResult('cancel', 'continue', 'abandon')).toBe('abandon');
  });

  it('maps confirm to generic values', () => {
    expect(mapConfirmResult('confirm', 'yes', 'no')).toBe('yes');
    expect(mapConfirmResult('cancel', 'yes', 'no')).toBe('no');
  });
});

describe('Session lifecycle — open saves, grade saves, close saves', () => {
  it('serialize at open captures initial state', () => {
    const session = SessionManager.serialize(['c1', 'c2', 'c3'], 0, false);
    expect(session.currentIndex).toBe(0);
    expect(session.revealed).toBe(false);
    expect(session.queueIds).toEqual(['c1', 'c2', 'c3']);
  });

  it('serialize after reveal captures revealed=true', () => {
    const session = SessionManager.serialize(['c1', 'c2', 'c3'], 1, true);
    expect(session.revealed).toBe(true);
    expect(session.currentIndex).toBe(1);
  });

  it('serialize after grade advances index and resets revealed', () => {
    const session = SessionManager.serialize(['c1', 'c2', 'c3'], 2, false);
    expect(session.currentIndex).toBe(2);
    expect(session.revealed).toBe(false);
  });

  it('restore preserves revealed state from serialized session', () => {
    const session = SessionManager.serialize(['c1', 'c2', 'c3'], 1, true);
    const existing = new Set(['c1', 'c2', 'c3']);
    const restored = SessionManager.restore(session, existing);
    expect(restored.revealed).toBe(true);
    expect(restored.currentIndex).toBe(1);
  });

  it('restore handles revealed=false after grade', () => {
    const session = SessionManager.serialize(['c1', 'c2', 'c3'], 2, false);
    const existing = new Set(['c1', 'c2', 'c3']);
    const restored = SessionManager.restore(session, existing);
    expect(restored.revealed).toBe(false);
    expect(restored.currentIndex).toBe(2);
  });

  it('full lifecycle: open → reveal → grade → close', () => {
    // Simulate: open at index 0
    let session = SessionManager.serialize(['c1', 'c2', 'c3'], 0, false);
    expect(session.currentIndex).toBe(0);
    expect(session.revealed).toBe(false);

    // User reveals answer
    session = SessionManager.serialize(session.queueIds, session.currentIndex, true);
    expect(session.revealed).toBe(true);

    // User grades, advance to next card
    session = SessionManager.serialize(session.queueIds, session.currentIndex + 1, false);
    expect(session.currentIndex).toBe(1);
    expect(session.revealed).toBe(false);

    // Another reveal + grade
    session = SessionManager.serialize(session.queueIds, session.currentIndex, true);
    session = SessionManager.serialize(session.queueIds, session.currentIndex + 1, false);
    expect(session.currentIndex).toBe(2);

    // Session completed (index >= queue length)
    expect(session.currentIndex).toBe(2);
    expect(session.queueIds.length).toBe(3);
  });
});

describe('Store activeSession integration', () => {
  it('setActiveSession persists and getActiveSession retrieves', async () => {
    const saved: unknown[] = [];
    const persistence = {
      loadData: async () => null,
      saveData: async (data: unknown) => { saved.push(data); },
    };
    const { Store } = await import('../src/store');
    const store = new Store(persistence);
    await store.load();

    const session = SessionManager.serialize(['c1', 'c2'], 1, true);
    store.setActiveSession(session);
    expect(store.getActiveSession()).toEqual(session);
  });

  it('setActiveSession(undefined) clears the session', async () => {
    const persistence = {
      loadData: async () => null,
      saveData: async () => {},
    };
    const { Store } = await import('../src/store');
    const store = new Store(persistence);
    await store.load();

    store.setActiveSession(SessionManager.serialize(['c1'], 0, false));
    expect(store.getActiveSession()).toBeDefined();

    store.setActiveSession(undefined);
    expect(store.getActiveSession()).toBeUndefined();
  });

  it('flush saves pending session data immediately', async () => {
    vi.useFakeTimers();
    try {
      const saved: unknown[] = [];
      const persistence = {
        loadData: async () => null,
        saveData: async (data: unknown) => { saved.push(JSON.parse(JSON.stringify(data))); },
      };
      const { Store } = await import('../src/store');
      const store = new Store(persistence);
      await store.load();

      const session = SessionManager.serialize(['c1', 'c2'], 1, true);
      store.setActiveSession(session);

      // Before flush, nothing saved yet (debounced)
      expect(saved).toHaveLength(0);

      // Flush should save immediately
      await store.flush();
      expect(saved).toHaveLength(1);
      const savedData = saved[0] as any;
      expect(savedData.activeSession).toEqual(session);
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads activeSession from persisted data', async () => {
    const session = SessionManager.serialize(['c1', 'c2'], 1, true);
    const persistence = {
      loadData: async () => ({ activeSession: session }),
      saveData: async () => {},
    };
    const { Store } = await import('../src/store');
    const store = new Store(persistence);
    await store.load();

    expect(store.getActiveSession()).toEqual(session);
  });
});
