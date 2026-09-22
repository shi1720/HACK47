import type { Recall } from './types';

// Both PDFKit and jsPDF encode their built-in Helvetica fonts with WinAnsi.
// These are its printable Unicode additions to ASCII and Latin-1, not the
// similarly numbered C1 control characters in Windows-1252's byte range.
const WIN_ANSI_ADDITIONS = new Set([
  0x0192, 0x02c6, 0x02dc, 0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x2013, 0x2014, 0x2018,
  0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac,
  0x2122,
]);

export class PdfTextError extends Error {
  readonly code = 'PDF_UNSUPPORTED_TEXT';
  constructor(
    readonly field: string,
    readonly codePoint: number,
  ) {
    super(
      `This PDF font cannot faithfully represent a character (U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}) in ${field}. Export JSON or CSV to preserve the original text.`,
    );
    this.name = 'PdfTextError';
  }
}

/** No transliteration or normalization: the stored evidence remains untouched. */
export function assertPdfText(text: string, field: string): void {
  for (const character of text) {
    const point = character.codePointAt(0)!;
    if (
      point === 9 ||
      point === 10 ||
      point === 13 ||
      (point >= 0x20 && point <= 0x7e) ||
      (point >= 0xa0 && point <= 0xff) ||
      WIN_ANSI_ADDITIONS.has(point)
    )
      continue;
    throw new PdfTextError(field, point);
  }
}

/** Check the whole saved evidence envelope before either exporter creates a PDF. */
export function assertRecallPdfText(workspaceName: string, recall: Recall): void {
  assertPdfText(workspaceName, 'workspace name');
  const scan = (value: unknown, field: string) => {
    if (typeof value === 'string') assertPdfText(value, field);
    else if (Array.isArray(value)) value.forEach((item, index) => scan(item, `${field} ${index + 1}`));
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        // Path map keys are user identifiers; do not echo their contents in errors.
        scan(child, field === 'saved report.result.paths' ? `${field} entry` : `${field}.${key}`);
      }
    }
  };
  scan(recall, 'saved report');
}
