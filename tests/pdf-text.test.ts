import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { assertPdfText, assertRecallPdfText, PdfTextError } from '../shared/pdf-text';
import { createDemoWorkspace } from '../shared/demo';
import { applyCommand } from '../shared/domain';
import { createRecallPdf } from '../server/pdf';
import { createApp } from '../server/app';
import { exportRecallPdf, exportRecallCsv } from '../src/lib/export';
import { downloadFile } from '../src/lib/api';
import type { Recall, SessionResponse } from '../shared/types';

vi.mock('../src/lib/api', () => ({ downloadFile: vi.fn() }));

function savedRecall(): Recall {
  const workspace = applyCommand(
    createDemoWorkspace(),
    {
      type: 'recall.create',
      payload: {
        id: 'font-review',
        sourceId: 'lot-paprika-a',
        title: 'Supplier alert review',
        reason: 'Exercise based on a recorded supplier alert.',
        mode: 'drill',
      },
    },
    '2026-09-22T12:00:00.000Z',
  );
  return workspace.recalls[0];
}

describe('faithful PDF text repertoire', () => {
  it('accepts printable ASCII, Latin-1 and every printable WinAnsi addition', () => {
    const ascii = Array.from({ length: 95 }, (_, index) => String.fromCodePoint(index + 32)).join('');
    const latin1 = Array.from({ length: 96 }, (_, index) => String.fromCodePoint(index + 160)).join('');
    expect(() => assertPdfText(`${ascii}${latin1}ƒˆ˜ŒœŠšŸŽž–—‘’‚“”„†‡•…‰‹›€™\t\r\n`, 'test')).not.toThrow();
    expect(() => assertPdfText('Crème brûlée · £12 — “São Tomé” – €15', 'test')).not.toThrow();
  });

  it.each([
    ['Hindi', 'लाल मिर्च', 0x0932],
    ['emoji', 'Sauce 🌶️', 0x1f336],
    ['CJK', '辣椒', 0x8fa3],
    ['Cyrillic', 'Соус', 0x0421],
    ['combining accent', 'Cafe\u0301', 0x0301],
    ['unpaired surrogate', '\ud800', 0xd800],
    ['C1 control', '\u0080', 0x0080],
    ['NUL', 'Sauce\u0000', 0],
    ['DEL', '\u007f', 0x007f],
  ])('rejects %s rather than substituting a different glyph', (_label, value, point) => {
    try {
      assertPdfText(value as string, 'product name');
      throw new Error('Expected PDF text rejection.');
    } catch (error) {
      expect(error).toBeInstanceOf(PdfTextError);
      expect(error).toMatchObject({ code: 'PDF_UNSUPPORTED_TEXT', field: 'product name', codePoint: point });
      expect((error as Error).message).toContain('Export JSON or CSV');
      expect((error as Error).message).not.toContain(value);
    }
  });

  it('scans workspace, report metadata, every evidence record and gap without modifying data', () => {
    expect(() => assertRecallPdfText('मसाला', savedRecall())).toThrow('workspace name');
    const changes: Array<(recall: Recall) => void> = [
      (r) => {
        r.title = 'नाम';
      },
      (r) => {
        r.reason = 'कारण';
      },
      (r) => {
        r.snapshot.lots[0].supplier = '供給者';
      },
      (r) => {
        r.snapshot.lots[0].source = 'प्राप्ति पर्ची';
      },
      (r) => {
        r.snapshot.batches[0].notes = 'मूल समीक्षा';
      },
      (r) => {
        r.snapshot.batches[0].name = 'लाल मिर्च सॉस';
      },
      (r) => {
        r.snapshot.shipments[0].customer = '客户';
      },
      (r) => {
        r.snapshot.shipments[0].contact = '供应商@example.test';
      },
      (r) => {
        r.result.gaps[0].message = 'रिकॉर्ड';
      },
    ];
    for (const change of changes) {
      const recall = savedRecall();
      change(recall);
      const original = JSON.stringify(recall);
      expect(() => assertRecallPdfText('Ember & Oak', recall)).toThrow(PdfTextError);
      expect(JSON.stringify(recall)).toBe(original);
    }
  });

  it('blocks both exporters before producing partial PDF output while CSV and JSON preserve Unicode', async () => {
    const recall = savedRecall();
    recall.snapshot.batches[1].name = 'लाल मिर्च सॉस';
    recall.snapshot.batches[1].source = 'प्राप्ति पर्ची १२३';
    const original = JSON.stringify(recall);
    const download = vi.mocked(downloadFile);
    download.mockClear();
    await expect(exportRecallPdf(recall, 'Ember & Oak')).rejects.toMatchObject({
      code: 'PDF_UNSUPPORTED_TEXT',
    });
    await expect(createRecallPdf('Ember & Oak', recall, false)).rejects.toMatchObject({
      code: 'PDF_UNSUPPORTED_TEXT',
    });
    expect(download).not.toHaveBeenCalled();
    exportRecallCsv(recall);
    expect(download).toHaveBeenCalledOnce();
    expect(download.mock.calls[0][1]).toContain('लाल मिर्च सॉस');
    expect(JSON.stringify(recall)).toBe(original);
  });

  it('continues generating a complete server PDF for accented Latin and supported punctuation', async () => {
    const recall = savedRecall();
    recall.title = 'Crème brûlée · São Tomé — “supplier’s review”';
    recall.snapshot.batches[1].name = 'Piñata – £12 / €15';
    const pdf = await createRecallPdf('Épicerie Œuf', recall, false);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-6).toString().trim()).toBe('%%EOF');
  });

  it('returns actionable HTTP 422 JSON, with no PDF attachment or partial file', async () => {
    const origin = 'http://localhost:5173';
    const app = createApp({ databasePath: ':memory:', appOrigin: origin, rateLimit: false });
    const agent = request.agent(app);
    try {
      const response = await agent.post('/api/auth/demo').set('Origin', origin);
      expect(response.status).toBe(201);
      const session = response.body as SessionResponse;
      const rename = await agent
        .post('/api/commands')
        .set('Origin', origin)
        .set('X-CSRF-Token', session.csrfToken)
        .send({
          id: 'name-command',
          expectedRevision: session.workspace.revision,
          command: { type: 'workspace.rename', payload: { name: 'मसाला' } },
        });
      expect(rename.status).toBe(200);
      const save = await agent
        .post('/api/commands')
        .set('Origin', origin)
        .set('X-CSRF-Token', session.csrfToken)
        .send({
          id: 'save-command',
          expectedRevision: rename.body.revision,
          command: {
            type: 'recall.create',
            payload: {
              id: 'unicode-recall',
              sourceId: 'lot-paprika-a',
              title: 'Review',
              reason: 'Test Unicode workspace',
              mode: 'drill',
            },
          },
        });
      expect(save.status).toBe(200);
      const pdf = await agent.get('/api/recalls/unicode-recall/pdf');
      expect(pdf.status).toBe(422);
      expect(pdf.type).toBe('application/json');
      expect(pdf.headers['content-disposition']).toBeUndefined();
      expect(pdf.body).toMatchObject({ code: 'PDF_UNSUPPORTED_TEXT' });
      expect(pdf.body.error).toContain('Export JSON or CSV');
      expect(pdf.body.error).toContain('workspace name');
      const exported = await agent.get('/api/export');
      expect(exported.status).toBe(200);
      expect(exported.body.name).toBe('मसाला');
    } finally {
      app.locals.db.close();
    }
  });
});
