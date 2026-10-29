// A minimal text-only PDF writer for the demo invoices: one Helvetica line per text line, A4,
// no dependencies, so it runs the same in the browser, the server and the generator script.
// n8n's "Extract From File" (pdf.js) reads the text back in the same order.

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;
const LEADING = 15;
const LINES_PER_PAGE = Math.floor((PAGE_H - 2 * MARGIN) / LEADING);

// PDF strings: escape the delimiters and keep to printable Latin-1 (the demo texts are ASCII).
const pdfText = (s: string) =>
  s
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const toBytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

export function invoicePdf(text: string): Uint8Array<ArrayBuffer> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([""]);

  // Objects 1 catalog, 2 page tree, 3 Helvetica, 4 Helvetica-Bold, then a page + content pair
  // per page. The first line of the document is set in bold, larger, as the title.
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((pageLines, p) => {
    const ops = pageLines.map((line, i) => {
      const title = p === 0 && i === 0;
      const y = PAGE_H - MARGIN - i * LEADING;
      return `BT /${title ? "F2 14" : "F1 10"} Tf ${MARGIN} ${y} Td (${pdfText(line)}) Tj ET`;
    });
    const stream = ops.join("\n");
    objects[pageIds[p]!] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[p]! + 1} 0 R >>`;
    objects[pageIds[p]! + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return toBytes(out);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
