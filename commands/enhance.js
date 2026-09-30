// commands/enhance.js
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { once } from "events";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_ROOT = path.join(process.cwd(), "temp");
const WORKER_PATH = path.join(__dirname, "enhance.mjs");
const TEMP_PREFIX = "enhance-";
const STALE_MS = 10 * 60 * 1000; // 10 minutes

function unwrapMessage(msg) {
  let m = msg || {};
  for (let i = 0; i < 5; i++) {
    if (m?.ephemeralMessage?.message) {
      m = m.ephemeralMessage.message;
      continue;
    }
    if (m?.viewOnceMessage?.message) {
      m = m.viewOnceMessage.message;
      continue;
    }
    if (m?.viewOnceMessageV2?.message) {
      m = m.viewOnceMessageV2.message;
      continue;
    }
    if (m?.documentWithCaptionMessage?.message) {
      m = m.documentWithCaptionMessage.message;
      continue;
    }
    break;
  }
  return m || {};
}

function getQuotedMessage(m) {
  return (
    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    m?.message?.imageMessage?.contextInfo?.quotedMessage ||
    m?.message?.videoMessage?.contextInfo?.quotedMessage ||
    m?.message?.documentMessage?.contextInfo?.quotedMessage ||
    null
  );
}

function getImageNodeFromMessage(message) {
  const msg = unwrapMessage(message);
  if (msg?.imageMessage) return msg.imageMessage;
  return null;
}

async function ensureTempDir() {
  await fsp.mkdir(TEMP_ROOT, { recursive: true });
}

async function writeAsyncIterableToFile(stream, filePath) {
  const out = fs.createWriteStream(filePath);
  try {
    for await (const chunk of stream) {
      if (!out.write(chunk)) await once(out, "drain");
    }
    await new Promise((resolve, reject) => {
      out.end((err) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    out.destroy();
    throw err;
  }
}

async function downloadQuotedImageToFile(m, filePath) {
  const quoted = getQuotedMessage(m);
  if (!quoted) throw new Error("Reply to an image.");
  const imageNode = getImageNodeFromMessage(quoted);
  if (!imageNode) throw new Error("The replied message is not an image.");

  const stream = await downloadContentFromMessage(imageNode, "image");
  await writeAsyncIterableToFile(stream, filePath);
}

function parseLevel(args) {
  const raw = String(args?.[0] || "").trim().toLowerCase();
  if (["soft", "light", "low"].includes(raw)) return "soft";
  if (["strong", "high", "hd", "max"].includes(raw)) return "strong";
  return "normal";
}

async function runWorker(inputPath, outputPath, level) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--max-old-space-size=128", WORKER_PATH, inputPath, outputPath, level],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      }
    );

    let stderr = "";
    let stdout = "";

    child.stdout.on("data", (d) => {
      stdout += String(d || "");
    });

    child.stderr.on("data", (d) => {
      stderr += String(d || "");
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) return resolve(stdout.trim());
      reject(new Error(stderr.trim() || stdout.trim() || `Enhance worker exited with code ${code}`));
    });
  });
}

async function removePath(p) {
  if (!p) return;
  try {
    await fsp.rm(p, {
      force: true,
      recursive: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch {}
}

async function cleanupEnhanceTempRoot(currentWorkDir = "") {
  try {
    await ensureTempDir();
    const entries = await fsp.readdir(TEMP_ROOT, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith(TEMP_PREFIX)) continue;

      const full = path.join(TEMP_ROOT, entry.name);
      if (currentWorkDir && path.resolve(full) === path.resolve(currentWorkDir)) continue;

      try {
        const st = await fsp.stat(full);
        const age = now - Math.max(Number(st.mtimeMs || 0), Number(st.ctimeMs || 0));
        if (age >= STALE_MS) {
          await removePath(full);
        }
      } catch {
        await removePath(full);
      }
    }
  } catch {}
}

async function safeCleanup(workDir = "", extraPaths = []) {
  for (const p of extraPaths) {
    await removePath(p);
  }

  if (workDir) {
    await removePath(workDir);
  }

  await cleanupEnhanceTempRoot("");

  try {
    if (typeof global.gc === "function") global.gc();
  } catch {}
}

export default {
  name: "enhance",
  aliases: ["hd", "improve", "clarity"],
  category: "MEDIA",
  description: "Enhance a replied image with low RAM usage.",
  usage: "enhance [soft|normal|strong] (reply to an image)",

  async execute(ctx) {
    const { sock, m, from, args } = ctx;
    const level = parseLevel(args);

    const jobId = randomUUID();
    const workDir = path.join(TEMP_ROOT, `${TEMP_PREFIX}${jobId}`);
    const inputPath = path.join(workDir, "input.jpg");
    const outputPath = path.join(workDir, "output.jpg");

    try {
      await ensureTempDir();
      await cleanupEnhanceTempRoot("");
      await fsp.mkdir(workDir, { recursive: true });

      await downloadQuotedImageToFile(m, inputPath);
      await runWorker(inputPath, outputPath, level);

      await sock.sendMessage(
        from,
        {
          image: { url: outputPath },
          caption:
            level === "strong"
              ? "✨ Enhanced image (strong)"
              : level === "soft"
              ? "✨ Enhanced image (soft)"
              : "✨ Enhanced image",
        },
        { quoted: m }
      );
    } catch (e) {
      await sock.sendMessage(
        from,
        {
          text:
            `❌ ${e?.message || "Failed to enhance image."}\n\n` +
            `Usage:\n` +
            `• enhance\n` +
            `• enhance soft\n` +
            `• enhance strong`,
        },
        { quoted: m }
      );
    } finally {
      await safeCleanup(workDir, [inputPath, outputPath]);
    }
  },
};