import type { Recall, Workspace } from '../../shared/types';
import { assertRecallPdfText } from '../../shared/pdf-text';
import { downloadFile } from './api';
export function exportWorkspace(workspace: Workspace) {
  downloadFile(
    `batchlight-records-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(workspace, null, 2),
  );
}
export function csvValue(value: unknown) {
  const v = String(value ?? '');
  return '"' + (/^[\s]*[=+@\-]/.test(v) ? "'" + v : v).replaceAll('"', '""') + '"';
}
export function exportRecallCsv(recall: Recall) {
  const rows = [
    [
      'classification',
      'batch_code',
      'product',
      'quantity_produced',
      'unit',
      'customer',
      'quantity_shipped',
      'contact',
      'source_reference',
    ],
  ];
  const { result: r, snapshot: s } = recall;
  for (const b of s.batches) {
    const state = r.affectedBatchIds.includes(b.id)
      ? 'recorded_connection'
      : r.investigationBatchIds.includes(b.id)
        ? 'needs_investigation'
        : 'no_recorded_connection';
    const shipments = s.shipments.filter((v) => v.batchId === b.id);
    if (!shipments.length)
      rows.push([state, b.code, b.name, String(b.quantity), b.unit, '', '0', '', b.source]);
    for (const sh of shipments)
      rows.push([
        state,
        b.code,
        b.name,
        String(b.quantity),
        b.unit,
        sh.customer,
        String(sh.quantity),
        sh.contact,
        sh.source,
      ]);
  }
  downloadFile(
    `batchlight-${recall.id}.csv`,
    '\uFEFF' + rows.map((row) => row.map(csvValue).join(',')).join('\r\n'),
    'text/csv;charset=utf-8',
  );
}
export function contactDraft(recall: Recall, customer: string) {
  const { snapshot: s, result: r } = recall;
  const shipments = s.shipments.filter(
    (sh) =>
      sh.customer === customer &&
      (r.shipmentIds.includes(sh.id) || r.investigationShipmentIds.includes(sh.id)),
  );
  return `${recall.mode === 'drill' ? 'REHEARSAL ONLY — DO NOT SEND\n\n' : ''}Subject: Batch record review — ${recall.title}\n\nHello ${customer},\n\nWe are reviewing the following deliveries in connection with ingredient lot ${s.lots.find((l) => l.id === recall.sourceId)?.code || recall.sourceId}:\n\n${shipments
    .map((sh) => {
      const b = s.batches.find((b) => b.id === sh.batchId);
      return `- ${b?.name} (${b?.code}): ${sh.quantity} ${b?.unit}, dispatched ${sh.shippedOn}. ${r.investigationShipmentIds.includes(sh.id) ? 'Input records need investigation.' : 'Recorded ingredient connection.'}`;
    })
    .join(
      '\n',
    )}\n\n${recall.mode === 'drill' ? 'This is a rehearsal draft, not a real recall notice.' : 'Our responsible food safety lead must verify the scope, product identifiers and required action before this message is sent.'}\n\nReason recorded: ${recall.reason}\n\nPlease review with your responsible food safety lead before use.\n`;
}
export async function exportRecallPdf(recall: Recall, workspaceName: string, isDemo = false) {
  assertRecallPdfText(workspaceName, recall);
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ink: [number, number, number] = [24, 62, 54],
    gray: [number, number, number] = [90, 100, 95];
  doc.setFillColor(...ink);
  doc.rect(0, 0, 210, 48, 'F');
  doc.setTextColor(255);
  doc.setFontSize(12);
  doc.text('batchlight.', 15, 16);
  doc.setFontSize(24);
  doc.text(recall.mode === 'drill' ? 'Recall rehearsal' : 'Incident review', 15, 31);
  doc.setFontSize(9);
  doc.text(`${workspaceName}  /  ${new Date(recall.createdAt).toISOString()}`, 15, 41);
  doc.setTextColor(...ink);
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(recall.title, 178);
  doc.text(titleLines, 15, 62);
  let y = 64 + titleLines.length * 8;
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  const text = (value: string) => {
    const lines = doc.splitTextToSize(value, 178);
    for (const line of lines) {
      if (y > 274) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 15, y);
      y += 5;
    }
    y += 5;
  };
  if (isDemo)
    text('SYNTHETIC DEMONSTRATION DATA. All businesses, records and contacts in this packet are fictional.');
  text(`Reason: ${recall.reason}`);
  text(
    'Based on recorded connections only. Missing records, cross-contact, labelling mistakes and unrecorded movement may change the scope. This document is not a food-safety clearance or a regulatory certification.',
  );
  const r = recall.result;
  text(
    `${r.affectedBatchIds.length} connected batch records | ${r.affectedUnits} finished units connected | ${r.shippedUnits} units shipped | ${r.onHandUnits} units on hand | ${r.customerCount} recorded customers.`,
  );
  text(
    `Investigation required: ${r.investigationBatchIds.length} batch records. No recorded connection: ${r.unconnectedBatchIds.length} batch records. These groups are separate from confirmed recorded connections.`,
  );
  const table = (title: string, head: string[], body: string[][]) => {
    if (y > 235) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(...ink);
    doc.setFontSize(14);
    doc.text(title, 15, y);
    autoTable(doc, {
      startY: y + 5,
      head: [head],
      body,
      margin: { left: 15, right: 15, bottom: 20 },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: ink },
      alternateRowStyles: { fillColor: [246, 247, 243] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 13;
  };
  table(
    'Batch scope',
    ['Code', 'Product', 'Status', 'Output'],
    recall.snapshot.batches.map((b) => [
      b.code,
      b.name,
      r.affectedBatchIds.includes(b.id)
        ? 'Recorded connection'
        : r.investigationBatchIds.includes(b.id)
          ? 'Needs investigation'
          : 'No recorded connection',
      `${b.quantity} ${b.unit}`,
    ]),
  );
  table(
    'Customer deliveries to review',
    ['Customer / contact', 'Batch', 'Quantity', 'Status'],
    recall.snapshot.shipments
      .filter((s) => r.shipmentIds.includes(s.id) || r.investigationShipmentIds.includes(s.id))
      .map((s) => [
        `${s.customer}\n${s.contact}`,
        recall.snapshot.batches.find((b) => b.id === s.batchId)?.code || s.batchId,
        `${s.quantity} ${recall.snapshot.batches.find((b) => b.id === s.batchId)?.unit || ''}`,
        r.shipmentIds.includes(s.id) ? 'Recorded connection' : 'Needs investigation',
      ]),
  );
  table(
    'Source references',
    ['Record', 'Reference'],
    [...recall.snapshot.lots, ...recall.snapshot.batches, ...recall.snapshot.shipments].map((v) => [
      v.code,
      v.source,
    ]),
  );
  table(
    'Recorded ingredient links',
    ['Output batch', 'Input source', 'Quantity in source unit'],
    recall.snapshot.batches.flatMap((b) =>
      b.inputs.map((i) => {
        const source = [...recall.snapshot.lots, ...recall.snapshot.batches].find((x) => x.id === i.sourceId);
        return [b.code, source?.code || i.sourceId, `${i.quantity} ${source?.unit || ''}`];
      }),
    ),
  );
  if (r.gaps.length)
    table(
      'Record gaps',
      ['Batch', 'What needs investigation'],
      r.gaps.map((g) => [
        recall.snapshot.batches.find((b) => b.id === g.batchId)?.code || g.batchId,
        g.message,
      ]),
    );
  doc.addPage();
  y = 20;
  doc.setFontSize(18);
  doc.setTextColor(...ink);
  doc.text('Response checklist', 15, y);
  y += 12;
  doc.setFontSize(10);
  text('1. Confirm the supplier alert, identifiers and scope with your responsible food safety lead.');
  text('2. Investigate missing input records and check unrecorded movement and cross-contact.');
  text('3. Verify on-site stock and customer deliveries against the original documents.');
  text('4. Review required notifications and actions with the responsible lead.');
  text('5. Record actions in your incident system. Closing this record is administrative only.');
  for (const customer of new Set(
    recall.snapshot.shipments
      .filter((s) => r.shipmentIds.includes(s.id) || r.investigationShipmentIds.includes(s.id))
      .map((s) => s.customer),
  )) {
    doc.addPage();
    y = 20;
    doc.setTextColor(...ink);
    doc.setFontSize(16);
    doc.text('Customer contact draft', 15, y);
    y += 12;
    doc.setFontSize(10);
    text(contactDraft(recall, customer));
  }
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(recall)))),
  )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  doc.addPage();
  y = 20;
  doc.setFontSize(15);
  doc.text('Snapshot integrity', 15, y);
  y += 13;
  doc.setFontSize(9);
  text(`Snapshot ID: ${recall.id}`);
  text(`SHA-256 of JSON.stringify(saved recall): ${digest}`);
  text(
    'This digest can identify a changed export. It does not verify the truth of entered records or provide an independently anchored digital signature.',
  );
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text(
      `Batchlight / ${recall.mode === 'drill' ? 'REHEARSAL - NOT A RECALL NOTICE' : 'REVIEW REQUIRED'}`,
      15,
      287,
    );
    doc.text(`${p} / ${doc.getNumberOfPages()}`, 184, 287);
  }
  doc.save(`batchlight-${recall.mode}-${recall.id}.pdf`);
}
