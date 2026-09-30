// commands/catbox.js (ESM)

// Upload replied image to Catbox (anonymous upload).

// Usage: reply an image with: <prefix>catbox

import { downloadContentFromMessage } from "@whiskeysockets/baileys";

async function streamToBuffer(stream) {

  const chunks = [];

  for await (const c of stream) chunks.push(c);

  return Buffer.concat(chunks);

}

function getQuotedMessage(m) {

  return m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

}

// pull mimetype extension

function extFromMime(mime = "") {

  const x = String(mime).toLowerCase();

  if (x.includes("png")) return "png";

  if (x.includes("webp")) return "webp";

  if (x.includes("gif")) return "gif";

  return "jpg";

}

export default {

  name: "catbox",

  aliases: ["cb", "upload"],

  category: "TOOLS",

  description: "Upload an image to Catbox (reply to an image).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const quoted = getQuotedMessage(m);

    // must be replying to an image

    if (!quoted?.imageMessage) {

      return sock.sendMessage(

        from,

        { text: "Reply to an image with: catbox" },

        { quoted: m }

      );

    }

    try {

      // download image

      const imgMsg = quoted.imageMessage;

      const stream = await downloadContentFromMessage(imgMsg, "image");

      const buf = await streamToBuffer(stream);

      const mime = imgMsg.mimetype || "image/jpeg";

      const ext = extFromMime(mime);

      // Build multipart/form-data manually (no extra deps)

      const boundary = "----BMEDIA_CATBOX_" + Date.now();

      const CRLF = "\r\n";

      const head =

        `--${boundary}${CRLF}` +

        `Content-Disposition: form-data; name="reqtype"${CRLF}${CRLF}` +

        `fileupload${CRLF}` +

        `--${boundary}${CRLF}` +

        `Content-Disposition: form-data; name="fileToUpload"; filename="bmedia.${ext}"${CRLF}` +

        `Content-Type: ${mime}${CRLF}${CRLF}`;

      const tail = `${CRLF}--${boundary}--${CRLF}`;

      const body = Buffer.concat([

        Buffer.from(head, "utf8"),

        buf,

        Buffer.from(tail, "utf8"),

      ]);

      const res = await fetch("https://catbox.moe/user/api.php", {

        method: "POST",

        headers: {

          "Content-Type": `multipart/form-data; boundary=${boundary}`,

          "Content-Length": String(body.length),

        },

        body,

      });

      const text = await res.text();

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ Catbox error: HTTP ${res.status}\n${text}` },

          { quoted: m }

        );

      }

      // Catbox returns the URL as plain text

      const url = String(text || "").trim();

      if (!url.startsWith("http")) {

        return sock.sendMessage(

          from,

          { text: `❌ Catbox error: Unexpected response:\n${url || "(empty)"}` },

          { quoted: m }

        );

      }

      return sock.sendMessage(

        from,

        { text: `✅ Uploaded to Catbox:\n${url}` },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Catbox error: ${String(e?.message || e)}` },

        { quoted: m }

      );

    }

  },

};