import type { MemoryCardsSettings } from '../types';
import type { GeneratedCard } from './cardDeduplicator';

/**
 * Build a prompt for the AI to generate flashcards from extracted text.
 * Truncates input to stay within token limits.
 */
export function buildCardGenerationPrompt(
  text: string,
  settings: MemoryCardsSettings
): string {
  const maxLen = 4000;
  const truncated = text.length > maxLen;
  const body = text.slice(0, maxLen) + (truncated ? '\n\n... [文本已截断]' : '');

  return `你是专业学习卡片设计师。基于以下文本生成高质量记忆卡片。

【规则】
1. 每张卡片包含：问题（简洁具体）、答案（完整自含）、注解（可选，记忆技巧）
2. 优先生成 ${settings.newPerDay} 张高质量卡片
3. 避免是/否问题
4. 保留原文中的 LaTeX 公式和 Markdown 格式

【格式（严格 JSON）】
\`\`\`json
{
  "cards": [
    {
      "question": "问题？",
      "answer": "答案",
      "note": "记忆技巧"
    }
  ]
}
\`\`\`

【待生成文本】
${body}`;
}

/**
 * Parse JSON response from AI model into GeneratedCard array.
 * Handles common formatting issues (extra text around JSON, markdown fences).
 */
export function parseGeneratedCards(response: string): GeneratedCard[] {
  try {
    // Try to extract JSON block from response
    const jsonMatch = response.match(/\{[\s\S]*"cards"[\s\S]*\}/);
    if (!jsonMatch) return [];
    const data = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(data.cards)) return [];
    return data.cards
      .filter(
        (c: any) =>
          typeof c.question === 'string' &&
          typeof c.answer === 'string' &&
          c.question.trim().length > 0 &&
          c.answer.trim().length > 0
      )
      .map((c: any) => ({
        question: c.question.trim(),
        answer: c.answer.trim(),
        note: typeof c.note === 'string' ? c.note.trim() : undefined,
      }));
  } catch {
    return [];
  }
}
