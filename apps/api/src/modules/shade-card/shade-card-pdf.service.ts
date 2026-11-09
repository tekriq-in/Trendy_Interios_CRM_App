import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface ShadeCardPdfEntry {
  slNo: number;
  area: string;
  units: string[];
  material: string;
  codeName: string;
  remarks?: string;
}

export interface ShadeCardPdfProject {
  title: string;
  clientName?: string;
}

@Injectable()
export class ShadeCardPdfService {
  async generate(project: ShadeCardPdfProject, entries: ShadeCardPdfEntry[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // ── Title bar ────────────────────────────────────────────────────────────
      doc.rect(50, 50, doc.page.width - 100, 30).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
        .text('MATERIAL APPROVAL SHEET', 50, 58, { align: 'center', width: doc.page.width - 100 });

      // ── Header row ───────────────────────────────────────────────────────────
      const headerY = 90;
      const colW = (doc.page.width - 100) / 3;
      doc.rect(50, headerY, doc.page.width - 100, 24).stroke('#334155');
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold');
      doc.text(`CLIENT: ${(project.clientName ?? '—').toUpperCase()}`, 55, headerY + 7, { width: colW - 5 });
      doc.text(`ORDER NO: ${project.title}`, 55 + colW, headerY + 7, { width: colW - 5 });
      doc.text(`DATE: ${today}`, 55 + colW * 2, headerY + 7, { width: colW - 5 });

      // ── Column headers ───────────────────────────────────────────────────────
      const tableTop = 124;
      const colWidths = [35, 110, 85, 120, 100]; // SL NO, AREA/UNITS, MATERIAL, CODE NAME, REMARKS
      const cols = [50, 85, 195, 280, 400];

      doc.rect(50, tableTop, doc.page.width - 100, 18).fill('#334155');
      const headers = ['SL NO', 'AREA / UNITS', 'MATERIAL', 'CODE NAME', 'REMARKS'];
      headers.forEach((h, i) => {
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
          .text(h, cols[i] + 2, tableTop + 5, { width: colWidths[i], align: 'center' });
      });

      // ── Rows ─────────────────────────────────────────────────────────────────
      let y = tableTop + 18;
      const grouped: Record<string, ShadeCardPdfEntry[]> = {};
      entries.forEach((e) => { (grouped[e.area] = grouped[e.area] ?? []).push(e); });

      Object.entries(grouped).forEach(([area, areaEntries]) => {
        // Area header row
        if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
        doc.rect(50, y, doc.page.width - 100, 16).fill('#dcfce7');
        doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold')
          .text(area.toUpperCase(), 55, y + 4, { width: doc.page.width - 110 });
        y += 16;

        areaEntries.forEach((entry) => {
          const rowHeight = Math.max(20, entry.units.length * 12 + 8);
          if (y + rowHeight > doc.page.height - 80) { doc.addPage(); y = 50; }

          doc.rect(50, y, doc.page.width - 100, rowHeight).stroke('#e2e8f0');
          doc.fillColor('#1e293b').fontSize(8).font('Helvetica');

          // SL NO
          doc.text(String(entry.slNo), cols[0], y + 6, { width: colWidths[0], align: 'center' });
          // UNITS
          const unitsText = entry.units.join('\n');
          doc.text(unitsText, cols[1] + 2, y + 4, { width: colWidths[1] - 4 });
          // MATERIAL
          doc.font('Helvetica-Bold')
            .text(entry.material, cols[2] + 2, y + 6, { width: colWidths[2] - 4, align: 'center' });
          // CODE NAME
          doc.font('Helvetica-Bold')
            .text(entry.codeName, cols[3] + 2, y + 6, { width: colWidths[3] - 4 });
          // REMARKS
          doc.font('Helvetica').fillColor('#475569')
            .text(entry.remarks ?? '', cols[4] + 2, y + 6, { width: colWidths[4] - 4 });

          y += rowHeight;
        });
      });

      if (entries.length === 0) {
        doc.fillColor('#94a3b8').fontSize(10).font('Helvetica')
          .text('No entries yet.', 50, y + 20, { align: 'center', width: doc.page.width - 100 });
        y += 40;
      }

      // ── Signature lines ───────────────────────────────────────────────────────
      const sigY = Math.max(y + 40, doc.page.height - 120);
      if (sigY > doc.page.height - 80) { doc.addPage(); }
      const sigTop = sigY > doc.page.height - 80 ? 60 : sigY;
      const sigW = (doc.page.width - 100) / 3;
      ['Client Signature', 'Designer', 'Authorised Signatory'].forEach((label, i) => {
        const sx = 50 + i * sigW;
        doc.moveTo(sx + 10, sigTop + 20).lineTo(sx + sigW - 10, sigTop + 20).stroke('#94a3b8');
        doc.fillColor('#475569').fontSize(8).font('Helvetica')
          .text(label, sx, sigTop + 23, { width: sigW, align: 'center' });
      });

      doc.end();
    });
  }
}
