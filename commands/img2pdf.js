
// commands/img2pdf.js (ESM)
// Reply an image -> convert to PDF (requires: npm i pdf-lib@^1.17.1)
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks);
}
function getQuoted(m){ return m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null; }

export default {
  name: "img2pdf",
  aliases: ["topdf"],
  category: "TOOLS",
  description: "Convert replied image to PDF.",
  async execute(ctx) {
    const { sock, m, from } = ctx;
    const quoted = getQuoted(m);
    const img = quoted?.imageMessage;
    if (!img) return sock.sendMessage(from, { text:"Reply an image with: img2pdf" }, { quoted:m });

    try {
      const { PDFDocument } = await import("pdf-lib");
      const stream = await downloadContentFromMessage(img, "image");
      const buf = await streamToBuffer(stream);

      const pdf = await PDFDocument.create();
      let embedded;
      try { embedded = await pdf.embedJpg(buf); } catch { embedded = await pdf.embedPng(buf); }
      const page = pdf.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });

      const bytes = await pdf.save();
      return sock.sendMessage(from, { document: Buffer.from(bytes), mimetype: "application/pdf", fileName: "BMEDIA-image.pdf" }, { quoted:m });
    } catch (e) {
      return sock.sendMessage(from, { text:`❌ img2pdf error: ${e?.message || e}` }, { quoted:m });
    }
  },
};
