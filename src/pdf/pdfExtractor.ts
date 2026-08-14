import type { TFile, App } from 'obsidian';

/**
 * PDF text extraction using pdfjs-dist (lazy-loaded).
 * Returns null for scanned/image-only PDFs so the caller can show a clear notice.
 */
export class PDFExtractor {
  static async extract(file: TFile, app: App): Promise<string | null> {
    try {
      const buffer = await app.vault.readBinary(file);
      // Lazy-load pdfjs-dist to avoid bloating initial bundle
      const pdfjsLib = await import('pdfjs-dist');
      // Do NOT set GlobalWorkerOptions.workerSrc to a CDN — Electron blocks
      // external resources via CSP.  Leaving it unset makes pdfjs-dist fall
      // back to main-thread parsing, which is fine for MVP text extraction.

      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const textParts: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        if (pageText.trim()) textParts.push(pageText);
      }

      const fullText = textParts.join('\n\n').trim();
      // If no extractable text found, likely a scanned/image PDF
      return fullText.length > 0 ? fullText : null;
    } catch (err) {
      console.error('PDF extraction failed:', err);
      return null;
    }
  }
}
