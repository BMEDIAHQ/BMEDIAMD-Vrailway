// commands/rgcstatus.js
// BMEDIA-MD — Remote Group Chat Status for @whiskeysockets/baileys 7.0.0-rc14
//
// SELF-CONTAINED:
// - no node_modules patch
// - no postinstall script
// - no extra npm dependency
//
// Usage from any chat:
//   .rgcstatus 120363xxxxxxxxxx@g.us Hello world
//   Reply to text/image/video/audio/music -> .rgcstatus 120363xxxxxxxxxx@g.us
//   Reply to image/video -> .rgcstatus 120363xxxxxxxxxx@g.us optional new caption
//
// This deliberately uses the SAME rc14 relay compatibility logic as the
// working gcstatus command. Only the destination is changed to the supplied GID.

import {
  generateWAMessageContent,
  downloadContentFromMessage,
} from "@whiskeysockets/baileys";

import { isOwner } from "../checks/isOwner.js";
import { isSudo } from "../checks/isSudo.js";

const FOOTER = "> POWERED BY BMEDIA";

function box(title, lines = []) {
  const clean = lines.filter((x) => x !== undefined && x !== null && String(x).length);
  return [
    `╭─〔 *${title}* 〕`,
    ...clean.map((line, i) => `${i === clean.length - 1 ? "╰" : "├"}◦ ${line}`),
    "",
    FOOTER,
  ].join("\n");
}

function unwrapMessage(message) {
  let msg = message || null;

  for (let i = 0; i < 8 && msg; i++) {
    if (msg.ephemeralMessage?.message) {
      msg = msg.ephemeralMessage.message;
      continue;
    }
    if (msg.viewOnceMessage?.message) {
      msg = msg.viewOnceMessage.message;
      continue;
    }
    if (msg.viewOnceMessageV2?.message) {
      msg = msg.viewOnceMessageV2.message;
      continue;
    }
    if (msg.viewOnceMessageV2Extension?.message) {
      msg = msg.viewOnceMessageV2Extension.message;
      continue;
    }
    if (msg.documentWithCaptionMessage?.message) {
      msg = msg.documentWithCaptionMessage.message;
      continue;
    }
    if (msg.editedMessage?.message) {
      msg = msg.editedMessage.message;
      continue;
    }
    break;
  }

  return msg;
}

function getContextInfo(message) {
  const root = unwrapMessage(message);
  if (!root) return null;

  return (
    root.extendedTextMessage?.contextInfo ||
    root.imageMessage?.contextInfo ||
    root.videoMessage?.contextInfo ||
    root.audioMessage?.contextInfo ||
    root.documentMessage?.contextInfo ||
    Object.values(root).find((value) => value?.contextInfo)?.contextInfo ||
    null
  );
}

function getQuotedMessage(m) {
  const contextInfo = getContextInfo(m?.message);
  return unwrapMessage(contextInfo?.quotedMessage || null);
}

function getQuotedText(quoted) {
  const q = unwrapMessage(quoted);
  if (!q) return "";

  if (typeof q.conversation === "string") return q.conversation.trim();
  if (typeof q.extendedTextMessage?.text === "string") {
    return q.extendedTextMessage.text.trim();
  }

  return "";
}

function detectQuotedMedia(quoted) {
  const q = unwrapMessage(quoted);
  if (!q) return null;

  if (q.imageMessage) {
    return {
      kind: "image",
      message: q.imageMessage,
      downloadType: "image",
      mimetype: q.imageMessage.mimetype || "image/jpeg",
      caption: q.imageMessage.caption || "",
    };
  }

  if (q.videoMessage) {
    return {
      kind: "video",
      message: q.videoMessage,
      downloadType: "video",
      mimetype: q.videoMessage.mimetype || "video/mp4",
      caption: q.videoMessage.caption || "",
      gifPlayback: !!q.videoMessage.gifPlayback,
    };
  }

  if (q.audioMessage) {
    return {
      kind: "audio",
      message: q.audioMessage,
      downloadType: "audio",
      mimetype: q.audioMessage.mimetype || "audio/mpeg",
      ptt: !!q.audioMessage.ptt,
    };
  }

  return null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function downloadQuotedMedia(media) {
  const stream = await downloadContentFromMessage(media.message, media.downloadType);
  const buffer = await streamToBuffer(stream);

  if (!buffer.length) {
    throw new Error(`Downloaded ${media.kind} is empty.`);
  }

  return buffer;
}

function senderJidFrom(ctx) {
  return (
    ctx?.senderJid ||
    ctx?.sender ||
    ctx?.participant ||
    ctx?.m?.key?.participant ||
    ""
  );
}

async function privileged(ctx) {
  try {
    if (await isOwner(ctx.m, ctx.sock)) return true;
  } catch {}

  const jid = senderJidFrom(ctx);

  try {
    if (jid && isOwner({ senderJid: jid })) return true;
  } catch {}

  try {
    if (jid && isSudo(jid)) return true;
  } catch {}

  return false;
}

function normalizeGroupJid(value = "") {
  let gid = String(value || "")
    .trim()
    .replace(/^['"`]+|['"`,]+$/g, "");

  // Also accept the bare numeric group id if desired.
  if (/^\d{10,30}$/.test(gid)) gid += "@g.us";

  return gid.toLowerCase();
}

// SAME rc14 compatibility shim used by the working gcstatus command.
// It lets rc14 relayMessage detect the media nested inside groupStatusMessageV2
// without modifying node_modules and without encoding a duplicate top-level media.
function makeRc14RelayPayload(inner, kind) {
  const payload = {
    groupStatusMessageV2: {
      message: inner,
    },
  };

  const field =
    kind === "image"
      ? "imageMessage"
      : kind === "video"
        ? "videoMessage"
        : kind === "audio"
          ? "audioMessage"
          : null;

  if (!field || !inner?.[field]) return payload;

  // image: rc14 reads it once.
  // video/audio: rc14 reads once in the condition and once for gifPlayback/ptt.
  let readsLeft = kind === "image" ? 1 : 2;

  Object.defineProperty(payload, field, {
    configurable: true,
    enumerable: false,
    get() {
      if (readsLeft > 0) {
        readsLeft -= 1;
        return inner[field];
      }
      return undefined;
    },
  });

  return payload;
}

async function buildInnerContent(sock, media, buffer, caption) {
  if (media.kind === "image") {
    return generateWAMessageContent(
      {
        image: buffer,
        mimetype: media.mimetype,
        caption: caption || media.caption || "",
      },
      { upload: sock.waUploadToServer }
    );
  }

  if (media.kind === "video") {
    return generateWAMessageContent(
      {
        video: buffer,
        mimetype: media.mimetype,
        caption: caption || media.caption || "",
        gifPlayback: media.gifPlayback,
      },
      { upload: sock.waUploadToServer }
    );
  }

  return generateWAMessageContent(
    {
      audio: buffer,
      mimetype: media.mimetype,
      ptt: media.ptt,
    },
    { upload: sock.waUploadToServer }
  );
}

export default {
  name: "rgcstatus",
  aliases: ["remotegcstatus", "rgstatus"],
  category: "OWNER",
  description: "Post text/image/video/audio remotely to a target WhatsApp Group Status using its GID.",
  usage: "rgcstatus <group-gid> <text> OR reply to text/image/video/audio with rgcstatus <group-gid>",

  async execute(ctx) {
    const { sock, m, from } = ctx;
    const args = Array.isArray(ctx?.args) ? ctx.args : [];

    if (!(await privileged(ctx))) {
      return sock.sendMessage(
        from,
        { text: box("RGCSTATUS", ["Owner/Sudo only."]) },
        { quoted: m }
      );
    }

    const targetGid = normalizeGroupJid(args[0] || "");

    if (!targetGid || !targetGid.endsWith("@g.us")) {
      return sock.sendMessage(
        from,
        {
          text: box("RGCSTATUS", [
            "Invalid or missing group GID.",
            "Usage: rgcstatus 120363xxxxxxxxxx@g.us <text>",
            "Or reply to media/text: rgcstatus 120363xxxxxxxxxx@g.us",
          ]),
        },
        { quoted: m }
      );
    }

    const typedText = args.slice(1).join(" ").trim();
    const quoted = getQuotedMessage(m);
    const media = detectQuotedMedia(quoted);
    const quotedText = getQuotedText(quoted);

    if (!media && !typedText && !quotedText) {
      return sock.sendMessage(
        from,
        {
          text: box("RGCSTATUS", [
            "Reply to text/image/video/audio/music and provide the target GID.",
            "Example: rgcstatus 120363xxxxxxxxxx@g.us",
            "Or: rgcstatus 120363xxxxxxxxxx@g.us <text>",
          ]),
        },
        { quoted: m }
      );
    }

    try {
      // Confirm the linked account can actually see the destination group.
      // This prevents reporting success for a typo/non-member GID.
      let groupName = targetGid;
      try {
        const meta = await sock.groupMetadata(targetGid);
        if (meta?.subject) groupName = meta.subject;
      } catch (error) {
        throw new Error(
          `Cannot access target group. Check the GID and make sure the bot account is a member. ${error?.message || ""}`.trim()
        );
      }

      let inner;
      let kind = "text";

      if (media) {
        const buffer = await downloadQuotedMedia(media);
        inner = await buildInnerContent(sock, media, buffer, typedText);
        kind = media.kind;
      } else {
        const text = typedText || quotedText;
        inner = {
          extendedTextMessage: {
            text,
          },
        };
      }

      const relayPayload = makeRc14RelayPayload(inner, kind);
      const messageId = await sock.relayMessage(targetGid, relayPayload, {});

      return sock.sendMessage(
        from,
        {
          text: box("RGCSTATUS", [
            `Remote group status sent (${kind}).`,
            `Group: ${groupName}`,
            `GID: ${targetGid}`,
            messageId ? `ID: ${messageId}` : null,
          ]),
        },
        { quoted: m }
      );
    } catch (error) {
      console.error("[rgcstatus]", error);

      return sock.sendMessage(
        from,
        {
          text: box("RGCSTATUS ERROR", [
            error?.message || String(error),
          ]),
        },
        { quoted: m }
      );
    }
  },
};
