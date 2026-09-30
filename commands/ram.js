// commands/ram.js (ESM)

// Owner-only RAM usage (no mentions)

// Shows process + system memory.

//

// Usage: <prefix>ram

import os from "os";

import { isOwner } from "../checks/isOwner.js";

function fmtBytes(bytes) {

  const b = Number(bytes) || 0;

  const units = ["B", "KB", "MB", "GB", "TB"];

  let i = 0;

  let n = b;

  while (n >= 1024 && i < units.length - 1) {

    n /= 1024;

    i++;

  }

  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;

}

export default {

  name: "ram",

  aliases: ["memory", "mem"],

  category: "OWNER",

  description: "Show RAM usage (Owner only).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    // ✅ Owner check (same as AntiLink command)

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const mu = process.memoryUsage();

    const total = os.totalmem();

    const free = os.freemem();

    const used = total - free;

    const text =

      `🧠 RAM Usage\n\n` +

      `📌 Process:\n` +

      `• RSS: ${fmtBytes(mu.rss)}\n` +

      `• Heap Total: ${fmtBytes(mu.heapTotal)}\n` +

      `• Heap Used: ${fmtBytes(mu.heapUsed)}\n` +

      `• External: ${fmtBytes(mu.external)}\n\n` +

      `🖥️ System:\n` +

      `• Total: ${fmtBytes(total)}\n` +

      `• Used: ${fmtBytes(used)}\n` +

      `• Free: ${fmtBytes(free)}\n` +

      `• Load Avg (1m): ${os.loadavg?.()?.[0]?.toFixed(2) ?? "N/A"}`;

    return sock.sendMessage(from, { text }, { quoted: m });

  },

};