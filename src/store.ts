import { createState } from './scheduler';
import { toDayKey } from './stats';
import {
  DEFAULT_SETTINGS,
  type CardState,
  type MemoryCardsSettings,
  type PluginData,
  type ReviewLogEntry,
} from './types';
import type { ActiveSession } from './session';
import type { AIConfig } from './ui/aiConfigPanel';
import { DEFAULT_AI_CONFIG, normalizeAIConfig } from './ui/aiConfigPanel';

const MAX_LOG_ENTRIES = 5000;

export interface Persistence {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
}

/**
 * Review state persistence (SPEC §7). Notes stay the single source of truth for card
 * content; only progress lives here, so a corrupted store can be rebuilt from notes.
 * Writes are debounced to keep grading responsive.
 */
export class Store {
  private data: PluginData = {
    settings: { ...DEFAULT_SETTINGS },
    states: {},
    reviewLog: [],
    reviewedDays: [],
    newCardsIntroduced: {},
  };

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: Promise<void> | null = null;
  private background = false;

  constructor(private readonly persistence: Persistence) {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.background = true;
          void this.flush();
        } else {
          this.background = false;
        }
      });
    }
  }

  async load(): Promise<void> {
    const raw = (await this.persistence.loadData()) as Partial<PluginData> | null;
    if (!raw) return;
    this.data = {
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
      states: raw.states ?? {},
      reviewLog: Array.isArray(raw.reviewLog) ? raw.reviewLog : [],
      reviewedDays: Array.isArray(raw.reviewedDays) ? raw.reviewedDays : [],
      newCardsIntroduced: raw.newCardsIntroduced ?? {},
      activeSession: raw.activeSession,
    };
  }

  get settings(): MemoryCardsSettings {
    return this.data.settings;
  }

  get states(): Record<string, CardState> {
    return this.data.states;
  }

  get reviewLog(): ReviewLogEntry[] {
    return this.data.reviewLog;
  }

  get reviewedDays(): string[] {
    return this.data.reviewedDays;
  }

  getActiveSession(): ActiveSession | undefined {
    return this.data.activeSession;
  }

  setActiveSession(session: ActiveSession | undefined): void {
    this.data.activeSession = session;
    this.scheduleSave();
  }

  updateSettings(patch: Partial<MemoryCardsSettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.scheduleSave();
  }

  getState(cardId: string): CardState | undefined {
    return this.data.states[cardId];
  }

  /** Return the existing state or create (and persist) a fresh one. */
  ensureState(cardId: string, now: Date): CardState {
    const existing = this.data.states[cardId];
    if (existing) return existing;
    const state = createState(now);
    this.data.states[cardId] = state;
    this.scheduleSave();
    return state;
  }

  setState(cardId: string, state: CardState): void {
    this.data.states[cardId] = state;
    this.scheduleSave();
  }

  newCardsIntroducedToday(now: Date): number {
    return this.data.newCardsIntroduced[toDayKey(now)] ?? 0;
  }

  countNewCardIntroduced(now: Date): void {
    const key = toDayKey(now);
    this.data.newCardsIntroduced[key] = (this.data.newCardsIntroduced[key] ?? 0) + 1;
    this.scheduleSave();
  }

  recordReview(entry: ReviewLogEntry, now: Date): void {
    if (this.data.settings.keepReviewLog) {
      this.data.reviewLog.push(entry);
      if (this.data.reviewLog.length > MAX_LOG_ENTRIES) {
        this.data.reviewLog = this.data.reviewLog.slice(-MAX_LOG_ENTRIES);
      }
    }
    const day = toDayKey(now);
    if (!this.data.reviewedDays.includes(day)) {
      this.data.reviewedDays.push(day);
    }
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.pendingSave = this.persistence.saveData(this.data);
  }

  /** Drop states whose cards no longer exist in the vault. */
  pruneOrphans(existingIds: Set<string>): number {
    let removed = 0;
    for (const id of Object.keys(this.data.states)) {
      if (!existingIds.has(id)) {
        delete this.data.states[id];
        removed += 1;
      }
    }
    if (removed > 0) this.scheduleSave();
    return removed;
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.pendingSave = this.persistence.saveData(this.data);
    }, 300);
  }

  get aiConfig(): AIConfig {
    return this.data.aiConfig ?? { ...DEFAULT_AI_CONFIG };
  }

  normalizeAIConfig(): void {
    if (this.data.aiConfig) {
      this.data.aiConfig = normalizeAIConfig(this.data.aiConfig);
    }
  }

  setAIConfig(config: AIConfig): void {
    this.data.aiConfig = normalizeAIConfig(config);
    this.scheduleSave();
  }

  /** Flush any pending write. Call on plugin unload or app background. */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.pendingSave = this.persistence.saveData(this.data);
    }
    if (this.pendingSave) {
      await this.pendingSave;
      this.pendingSave = null;
    }
  }

  isBackground(): boolean {
    return this.background;
  }
}
