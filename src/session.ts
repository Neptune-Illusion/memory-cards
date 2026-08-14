/** 活跃复习会话的序列化状态（持久化用）。 */
export interface ActiveSession {
  queueIds: string[];
  currentIndex: number;
  revealed: boolean;
  startedAt: string;
}

/** 会话管理 — 序列化、恢复、中断检测。 */
export class SessionManager {
  /**
   * 序列化当前会话（在评分时或后台 flush 时调用）。
   * 仅保存必要状态以支持"继续"或"放弃"。
   */
  static serialize(queueIds: string[], currentIndex: number, revealed: boolean): ActiveSession {
    return {
      queueIds,
      currentIndex,
      revealed,
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * 恢复会话，过滤已删除的卡片。
   * 如果当前卡片已删除，自动跳到下一张有效卡片或结束。
   */
  static restore(
    session: ActiveSession,
    existingCardIds: Set<string>
  ): { queueIds: string[]; currentIndex: number; revealed: boolean; valid: boolean } {
    // 过滤存在的卡片
    const validQueue = session.queueIds.filter((id) => existingCardIds.has(id));
    if (validQueue.length === 0) {
      return { queueIds: [], currentIndex: 0, revealed: false, valid: false };
    }

    // 调整 currentIndex（可能因删除而越界）
    let newIndex = Math.min(session.currentIndex, validQueue.length - 1);

    return { queueIds: validQueue, currentIndex: newIndex, revealed: session.revealed, valid: true };
  }

  /**
   * 检查会话是否过期（>24 小时视为过期，建议放弃）。
   */
  static isExpired(session: ActiveSession, now: Date): boolean {
    const startTime = new Date(session.startedAt).getTime();
    const age = now.getTime() - startTime;
    return age > 24 * 60 * 60 * 1000;
  }
}
