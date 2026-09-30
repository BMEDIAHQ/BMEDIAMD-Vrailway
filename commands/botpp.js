// commands/botpp.js (ESM)
// Owner-only:
// - user must reply to an image
// - deletes assets/logo.png
// - replaces it with the replied image
// - converts non-png images to png
// - sends the new menu image with confirmation caption

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { isOwner } from "../checks/isOwner.js";

const ASSETS_DIR = path.join(process.cwd(), "assets");
const LOGO_PATH = path.join(ASSETS_DIR, "logo.png");

function getContextInfo(m) {
  const msg = m?.message || {};
  return (
    msg.extendedTextMessage?.contextInfo ||
    msg.imageMessage?.contextInfo ||
    msg.videoMessage?.contextInfo ||
    msg.documentMessage?.contextInfo ||
    msg.buttonsResponseMessage?.contextInfo ||
    msg.listResponseMessage?.contextInfo ||
    msg.templateButtonReplyMessage?.contextInfo ||
    null
  );
}

function getQuotedImageMessage(m) {
  const ctx = getContextInfo(m);
  const quoted = ctx?.quotedMessage || null;
  if (!quoted) return null;

  if (quoted.imageMessage) return quoted.imageMessage;

  if (quoted.viewOnceMessage?.message?.imageMessage) {
    return quoted.viewOnceMessage.message.imageMessage;
  }

  if (quoted.viewOnceMessageV2?.message?.imageMessage) {
    return quoted.viewOnceMessageV2.message.imageMessage;
  }

  if (quoted.viewOnceMessageV2Extension?.message?.imageMessage) {
    return quoted.viewOnceMessageV2Extension.message.imageMessage;
  }

  return null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function downloadQuotedImageBuffer(imageMsg) {
  const stream = await downloadContentFromMessage(imageMsg, "image");
  return streamToBuffer(stream);
}

function mimeToExt(mime = "") {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("webp")) return ".webp";
  return ".img";
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";

    p.stderr.on("data", (d) => {
      err += d?.toString?.() ?? String(d ?? "");
    });

    p.on("close", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`ffmpeg failed (${code}): ${err.slice(-700)}`));
    });
  });
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function rmSafe(filePath) {
  try {
    await fs.promises.rm(filePath, { force: true, recursive: true });
  } catch {}
}

export default {
  name: "botpp",
  aliases: ["setbotpp", "botlogo", "setlogo"],
  category: "OWNER",
  description: "Replace assets/logo.png with a replied image.",
  usage: "botpp (reply to an image)",

  async execute(ctx) {
    const { sock, m, from, senderJid, sender } = ctx;

    if (!isOwner({ senderJid: senderJid || sender })) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    }

    const quotedImage = getQuotedImageMessage(m);
    if (!quotedImage) {
      return sock.sendMessage(
        from,
        { text: "❌ Reply to an image to set it as the bot picture." },
        { quoted: m }
      );
    }

    const tempDir = path.join(process.cwd(), "temp");
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const inputExt = mimeToExt(quotedImage.mimetype || "");
    const inputPath = path.join(tempDir, `${id}${inputExt}`);
    const outputPath = LOGO_PATH;

    try {
      await ensureDir(tempDir);
      await ensureDir(ASSETS_DIR);

      const imageBuffer = await downloadQuotedImageBuffer(quotedImage);
      if (!imageBuffer || imageBuffer.length < 100) {
        throw new Error("Invalid image data.");
      }

      await fs.promises.writeFile(inputPath, imageBuffer);

      await rmSafe(outputPath);

      if (inputExt === ".png") {
        await fs.promises.copyFile(inputPath, outputPath);
      } else {
        await runFfmpeg([
          "-y",
          "-i", inputPath,
          "-frames:v", "1",
          outputPath,
        ]);
      }

      return sock.sendMessage(
        from,
        {
          image: { url: outputPath },
          caption: `✅ Bot menu image updated\n\n> POWERED BY BMEDIA`,
        },
        { quoted: m }
      );
    } catch (error) {
      return sock.sendMessage(
        from,
        { text: `❌ Failed to update bot image\nReason: ${error?.message || error}` },
        { quoted: m }
      );
    } finally {
      await rmSafe(inputPath);
    }
  },
};
