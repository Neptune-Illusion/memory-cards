import type { MemoryCardsSettings } from '../types';
import type { GeneratedCard } from './cardDeduplicator';

/** Maximum characters per chunk to stay within token limits. */
const CHUNK_SIZE = 3000;
/** Overlap between chunks to avoid splitting mid-concept. */
const CHUNK_OVERLAP = 500;

/**
 * Split text into overlapping chunks for per-chunk card generation.
 */
export function splitIntoChunks(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

/**
 * Build a prompt for one chunk. Asks for atomic knowledge points —
 * each knowledge point becomes exactly one card.
 */
export function buildChunkPrompt(
  chunkText: string,
  chunkIndex: number,
  totalChunks: number,
  settings: MemoryCardsSettings,
  cardsPerChunk: number
): string {
  return `你是专业学习卡片设计师。从以下文本片段中提取原子知识点，每个知识点生成恰好一张记忆卡片。

【要求】
- 每个知识点 = 一张卡片（question/answer/note）
- 问题简洁具体，避免是/否问题
- 答案完整自含，无需参考原文
- 注解提供记忆技巧（可选）
- 保留 LaTeX 公式和 Markdown 格式
- 目标生成 ${cardsPerChunk} 张卡片（根据内容密度可少不可多）
- 只输出 JSON，不要其他文字

【格式（严格 JSON）】
\`\`\`json
{
  "cards": [
    {
      "question": "问题？",
      "answer": "答案",
      "note": "记忆技巧",
      "source": "chunk_${chunkIndex + 1}/${totalChunks}"
    }
  ]
}
\`\`\`

【文本片段 ${chunkIndex + 1}/${totalChunks}】
${chunkText}`;
}

/**
 * Parse JSON response from AI model into GeneratedCard array.
 */
export function parseGeneratedCards(response: string): GeneratedCard[] {
  try {
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
        source: typeof c.source === 'string' ? c.source : undefined,
      }));
  } catch {
    return [];
  }
}
