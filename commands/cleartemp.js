// commands/cleartemp.js
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { isOwner } from "../checks/isOwner.js";
import { isSudoByJid } from "../checks/isSudo.js";

const TEMP_DIR = path.join(process.cwd(), "temp");

function isPrivileged(m, sock, senderJid) {
  try {
    if (isOwner(m, sock)) return true;
  } catch {}

  try {
    if (isSudoByJid(senderJid)) return true;
  } catch {}

  return false;
}

async function ensureTempDir() {
  try {
    await fsp.mkdir(TEMP_DIR, { recursive: true });
  } catch {}
}

async function countTempEntries(dir) {
  let count = 0;

  async function walk(current) {
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      count += 1;

      if (entry.isDirectory()) {
        await walk(full);
      }
    }
  }

  await walk(dir);
  return count;
}

async function clearTempFolder() {
  await ensureTempDir();
  const total = await countTempEntries(TEMP_DIR);

  let entries = [];
  try {
    entries = await fsp.readdir(TEMP_DIR);
  } catch {
    entries = [];
  }

  for (const name of entries) {
    const full = path.join(TEMP_DIR, name);
    try {
      await fsp.rm(full, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    } catch {}
  }

  return total;
}

function triggerGarbageCollection() {
  // RAM does not store "files" like disk; this is a best-effort cleanup.
  try {
    if (typeof global.gc === "function") {
      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;
      return {
        triggered: true,
        freedBytes: Math.max(0, before - after),
      };
    }
  } catch {}

  return {
    triggered: false,
    freedBytes: 0,
  };
}

function formatMB(bytes) {
  return `${(Number(bytes || 0) / 1024 / 1024).toFixed(2)} MB`;
}

export default {
  name: "cleartemp",
  aliases: ["tempclear", "clearram"],
  category: "OWNER",
  description: "Clear everything in the temp folder and trigger garbage collection.",
  usage: "cleartemp",

  async execute(ctx) {
    const { sock, m, from, senderJid } = ctx;

    if (!isPrivileged(m, sock, senderJid)) {
      return sock.sendMessage(
        from,
        { text: "❌ Owner/Sudo only." },
        { quoted: m }
      );
    }

    try {
      const tempCount = await clearTempFolder();
      const gc = triggerGarbageCollection();

      const ramCount = 0; // RAM doesn't store files; GC is triggered instead.

      const text =
        `🧹 *Temp Cleanup Complete*\n\n\n` +
        `⚠️ *CLEARED:*\n` +
        `*${ramCount}* Files from RAM${gc.triggered ? ` (GC triggered • Freed *${formatMB(gc.freedBytes)}*` : " *(GC unavailable)*"}\n\n` +
        `*${tempCount}* Files from temp folder\n\n` +
        `✅ *Done successfully!* \n\n` +
    `> Run this command at least once in a day for uptimal performance`;

      return sock.sendMessage(
        from,
        { text },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: `❌ Failed to clear temp folder.\n\n${e?.message || e}` },
        { quoted: m }
      );
    }
  },
};
