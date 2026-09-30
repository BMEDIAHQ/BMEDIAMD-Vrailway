// commands/pdf.js
// Text -> PDF (no external deps)
// FIXES:
// 1) Preserves newlines/paragraphs even when args are space-split (uses raw message text after ".pdf").
// 2) Supports bold lines using WhatsApp-style markers: *bold* or **bold** (stars are removed in PDF).
// 3) Also auto-bolds "heading" lines (ALL CAPS, short) even without *.
//
// Output:
// - document name: bmedia_pdf.pdf
// - uses ./temp/pdf-<id>/ then cleans up

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const TEMP_ROOT = path.join(process.cwd(), "temp");
const TEMP_PREFIX = "pdf-";
const STALE_MS = 15 * 60 * 1000; // 15 minutes

async function ensureTempDir() {
  await fsp.mkdir(TEMP_ROOT, { recursive: true });
}

async function rmSafe(p) {
  if (!p) return;
  try {
    await fsp.rm(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
}

async function cleanupStale() {
  try {
    await ensureTempDir();
    const now = Date.now();
    const entries = await fsp.readdir(TEMP_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (!e.name.startsWith(TEMP_PREFIX)) continue;
      const full = path.join(TEMP_ROOT, e.name);
      try {
        const st = await fsp.stat(full);
        const age = now - Math.max(Number(st.mtimeMs || 0), Number(st.ctimeMs || 0));
        if (age >= STALE_MS) await rmSafe(full);
      } catch {
        await rmSafe(full);
      }
    }
  } catch {}
}

function getQuotedMessage(m) {
  return (
    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    m?.message?.imageMessage?.contextInfo?.quotedMessage ||
    m?.message?.videoMessage?.contextInfo?.quotedMessage ||
    m?.message?.documentMessage?.contextInfo?.quotedMessage ||
    m?.msg?.contextInfo?.quotedMessage ||
    null
  );
}

function extractTextFromAny(msg) {
  if (!msg) return "";
  if (typeof msg.conversation === "string") return msg.conversation;
  if (typeof msg.extendedTextMessage?.text === "string") return msg.extendedTextMessage.text;
  if (typeof msg.imageMessage?.caption === "string") return msg.imageMessage.caption;
  if (typeof msg.videoMessage?.caption === "string") return msg.videoMessage.caption;
  if (typeof msg.documentMessage?.caption === "string") return msg.documentMessage.caption;
  return "";
}

function stripCommandFromText(fullText) {
  let s = String(fullText || "");
  s = s.replace(/^\s*[.!/#]?(pdf|topdf|makepdf)\b[ \t]*/i, "");
  s = s.replace(/^\n/, "");
  return s;
}

function getInputText(m, args) {
  const full = extractTextFromAny(m?.message);

  // Preserve user formatting when they send:
  // .pdf\nLINE1\nLINE2...
  if (full && full.includes("\n")) {
    const stripped = stripCommandFromText(full);
    if (stripped.trim()) return stripped;
  }

  const fromArgs = String((args || []).join(" ") || "").trim();
  if (fromArgs) return fromArgs;

  const quoted = getQuotedMessage(m);
  const qText = extractTextFromAny(quoted);
  if (qText) return qText;

  if (full) {
    const stripped = stripCommandFromText(full);
    return stripped || full;
  }

  return "";
}

function toAsciiSafe(s) {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("")
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (ch === "\n") return "\n";
      if (c >= 32 && c <= 126) return ch;
      if (c === 9) return " ";
      return "?";
    })
    .join("");
}

function escapePdfText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(line, maxChars) {
  const out = [];
  let s = String(line || "");
  while (s.length > maxChars) {
    let cut = s.lastIndexOf(" ", maxChars);
    if (cut < 20) cut = maxChars;
    out.push(s.slice(0, cut).trimEnd());
    s = s.slice(cut).trimStart();
  }
  if (s.length) out.push(s);
  return out;
}

function isAllCapsHeading(line) {
  const t = String(line || "").trim();
  if (!t) return false;
  if (/^[_\-=]{3,}$/.test(t)) return false;
  if (t.length > 40) return false;

  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;

  const upper = (letters.match(/[A-Z]/g) || []).length;
  const ratio = upper / letters.length;
  return ratio >= 0.9;
}

function parseBold(line) {
  const t = String(line || "");
  const m = t.match(/^\s*\*{1,2}(.+?)\*{1,2}\s*$/);
  if (m) return { text: m[1], bold: true };
  return { text: t, bold: isAllCapsHeading(t) };
}

function wrapTextWithStyles(text, maxChars = 90) {
  const lines = String(text || "").split("\n");
  const out = [];
  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      out.push({ text: "", bold: false });
      continue;
    }

    const parsed = parseBold(rawLine);
    const pieces = wrapLine(parsed.text, maxChars);

    for (const p of pieces) out.push({ text: p, bold: parsed.bold });
  }
  return out;
}

function buildPdfBuffer(rawText) {
  const safe = toAsciiSafe(rawText);
  const lines = wrapTextWithStyles(safe, 90);

  const LINES_PER_PAGE = 45;
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([{ text: "", bold: false }]);

  const objs = [];

  // Fonts:
  // F1 = Helvetica
  // F2 = Helvetica-Bold
  const kidsRefs = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${pages.length} >>`;
  objs[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;

  for (let i = 0; i < pages.length; i++) {
    const pageNum = 5 + i * 2;
    const contentNum = 6 + i * 2;

    objs[pageNum] =
      `<< /Type /Page /Parent 2 0 R ` +
      `/MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
      `/Contents ${contentNum} 0 R >>`;

    const pageLines = pages[i];

    const fontSize = 12;
    const startX = 72;
    const startY = 800;
    const lineH = 14;

    let stream = "BT\n";
    stream += `/F1 ${fontSize} Tf\n`;
    stream += `${startX} ${startY} Td\n`;

    for (let li = 0; li < pageLines.length; li++) {
      const line = pageLines[li];
      const font = line.bold ? "F2" : "F1";
      stream += `/${font} ${fontSize} Tf\n`;
      stream += `(${escapePdfText(line.text || "")}) Tj\n`;
      if (li !== pageLines.length - 1) stream += `0 -${lineH} Td\n`;
    }

    stream += "ET\n";

    const length = Buffer.byteLength(stream, "latin1");
    objs[contentNum] = `<< /Length ${length} >>\nstream\n${stream}endstream`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  offsets[0] = 0;

  const totalObjs = Object.keys(objs)
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  for (const n of totalObjs) {
    offsets[n] = Buffer.byteLength(pdf, "latin1");
    pdf += `${n} 0 obj\n${objs[n]}\nendobj\n`;
  }

  const xrefPos = Buffer.byteLength(pdf, "latin1");
  const size = Math.max(...totalObjs) + 1;

  pdf += "xref\n";
  pdf += `0 ${size}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < size; i++) {
    const off = offsets[i] ?? 0;
    pdf += String(off).padStart(10, "0") + " 00000 n \n";
  }

  pdf += "trailer\n";
  pdf += `<< /Size ${size} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefPos}\n`;
  pdf += "%%EOF\n";

  return Buffer.from(pdf, "latin1");
}

export default {
  name: "pdf",
  aliases: ["topdf", "makepdf"],
  category: "TOOLS",
  description: "Convert text to a PDF file.",
  usage: "pdf <text> (or reply to a text message)",

  async execute(ctx) {
    const { sock, m, from, args } = ctx;

    const text = getInputText(m, args);
    if (!String(text || "").trim()) {
      return sock.sendMessage(
        from,
        { text: "❌ Send text or reply to a text message.\nExample:\n.pdf\nHello\nWorld" },
        { quoted: m }
      );
    }

    const jobId = randomUUID();
    const workDir = path.join(TEMP_ROOT, `${TEMP_PREFIX}${jobId}`);
    const pdfPath = path.join(workDir, "bmedia_pdf.pdf");

    try {
      await ensureTempDir();
      await cleanupStale();
      await fsp.mkdir(workDir, { recursive: true });

      const buf = buildPdfBuffer(text);
      await fsp.writeFile(pdfPath, buf);

      await sock.sendMessage(
        from,
        {
          document: { url: pdfPath },
          mimetype: "application/pdf",
          fileName: "bmedia_pdf.pdf",
          caption: "📄✅ Here is your PDF",
        },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: `❌ PDF failed.\n${e?.message || e}` },
        { quoted: m }
      );
    } finally {
      await rmSafe(workDir);
      await cleanupStale();
      try {
        if (typeof global.gc === "function") global.gc();
      } catch {}
    }
  },
};
