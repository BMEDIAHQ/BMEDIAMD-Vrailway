import { downloadContentFromMessage } from "@whiskeysockets/baileys";

const API_URL = "https://pageshot.site/v1/html";
const MAX_HTML_BYTES = 500 * 1024;
const MAX_REPLY_BYTES = 8 * 1024 * 1024;

function box(title, lines) {
  return [
    `╭─〔 ${title} 〕`,
    ...lines.map((line, i) => `${i === lines.length - 1 ? "╰" : "├"}◦ ${line}`),
    "",
    "> POWERED BY BMEDIA",
  ].join("\n");
}

function quotedMessage(m) {
  const root = m?.message || {};
  const ctx =
    root.extendedTextMessage?.contextInfo ||
    root.imageMessage?.contextInfo ||
    root.videoMessage?.contextInfo ||
    root.documentMessage?.contextInfo ||
    root.buttonsResponseMessage?.contextInfo ||
    root.listResponseMessage?.contextInfo;
  return ctx?.quotedMessage || null;
}

function textFromMessage(msg) {
  if (!msg) return "";
  return String(
    msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      msg.documentMessage?.caption ||
      ""
  );
}

async function streamToBuffer(stream, maxBytes = MAX_REPLY_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const b = Buffer.from(chunk);
    total += b.length;
    if (total > maxBytes) throw new Error("HTML file is too large.");
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

async function readQuotedHtml(m) {
  const q = quotedMessage(m);
  if (!q) return "";

  const text = textFromMessage(q).trim();
  if (text) return text;

  const doc = q.documentMessage;
  if (!doc) return "";

  const fileName = String(doc.fileName || "").toLowerCase();
  const mime = String(doc.mimetype || "").toLowerCase();
  const looksHtml =
    fileName.endsWith(".html") ||
    fileName.endsWith(".htm") ||
    mime.includes("text/html") ||
    mime.includes("text/plain");

  if (!looksHtml) {
    throw new Error("Reply to an .html/.htm file or a text message containing HTML.");
  }

  const stream = await downloadContentFromMessage(doc, "document");
  const buffer = await streamToBuffer(stream);
  return buffer.toString("utf8").trim();
}

function looksLikeHtml(value) {
  const s = String(value || "").trim();
  return /<\/?[a-z][\s\S]*>/i.test(s) || /^<!doctype\s+html/i.test(s);
}

async function renderHtml(html) {
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) {
    throw new Error(`HTML is too large (${Math.ceil(bytes / 1024)} KB). Maximum is 500 KB.`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BMEDIA-MD/5.2",
      },
      body: JSON.stringify({
        html,
        width: 1080,
        height: 1350,
        full_page: true,
        format: "png",
        device_scale: 1,
      }),
      signal: controller.signal,
    });

    const contentType = String(response.headers.get("content-type") || "");
    const body = Buffer.from(await response.arrayBuffer());

    if (!response.ok) {
      let detail = body.toString("utf8").trim();
      try {
        const parsed = JSON.parse(detail);
        detail = parsed?.error || parsed?.message || detail;
      } catch {}
      throw new Error(`Renderer returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
    }

    if (!contentType.startsWith("image/") || body.length < 100) {
      const detail = body.toString("utf8").trim().slice(0, 300);
      throw new Error(`Renderer did not return an image${detail ? `: ${detail}` : "."}`);
    }

    return body;
  } finally {
    clearTimeout(timer);
  }
}

export default {
  name: "html",
  aliases: ["renderhtml", "html2img", "html2image"],
  category: "TOOLS",
  description: "Render HTML/CSS as an image and send it in WhatsApp.",

  async execute(ctx) {
    const { sock, m, from, args, prefix } = ctx;

    try {
      const inline = String(args?.join(" ") || "").trim();
      const replied = inline ? "" : await readQuotedHtml(m);
      const html = inline || replied;

      if (!html) {
        return sock.sendMessage(
          from,
          {
            text: box("*HTML RENDER*", [
              `${prefix}html <html code>`,
              `Or reply to HTML text/file with ${prefix}html`,
              "The rendered page is returned as an image.",
            ]),
          },
          { quoted: m }
        );
      }

      if (!looksLikeHtml(html)) {
        return sock.sendMessage(
          from,
          { text: box("*HTML RENDER*", ["No valid HTML markup was detected."]) },
          { quoted: m }
        );
      }

      const wait = await sock.sendMessage(
        from,
        { text: "⏳ Rendering HTML..." },
        { quoted: m }
      );

      const image = await renderHtml(html);

      const sent = await sock.sendMessage(
        from,
        {
          image,
          mimetype: "image/png",
          caption: "✅ HTML rendered successfully.",
        },
        { quoted: m }
      );

      // Best-effort cleanup of the temporary progress message.
      try {
        if (wait?.key) await sock.sendMessage(from, { delete: wait.key });
      } catch {}

      return sent;
    } catch (e) {
      const reason = e?.name === "AbortError"
        ? "The renderer timed out. Try a smaller/simpler page."
        : String(e?.message || e);

      return sock.sendMessage(
        from,
        { text: box("*HTML RENDER ERROR*", [reason.slice(0, 700)]) },
        { quoted: m }
      );
    }
  },
};
