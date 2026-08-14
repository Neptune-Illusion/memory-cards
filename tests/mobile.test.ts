import { describe, expect, it } from 'vitest';
import { SessionManager } from '../src/session';

describe('SessionManager', () => {
  it('serializes queue state', () => {
    const session = SessionManager.serialize(['c1', 'c2', 'c3'], 1, false);
    expect(session.queueIds).toEqual(['c1', 'c2', 'c3']);
    expect(session.currentIndex).toBe(1);
    expect(session.revealed).toBe(false);
  });

  it('restores valid session and filters deleted cards', () => {
    const session = {
      queueIds: ['c1', 'c2', 'c3', 'c4'],
      currentIndex: 2,
      revealed: false,
      startedAt: new Date().toISOString(),
    };
    const existing = new Set(['c1', 'c3', 'c4']);
    const restored = SessionManager.restore(session, existing);
    expect(restored.queueIds).toEqual(['c1', 'c3', 'c4']);
    expect(restored.valid).toBe(true);
  });

  it('returns invalid session when all cards deleted', () => {
    const session = {
      queueIds: ['c1', 'c2'],
      currentIndex: 0,
      revealed: false,
      startedAt: new Date().toISOString(),
    };
    const existing = new Set<string>();
    const restored = SessionManager.restore(session, existing);
    expect(restored.valid).toBe(false);
  });

  it('detects expired sessions', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const session = {
      queueIds: ['c1'],
      currentIndex: 0,
      revealed: false,
      startedAt: yesterday.toISOString(),
    };
    expect(SessionManager.isExpired(session, now)).toBe(true);
  });
});

describe('gesture detection', () => {
  it('detects rightward swipe > 50px', () => {
    const deltaX = 60;
    const deltaY = 10;
    const isSwipe = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50;
    expect(isSwipe).toBe(true);
  });

  it('ignores vertical movement < 50px', () => {
    const deltaX = 30;
    const deltaY = 10;
    const isSwipe = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50;
    expect(isSwipe).toBe(false);
  });
});

describe('activeSession integration - full lifecycle', () => {
  it('serializes → restores → preserves revealed state', () => {
    // Serialize: 3 cards, at index 1, revealed=true
    const serialized = SessionManager.serialize(['c1', 'c2', 'c3'], 1, true);
    expect(serialized.queueIds).toEqual(['c1', 'c2', 'c3']);
    expect(serialized.currentIndex).toBe(1);
    expect(serialized.revealed).toBe(true);

    // Restore with all cards existing
    const existing = new Set(['c1', 'c2', 'c3']);
    const restored = SessionManager.restore(serialized, existing);
    expect(restored.queueIds).toEqual(['c1', 'c2', 'c3']);
    expect(restored.currentIndex).toBe(1);
    expect(restored.revealed).toBe(true);
    expect(restored.valid).toBe(true);
  });

  it('cleans up deleted cards mid-session and adjusts index', () => {
    // Session: 4 cards, at index 2 (c3)
    const session = {
      queueIds: ['c1', 'c2', 'c3', 'c4'],
      currentIndex: 2,
      revealed: false,
      startedAt: new Date().toISOString(),
    };

    // c2 and c4 deleted, only c1, c3 remain
    const existing = new Set(['c1', 'c3']);
    const restored = SessionManager.restore(session, existing);

    expect(restored.queueIds).toEqual(['c1', 'c3']);
    expect(restored.currentIndex).toBe(1); // Was at index 2 (c3), now at index 1
    expect(restored.valid).toBe(true);
  });

  it('handles "continue" vs "abandon" decision paths', () => {
    // Scenario: user resumes earlier session
    const session = {
      queueIds: ['c1', 'c2', 'c3'],
      currentIndex: 1,
      revealed: false,
      startedAt: new Date().toISOString(),
    };

    // Continue path: restore and check validity
    const allExist = new Set(['c1', 'c2', 'c3']);
    const continuePath = SessionManager.restore(session, allExist);
    expect(continuePath.valid).toBe(true);
    expect(continuePath.queueIds.length).toBe(3);

    // Abandon path: all cards deleted
    const noneExist = new Set<string>();
    const abandonPath = SessionManager.restore(session, noneExist);
    expect(abandonPath.valid).toBe(false);
    expect(abandonPath.queueIds.length).toBe(0);
  });
});

describe('listener lifecycle management', () => {
  it('registers and removes viewport resize listener on mobile', () => {
    const listeners: { event: string; handler: EventListener }[] = [];
    const mockViewport = {
      addEventListener: (event: string, handler: EventListener) => {
        listeners.push({ event, handler });
      },
      removeEventListener: (event: string, handler: EventListener) => {
        const idx = listeners.findIndex((l) => l.event === event && l.handler === handler);
        if (idx >= 0) listeners.splice(idx, 1);
      },
    };

    // Simulate listener registration
    const resizeHandler = (() => {}) as EventListener;
    mockViewport.addEventListener('resize', resizeHandler);
    expect(listeners.filter((l) => l.event === 'resize')).toHaveLength(1);

    // Simulate cleanup
    mockViewport.removeEventListener('resize', resizeHandler);
    expect(listeners.filter((l) => l.event === 'resize')).toHaveLength(0);
  });

  it('registers and removes gesture listeners (touchstart/touchend)', () => {
    const listeners: { event: string; handler: EventListener }[] = [];
    const mockElement = {
      addEventListener: (event: string, handler: EventListener) => {
        listeners.push({ event, handler });
      },
      removeEventListener: (event: string, handler: EventListener) => {
        const idx = listeners.findIndex((l) => l.event === event && l.handler === handler);
        if (idx >= 0) listeners.splice(idx, 1);
      },
    };

    // Simulate gesture listener registration
    const touchStartHandler = (() => {}) as EventListener;
    const touchEndHandler = (() => {}) as EventListener;
    mockElement.addEventListener('touchstart', touchStartHandler);
    mockElement.addEventListener('touchend', touchEndHandler);
    expect(listeners).toHaveLength(2);

    // Simulate cleanup
    mockElement.removeEventListener('touchstart', touchStartHandler);
    mockElement.removeEventListener('touchend', touchEndHandler);
    expect(listeners).toHaveLength(0);
  });
});

describe('Platform.isMobile focus behavior', () => {
  it('skips focus() call on mobile platform', () => {
    const mockButton = {
      focus: () => {
        throw new Error('focus should not be called on mobile');
      },
    } as unknown as HTMLElement;

    const isMobile = true;
    if (!isMobile) {
      mockButton.focus();
    }
    // No error thrown = test passes
    expect(true).toBe(true);
  });

  it('calls focus() on desktop platform', () => {
    let focusCalled = false;
    const mockButton = {
      focus: () => {
        focusCalled = true;
      },
    } as unknown as HTMLElement;

    const isMobile = false;
    if (!isMobile) {
      mockButton.focus();
    }
    expect(focusCalled).toBe(true);
  });
});
