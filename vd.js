// commands/vd.js (ESM)

import { getContentType, downloadContentFromMessage } from "@whiskeysockets/baileys";

import fs from "fs/promises";

import path from "path";

import { tmpdir } from "os";

import { isOwner } from "../checks/isOwner.js";

function getSender(m) {

  return (

    m?.key?.participant ||

    m?.participant ||

    m?.sender ||

    m?.key?.remoteJid

  );

}

const tagOf = (jid) => `@${String(jid || "").split("@")[0].split(":")[0]}`;

function toUserJid(input) {

  const n = String(input || "").split("@")[0].split(":")[0].replace(/[^\d]/g, "");

  if (!n) return null;

  return `${n}@s.whatsapp.net`;

}

function getOwnerDmJidFromEnv() {

  const raw = String(process.env.OWNER_NUMBER || "").trim();

  return toUserJid(raw);

}

function unwrapMessage(msg) {

  if (!msg) return null;

  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);

  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);

  if (msg.viewOnceMessageV2Extension?.message) return unwrapMessage(msg.viewOnceMessageV2Extension.message);

  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);

  return msg;

}

function getQuotedMessage(m) {

  const msg = m?.message || {};

  const contextInfo =

    msg?.extendedTextMessage?.contextInfo ||

    msg?.imageMessage?.contextInfo ||

    msg?.videoMessage?.contextInfo ||

    msg?.documentMessage?.contextInfo ||

    msg?.conversation?.contextInfo ||

    Object.values(msg).find((v) => v?.contextInfo)?.contextInfo;

  return contextInfo?.quotedMessage || null;

}

async function streamToBuffer(stream) {

  const chunks = [];

  for await (const c of stream) chunks.push(c);

  return Buffer.concat(chunks);

}

function normalizeDest(input) {

  const raw = String(input || "").trim();

  if (!raw) return null;

  return toUserJid(raw);

}

function detectViewOnce(m) {

  const quoted = unwrapMessage(getQuotedMessage(m));

  const direct = unwrapMessage(m?.message);

  const sources = [quoted, direct].filter(Boolean);

  for (const root of sources) {

    const type = getContentType(root);

    if (type === "imageMessage" || root?.imageMessage?.viewOnce) {

      const media = root.imageMessage;

      if (media) return { kind: "image", media };

    }

    if (type === "videoMessage" || root?.videoMessage?.viewOnce) {

      const media = root.videoMessage;

      if (media) return { kind: "video", media };

    }

    if (type === "audioMessage" || root?.audioMessage?.viewOnce) {

      const media = root.audioMessage;

      if (media) {

        return {

          kind: "audio",

          media,

          ptt: Boolean(media.ptt),

          mimetype: media.mimetype || "audio/ogg; codecs=opus",

        };

      }

    }

  }

  return null;

}

export default {

  name: "vd",

  aliases: ["vdowner", "v2dm"],

  category: "OWNER",

  description: "Owner-only: Extract view-once media and send to a destination JID (or OWNER_NUMBER DM).",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const sender = getSender(m) || from;

    if (!isOwner(m, sock)) {

      const tag = tagOf(sender);

      return sock.sendMessage(

        from,

        { text: `❌ Owner only.\n\n${tag}`, mentions: [sender] },

        { quoted: m }

      );

    }

    const dest = normalizeDest(args[0]) || getOwnerDmJidFromEnv();

    if (!dest) {

      return sock.sendMessage(

        from,

        { text: "❌ OWNER_NUMBER is missing/invalid in .env.\nSet: OWNER_NUMBER=237xxxxxxxxx" },

        { quoted: m }

      );

    }

    const info = detectViewOnce(m);

    if (!info) {

      return sock.sendMessage(

        from,

        { text: "❌ Reply to a view-once image/video/voice-note then use: vd [jid/number]" },

        { quoted: m }

      );

    }

    try {

      const stream = await downloadContentFromMessage(info.media, info.kind);

      const buffer = await streamToBuffer(stream);

      if (info.kind === "image") {

        await sock.sendMessage(dest, { image: buffer }, {});

      } else if (info.kind === "video") {

        const tempPath = path.join(tmpdir(), `vd_${Date.now()}.mp4`);

        await fs.writeFile(tempPath, buffer);

        await sock.sendMessage(dest, { video: { url: tempPath } }, {});

        await fs.unlink(tempPath).catch(() => {});

      } else if (info.kind === "audio") {

        const ext = info.mimetype?.includes("mpeg") ? "mp3" : "ogg";

        const tempPath = path.join(tmpdir(), `vd_${Date.now()}.${ext}`);

        await fs.writeFile(tempPath, buffer);

        await sock.sendMessage(

          dest,

          { audio: { url: tempPath }, mimetype: info.mimetype, ptt: Boolean(info.ptt) },

          {}

        );

        await fs.unlink(tempPath).catch(() => {});

      }

    } catch (e) {

      console.log("[vd] error:", e?.message || e);

      return sock.sendMessage(from, { text: `❌ vd error: ${e?.message || e}` }, { quoted: m });

    }

  },

};