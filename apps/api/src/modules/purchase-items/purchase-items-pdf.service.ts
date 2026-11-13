import { Injectable } from '@nestjs/common';
import { PURCHASE_ITEM_STATUS_LABELS, PurchaseItemStatus } from '@ti/shared';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface PurchaseItemPdfRow {
  slNo: number;
  area: string;
  item: string;
  brand: string;
  code: string;
  size: string;
  finish: string;
  quantity: number;
  receivedQty: number;
  balanceQty: number;
  status: PurchaseItemStatus;
}

export interface PurchaseItemPdfProject {
  title: string;
  clientName?: string;
}

const COLUMNS: { header: string; width: number; align: 'left' | 'center' | 'right'; key: keyof PurchaseItemPdfRow }[] = [
  { header: 'S.NO', width: 32, align: 'center', key: 'slNo' },
  { header: 'AREA', width: 82, align: 'left', key: 'area' },
  { header: 'ITEM NAME', width: 132, align: 'left', key: 'item' },
  { header: 'BRAND', width: 72, align: 'left', key: 'brand' },
  { header: 'CODE', width: 72, align: 'left', key: 'code' },
  { header: 'SIZE', width: 62, align: 'left', key: 'size' },
  { header: 'FINISH', width: 72, align: 'left', key: 'finish' },
  { header: 'ORDER QTY', width: 56, align: 'right', key: 'quantity' },
  { header: 'RECEIVED QTY', width: 56, align: 'right', key: 'receivedQty' },
  { header: 'BALANCE QTY', width: 56, align: 'right', key: 'balanceQty' },
  { header: 'STATUS', width: 66, align: 'center', key: 'status' },
];

const MARGIN = 40;
const PAD = 3;

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '');
}

@Injectable()
export class PurchaseItemsPdfService {
  generate(project: PurchaseItemPdfProject, rows: PurchaseItemPdfRow[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const tableWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
      const left = MARGIN;
      const bottomLimit = doc.page.height - MARGIN - 20;
      const today = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata',
      });

      // ── Title + header ─────────────────────────────────────────────────────
      doc.rect(left, MARGIN, tableWidth, 26).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold')
        .text('PURCHASE ITEM LIST', left, MARGIN + 7, { width: tableWidth, align: 'center' });

      const infoY = MARGIN + 32;
      const third = tableWidth / 3;
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold');
      doc.text(`CLIENT: ${(project.clientName ?? '—').toUpperCase()}`, left, infoY, { width: third });
      doc.text(`PROJECT: ${project.title}`, left + third, infoY, { width: third, align: 'center' });
      doc.text(`DATE: ${today}`, left + third * 2, infoY, { width: third, align: 'right' });

      // ── Table ──────────────────────────────────────────────────────────────
      const drawHeader = (y: number): number => {
        // Tall enough for two-line headers ("RECEIVED / QTY")
        doc.rect(left, y, tableWidth, 26).fill('#334155');
        let x = left;
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
        for (const col of COLUMNS) {
          const oneLine = doc.heightOfString(col.header, { width: col.width - PAD * 2 }) < 12;
          doc.text(col.header, x + PAD, y + (oneLine ? 9 : 4), { width: col.width - PAD * 2, align: 'center' });
          x += col.width;
        }
        return y + 26;
      };

      const cellText = (row: PurchaseItemPdfRow, key: keyof PurchaseItemPdfRow): string => {
        if (key === 'status') return PURCHASE_ITEM_STATUS_LABELS[row.status];
        const value = row[key];
        return typeof value === 'number' ? fmtQty(value) : value || '—';
      };

      let y = drawHeader(infoY + 18);
      doc.fontSize(8).font('Helvetica');

      rows.forEach((row, index) => {
        const rowHeight = Math.max(
          18,
          ...COLUMNS.map((c) => doc.heightOfString(cellText(row, c.key), { width: c.width - PAD * 2 }) + 8),
        );
        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          y = drawHeader(MARGIN);
          doc.fontSize(8).font('Helvetica');
        }

        if (index % 2 === 1) doc.rect(left, y, tableWidth, rowHeight).fill('#f8fafc');
        if (row.balanceQty > 0 && row.receivedQty > 0) {
          // partially received — highlight balance cell
          const balX = left + COLUMNS.slice(0, 9).reduce((s, c) => s + c.width, 0);
          doc.rect(balX, y, COLUMNS[9].width, rowHeight).fill('#fef3c7');
        }

        let x = left;
        for (const col of COLUMNS) {
          const bold = col.key === 'item' || col.key === 'balanceQty';
          doc.fillColor('#1e293b').font(bold ? 'Helvetica-Bold' : 'Helvetica')
            .text(cellText(row, col.key), x + PAD, y + 4, { width: col.width - PAD * 2, align: col.align });
          doc.rect(x, y, col.width, rowHeight).lineWidth(0.5).stroke('#cbd5e1');
          x += col.width;
        }
        y += rowHeight;
      });

      if (rows.length === 0) {
        doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
          .text('No purchase items yet.', left, y + 16, { width: tableWidth, align: 'center' });
        y += 40;
      }

      // ── Summary ────────────────────────────────────────────────────────────
      const count = (s: PurchaseItemStatus) => rows.filter((r) => r.status === s).length;
      if (y + 30 > bottomLimit) { doc.addPage(); y = MARGIN; }
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
        .text(
          `Total items: ${rows.length}   ·   Yet to order: ${count('pending')}   ·   Ordered: ${count('ordered')}   ·   Received: ${count('received')}`,
          left, y + 12, { width: tableWidth },
        );

      doc.end();
    });
  }
}
