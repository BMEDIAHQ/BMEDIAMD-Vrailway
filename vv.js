// commands/vv.js (ESM)

// Extract and resend view-once media (image/video/voice-note).

// Works for:

// - view once images

// - view once videos

// - view once voice notes (audio / ptt)

//

// Usage: reply to a view-once media with: .vv / .vo / .viewonce

import { getContentType, downloadContentFromMessage } from "@whiskeysockets/baileys";

import fs from "fs/promises";

import path from "path";

import { tmpdir } from "os";

function unwrapMessage(msg) {

  if (!msg) return null;

  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);

  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);

  if (msg.viewOnceMessageV2Extension?.message) return unwrapMessage(msg.viewOnceMessageV2Extension.message);

  return msg;

}

function getQuotedMessage(m) {

  const msg = unwrapMessage(m?.message) || {};

  const contextInfo =

    msg?.extendedTextMessage?.contextInfo ||

    Object.values(msg).find((v) => v?.contextInfo)?.contextInfo;

  return contextInfo?.quotedMessage || null;

}

function detectViewOnce(m) {

  // Check both direct message and quoted message

  const sources = [unwrapMessage(m?.message), unwrapMessage(getQuotedMessage(m))];

  for (const root of sources) {

    if (!root) continue;

    const type = getContentType(root);

    // IMAGE

    if (type === "imageMessage" || root.imageMessage?.viewOnce) {

      const media = root.imageMessage;

      if (media) return { kind: "image", media, caption: media.caption || "" };

    }

    // VIDEO

    if (type === "videoMessage" || root.videoMessage?.viewOnce) {

      const media = root.videoMessage;

      if (media) return { kind: "video", media, caption: media.caption || "" };

    }

    // VOICE NOTE / AUDIO (view-once voice message)

    // WhatsApp "view once voice notes" typically appear as audioMessage with viewOnce=true

    if (type === "audioMessage" || root.audioMessage?.viewOnce) {

      const media = root.audioMessage;

      if (media) {

        // voice notes are usually ptt=true, but we keep it generic

        return {

          kind: "audio",

          media,

          caption: "", // audio doesn't support caption display reliably

          ptt: Boolean(media.ptt),

          mimetype: media.mimetype || "audio/ogg; codecs=opus",

        };

      }

    }

  }

  return null;

}

async function streamToBuffer(stream) {

  const chunks = [];

  for await (const c of stream) chunks.push(c);

  return Buffer.concat(chunks);

}

async function handle(sock, m, from) {

  const info = detectViewOnce(m);

  if (!info) {

    return sock.sendMessage(

      from,

      { text: "❌ Please reply to a view-once image/video/voice-note to extract it." },

      { quoted: m }

    );

  }

  try {

    // Download decrypted content

    const stream = await downloadContentFromMessage(info.media, info.kind);

    const buffer = await streamToBuffer(stream);

    // Caption formatting (keep simple)

    const caption =

      `> *POWERED BY BMEDIA*` +

      (info.caption ? `\n*Caption:* ${info.caption}` : "");

    if (info.kind === "image") {

      return await sock.sendMessage(from, { image: buffer, caption }, { quoted: m });

    }

    if (info.kind === "video") {

      const tempPath = path.join(tmpdir(), `vo_${Date.now()}.mp4`);

      await fs.writeFile(tempPath, buffer);

      await sock.sendMessage(from, { video: { url: tempPath }, caption }, { quoted: m });

      await fs.unlink(tempPath).catch(() => {});

      return;

    }

    if (info.kind === "audio") {

      // audio needs a file for stable sending on many hosts

      const ext = info.mimetype?.includes("mpeg") ? "mp3" : "ogg";

      const tempPath = path.join(tmpdir(), `vo_${Date.now()}.${ext}`);

      await fs.writeFile(tempPath, buffer);

      // send a small text “caption” first (since audio captions aren’t consistent)

      await sock.sendMessage(from, { text: `> *POWERED BY BMEDIA*` }, { quoted: m });

      await sock.sendMessage(

        from,

        {

          audio: { url: tempPath },

          mimetype: info.mimetype || "audio/ogg; codecs=opus",

          ptt: Boolean(info.ptt), // keep voice-note behavior if it was a ptt

        },

        { quoted: m }

      );

      await fs.unlink(tempPath).catch(() => {});

      return;

    }

  } catch (err) {

    console.error("Extraction error:", err);

    return sock.sendMessage(

      from,

      { text: "❌ Failed to extract media. The message might be too old or expired." },

      { quoted: m }

    );

  }

}

// Helpers to extract components from your context

function pickSock(ctxOrSock) {

  return ctxOrSock?.sock || ctxOrSock?.conn || ctxOrSock?.client || ctxOrSock;

}

function pickMessage(ctxOrM) {

  return ctxOrM?.m || ctxOrM;

}

function pickFrom(ctx, m) {

  return ctx?.from || m?.key?.remoteJid || ctx?.chat || ctx?.jid;

}

const command = {

  name: "viewonce",

  aliases: ["vo", "vv"],

  category: "TOOLS",

  description: "Extract and resend view-once media.",

  async execute(ctx) {

    const sock = pickSock(ctx);

    const m = pickMessage(ctx);

    const from = pickFrom(ctx, m);

    return handle(sock, m, from);

  },

  async run(sock, m) {

    const from = m?.key?.remoteJid;

    return handle(sock, m, from);

  },

};

export { command };

export default command;