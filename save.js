// commands/save.js (ESM)

// Usage: reply to a normal image/video/audio/document with: !save

// It downloads the quoted media and re-sends it back to the chat.

// NOTE: This does NOT bypass view-once.

import baileysModule from "@whiskeysockets/baileys";

const baileys = baileysModule.default || baileysModule;

// Some Baileys builds export different helpers; we support both patterns

const downloadMediaMessage = baileys.downloadMediaMessage;

const downloadContentFromMessage = baileys.downloadContentFromMessage;

function getQuotedMessage(m) {

  const ctx = m?.message?.extendedTextMessage?.contextInfo;

  return ctx?.quotedMessage || null;

}

function detectType(q) {

  if (!q) return null;

  if (q.imageMessage) return { type: "image", msg: q.imageMessage };

  if (q.videoMessage) return { type: "video", msg: q.videoMessage };

  if (q.audioMessage) return { type: "audio", msg: q.audioMessage };

  if (q.documentMessage) return { type: "document", msg: q.documentMessage };

  if (q.stickerMessage) return { type: "sticker", msg: q.stickerMessage };

  return null;

}

function isViewOnce(q) {

  // normal media sometimes has viewOnce flag; wrappers exist too (we refuse)

  if (!q) return false;

  if (q.viewOnceMessage || q.viewOnceMessageV2 || q.viewOnceMessageV2Extension) return true;

  const t = detectType(q);

  if (!t?.msg) return false;

  return !!t.msg.viewOnce;

}

async function streamToBuffer(stream) {

  const chunks = [];

  for await (const chunk of stream) chunks.push(chunk);

  return Buffer.concat(chunks);

}

async function downloadByContentHelper(mediaMsg, type) {

  if (typeof downloadContentFromMessage !== "function") {

    throw new Error("downloadContentFromMessage is not available in your Baileys build");

  }

  const stream = await downloadContentFromMessage(mediaMsg, type);

  return streamToBuffer(stream);

}

export default {

  name: "save",

  aliases: ["get", "dl", "download"],

  category: "TOOLS",

  description: "Download and re-send quoted media (non view-once).",

  async execute(ctx) {

    const { sock, m, from, prefix } = ctx;

    const quoted = getQuotedMessage(m);

    if (!quoted) {

      return sock.sendMessage(

        from,

        { text: `Reply to an image/video/audio/document with ${prefix}save` },

        { quoted: m }

      );

    }

    // Refuse view-once content

    if (isViewOnce(quoted)) {

      return sock.sendMessage(

        from,

        { text: "❌ I can’t save view-once media. Ask the sender to resend normally." },

        { quoted: m }

      );

    }

    const info = detectType(quoted);

    if (!info) {

      return sock.sendMessage(from, { text: "❌ Unsupported quoted message type." }, { quoted: m });

    }

    const { type, msg: mediaMsg } = info;

    try {

      // Prefer downloadMediaMessage if available (some builds)

      let buffer = null;

      if (typeof downloadMediaMessage === "function") {

        // Needs the full message object. We'll reconstruct a minimal one:

        const fakeMsg = { message: quoted };

        buffer = await downloadMediaMessage(fakeMsg, "buffer", {}, { logger: console });

      } else {

        // Fallback to downloadContentFromMessage

        buffer = await downloadByContentHelper(mediaMsg, type);

      }

      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {

        return sock.sendMessage(from, { text: "❌ Download failed (empty file)." }, { quoted: m });

      }

      // Re-send

      if (type === "image") {

        return sock.sendMessage(from, { image: buffer, caption: "✅ Saved" }, { quoted: m });

      }

      if (type === "video") {

        return sock.sendMessage(from, { video: buffer, caption: "✅ Saved" }, { quoted: m });

      }

      if (type === "audio") {

        return sock.sendMessage(from, { audio: buffer, mimetype: "audio/mpeg" }, { quoted: m });

      }

      if (type === "sticker") {

        return sock.sendMessage(from, { sticker: buffer }, { quoted: m });

      }

      // document

      const fileName = mediaMsg.fileName || "file";

      const mimetype = mediaMsg.mimetype || "application/octet-stream";

      return sock.sendMessage(

        from,

        { document: buffer, fileName, mimetype, caption: "✅ Saved" },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Failed: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};