import PDFDocument from 'pdfkit';
import type { Recall, Shipment } from '../shared/types.js';
import { canonicalJson, hashToken } from './security.js';

const ink = '#173C34';
const muted = '#5B6C66';
const green = '#E8F1DF';
const amber = '#FFF1D5';
const rule = '#DBE2D9';
const plain = (text: unknown) => String(text ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** Uses the immutable saved recall snapshot, never live records. */
export function createRecallPdf(workspaceName: string, recall: Recall, isDemo: boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margin: 48,
      bufferPages: true,
      info: {
        Title: `Batchlight ${recall.mode}: ${plain(recall.title)}`,
        Author: plain(workspaceName),
        Subject: 'Saved traceability snapshot and customer contact drafts',
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    const width = document.page.width - 96;
    const bottom = () => document.page.height - 75;
    let activeFont = 'Helvetica';
    let activeSize = 10;
    function font(name: string, size: number) {
      activeFont = name;
      activeSize = size;
      return document.font(name).fontSize(size);
    }
    document.on('pageAdded', () => {
      document.fillColor(ink).font('Helvetica-Bold').fontSize(10).text('BATCHLIGHT', 48, 36);
      document
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(8)
        .text(`${recall.mode.toUpperCase()} / SAVED SNAPSHOT`, 320, 38, { width: 227, align: 'right' });
      document.x = 48;
      document.y = 70;
      document.font(activeFont).fontSize(activeSize);
    });
    function page() {
      document.addPage();
    }
    function room(height: number) {
      if (document.y + height > bottom()) page();
    }
    function text(value: string, size = 10, color = ink) {
      font('Helvetica', size);
      const height = document.heightOfString(plain(value), { width });
      room(height + 12);
      document.fillColor(color).text(plain(value), 48, document.y, { width, lineGap: 3 });
      document.moveDown(0.6);
    }
    function heading(value: string, subtitle?: string) {
      room(66);
      font('Helvetica-Bold', 18).fillColor(ink).text(value, 48, document.y, { width });
      document.moveDown(0.45);
      if (subtitle) text(subtitle, 9, muted);
    }
    function note(value: string, color = green) {
      font('Helvetica', 9);
      const height = document.heightOfString(plain(value), { width: width - 24 }) + 24;
      room(height + 16);
      const top = document.y;
      document.roundedRect(48, top, width, height, 7).fill(color);
      document.fillColor(ink).text(plain(value), 60, top + 12, { width: width - 24, lineGap: 2 });
      document.y = top + height + 14;
    }
    function item(title: string, body: string) {
      font('Helvetica', 9);
      const bodyHeight = document.heightOfString(plain(body), { width: width - 20 });
      font('Helvetica-Bold', 10);
      const titleHeight = document.heightOfString(plain(title), { width: width - 20 });
      room(bodyHeight + titleHeight + 35);
      const top = document.y;
      document
        .moveTo(48, top)
        .lineTo(48 + width, top)
        .strokeColor(rule)
        .lineWidth(0.6)
        .stroke();
      font('Helvetica-Bold', 10)
        .fillColor(ink)
        .text(plain(title), 48, top + 10, { width });
      document.moveDown(0.35);
      font('Helvetica', 9).fillColor(muted).text(plain(body), 48, document.y, { width, lineGap: 3 });
      document.moveDown(0.9);
    }
    const snapshot = recall.snapshot;
    const source = [...snapshot.lots, ...snapshot.batches].find((value) => value.id === recall.sourceId);
    const connected = new Set(recall.result.affectedBatchIds);
    const investigate = new Set(recall.result.investigationBatchIds);
    const connectedShipments = new Set(recall.result.shipmentIds);
    const uncertainShipments = new Set(recall.result.investigationShipmentIds);
    const impactedShipments = snapshot.shipments.filter(
      (s) => connectedShipments.has(s.id) || uncertainShipments.has(s.id),
    );
    const digest = hashToken(
      canonicalJson({ recallId: recall.id, sourceId: recall.sourceId, result: recall.result, snapshot }),
    );

    document.rect(0, 0, document.page.width, 11).fill(ink);
    document.fillColor(ink).font('Helvetica-Bold').fontSize(13).text('BATCHLIGHT', 48, 42);
    document.fillColor(muted).font('Helvetica').fontSize(9).text('Know your next move.', 48, 61);
    document.y = 110;
    document
      .fillColor(ink)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(recall.mode === 'drill' ? 'RECALL REHEARSAL' : 'INCIDENT WORKSPACE', 48, document.y);
    document.moveDown(0.7);
    document
      .font('Helvetica-Bold')
      .fontSize(30)
      .text(plain(recall.title), 48, document.y, { width, lineGap: 2 });
    document.moveDown(0.45);
    text(workspaceName, 13);
    const savedAt = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(recall.createdAt));
    text(`Record time ${savedAt} UTC  |  ${recall.status.toUpperCase()}  |  Record ${recall.id}`, 8, muted);
    if (isDemo)
      note(
        'SYNTHETIC DEMONSTRATION DATA. The organizations, ingredients, batches and contact details in this packet are fictional.',
        amber,
      );
    note(
      recall.mode === 'drill'
        ? 'DRILL ONLY. This document rehearses a response. It is not a recall notice, and no customer or authority has been contacted.'
        : 'WORKING INCIDENT PACKET. Review all records and coordinate decisions with your responsible food-safety lead and applicable authorities. No notifications have been sent.',
      amber,
    );
    text(recall.reason, 11);
    heading('What the records connect');
    const number = (value: number) =>
      new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(value);
    text(
      `${number(recall.result.affectedUnits)} connected finished units  /  ${number(recall.result.shippedUnits)} shipped  /  ${number(recall.result.onHandUnits)} on hand`,
      12,
    );
    text(
      `${recall.result.customerCount} recorded ${recall.result.customerCount === 1 ? 'customer' : 'customers'} with a connected shipment. Quantities count outputs recorded in units; mass and volume stay in the item register.`,
      9,
      muted,
    );
    text(
      `${recall.result.affectedBatchIds.length} connected ${recall.result.affectedBatchIds.length === 1 ? 'batch' : 'batches'}  /  ${recall.result.investigationBatchIds.length} ${recall.result.investigationBatchIds.length === 1 ? 'batch' : 'batches'} needing investigation  /  ${recall.result.shipmentIds.length} connected ${recall.result.shipmentIds.length === 1 ? 'shipment' : 'shipments'}`,
    );
    text(`Trace source: ${source ? `${source.code} - ${source.name}` : recall.sourceId}`);
    text(
      'A recorded connection follows a path in the saved records. Needs investigation means incomplete records leave the connection unresolved. No recorded connection does not mean safe.',
      10,
      muted,
    );
    note(
      'This packet organizes user-supplied records. It does not verify their truth, diagnose a hazard, determine legal recall obligations, or provide a food-safety or regulatory-compliance guarantee.',
    );

    page();
    heading(
      'Trace and evidence',
      'The following source references were preserved when this trace was saved. Later edits do not change this packet.',
    );
    if (source)
      item(
        `Starting point / ${source.code}`,
        `${source.name}\nSource reference: ${source.source || 'Not recorded'}`,
      );
    for (const batch of snapshot.batches) {
      const status = connected.has(batch.id)
        ? 'RECORDED CONNECTION'
        : investigate.has(batch.id)
          ? 'NEEDS INVESTIGATION'
          : 'NO RECORDED CONNECTION';
      const path = recall.result.paths[batch.id]
        ?.map((id) => [...snapshot.lots, ...snapshot.batches].find((record) => record.id === id)?.code || id)
        .join(' -> ');
      const inputs =
        batch.inputs
          .map((input) => {
            const record = [...snapshot.lots, ...snapshot.batches].find(
              (value) => value.id === input.sourceId,
            );
            return `${record?.code || input.sourceId}: ${input.quantity} ${record?.unit || '(source unit)'}`;
          })
          .join('; ') || 'No inputs recorded';
      item(
        `${batch.code} / ${status}`,
        `${batch.name} | Produced ${batch.producedOn} | Output ${batch.quantity} ${batch.unit}\nInputs: ${inputs}\n${path ? `Recorded path: ${path}\n` : ''}Record completeness: ${batch.recordsComplete ? 'marked complete by recorder' : 'incomplete'}\nSource reference: ${batch.source || 'Not recorded'}${batch.notes ? `\nRecorder notes: ${batch.notes}` : ''}`,
      );
    }
    if (!snapshot.batches.length) text('No production batches existed in the saved snapshot.');
    heading('Investigation checklist');
    if (recall.result.gaps.length) {
      for (const gap of recall.result.gaps)
        text(
          `[ ] ${snapshot.batches.find((batch) => batch.id === gap.batchId)?.code || gap.batchId}: ${gap.message}`,
          10,
        );
    } else
      text(
        'No incomplete-record gaps were identified by this trace. This is a record-quality result, not a food-safety determination.',
      );
    text(
      '[ ] Verify source lot identity and the original supplier notice.\n[ ] Compare the saved input records with production paperwork.\n[ ] Confirm current stock and shipment quantities.\n[ ] Have the responsible person review the scope and next actions.\n[ ] Document any calls, decisions, and corrected source records.',
      10,
    );

    page();
    heading(
      'Shipment register',
      'Connected shipments and shipments needing investigation are listed separately by their record status.',
    );
    for (const shipment of impactedShipments) {
      const batch = snapshot.batches.find((value) => value.id === shipment.batchId);
      item(
        `${shipment.code} / ${connectedShipments.has(shipment.id) ? 'RECORDED CONNECTION' : 'NEEDS INVESTIGATION'}`,
        `${shipment.customer}\nContact: ${shipment.contact || 'Not recorded'}\nBatch: ${batch?.code || shipment.batchId} | ${shipment.quantity} ${batch?.unit || 'units'} | Shipped ${shipment.shippedOn}\nSource reference: ${shipment.source || 'Not recorded'}`,
      );
    }
    if (!impactedShipments.length)
      text(
        'No connected or investigation shipments appear in the saved records. This does not rule out shipments that were never recorded.',
      );
    heading('Source-lot register');
    for (const lot of snapshot.lots)
      item(
        `${lot.code} / ${lot.name}`,
        `Supplier: ${lot.supplier}\nReceived: ${lot.receivedOn}${lot.expiresOn ? ` | Expires: ${lot.expiresOn}` : ''}\nReceived quantity: ${lot.quantity} ${lot.unit} | Saved status: ${lot.status}\nSource reference: ${lot.source || 'Not recorded'}`,
      );

    const customerGroups = new Map<string, Shipment[]>();
    for (const shipment of impactedShipments) {
      const key = `${shipment.customer}\u0000${shipment.contact}`;
      customerGroups.set(key, [...(customerGroups.get(key) || []), shipment]);
    }
    page();
    heading(
      'Customer contact drafts',
      'Drafts for human review. Exporting this packet does not send a message. Confirm recipient, records, and instructions before use.',
    );
    if (!customerGroups.size)
      text('No customer contact drafts: no connected or investigation shipments were recorded.');
    for (const shipments of customerGroups.values()) {
      const customer = shipments[0];
      const labels = shipments
        .map((s) => `${s.code} (${snapshot.batches.find((b) => b.id === s.batchId)?.code || s.batchId})`)
        .join(', ');
      const uncertainty = shipments.some((s) => uncertainShipments.has(s.id));
      item(
        `To: ${customer.customer} / ${customer.contact || 'Contact to be confirmed'}`,
        `Subject: ${recall.mode === 'drill' ? '[DRILL - NO ACTUAL RECALL] Traceability exercise' : '[DRAFT FOR REVIEW] Product traceability inquiry'} - ${plain(workspaceName)}\n\nHello ${customer.customer},\n\n${recall.mode === 'drill' ? 'We are rehearsing our traceability process. This is a drill and not an actual recall notice.' : 'We are reviewing a product traceability concern. Please confirm receipt of this inquiry and the shipment records below.'}\n\nOur saved records identify these shipments for review: ${labels}. ${uncertainty ? 'At least one shipment needs investigation because the input record is incomplete; a connection has not been established for that shipment.' : 'These shipments have a recorded path to the source under review.'}\n\nPlease confirm the quantities received and the quantities remaining, and identify an appropriate contact for follow-up.\n\n[Responsible person: insert verified, product-specific next steps and contact details before sending.]\n\nThank you,\n${plain(workspaceName)}`,
      );
    }
    room(135);
    heading('Snapshot integrity');
    text('SHA-256 of the canonical saved trace and source snapshot:', 9, muted);
    text(digest, 8, muted);
    text(
      'This fingerprint helps detect changes when compared with a trusted original. It is not a digital signature, independent timestamp, or proof that the source records are authentic. Record time may be supplied by the recording device; server audit time separately records acceptance.',
      9,
      muted,
    );
    const pages = document.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index++) {
      document.switchToPage(index);
      // PDFKit otherwise treats footer text below the content margin as overflow
      // and silently appends an empty page for every numbered page.
      const previousBottomMargin = document.page.margins.bottom;
      document.page.margins.bottom = 0;
      document
        .moveTo(48, document.page.height - 53)
        .lineTo(48 + width, document.page.height - 53)
        .strokeColor(rule)
        .lineWidth(0.6)
        .stroke();
      document
        .font('Helvetica')
        .fontSize(7)
        .fillColor(muted)
        .text(
          `BATCHLIGHT / ${isDemo ? 'SYNTHETIC DATA / ' : ''}${recall.mode.toUpperCase()} / Human review required`,
          48,
          document.page.height - 40,
          { lineBreak: false },
        );
      document.text(`${index + 1} / ${pages.count}`, document.page.width - 87, document.page.height - 40, {
        width: 39,
        align: 'right',
        lineBreak: false,
      });
      document.page.margins.bottom = previousBottomMargin;
    }
    document.end();
  });
}
