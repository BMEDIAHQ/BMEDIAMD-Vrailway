// commands/status.js (ESM)

// System status info (owner only).

// Usage: <prefix>status

import os from "os";

import fs from "fs";

import { execSync } from "child_process";

import { isOwner } from "../checks/isOwner.js";

function fmtBytes(bytes) {

  const n = Number(bytes || 0);

  if (!Number.isFinite(n) || n < 0) return "Unknown";

  const units = ["B", "KB", "MB", "GB", "TB"];

  let i = 0;

  let v = n;

  while (v >= 1024 && i < units.length - 1) {

    v /= 1024;

    i++;

  }

  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;

}

function fmtUptime(sec) {

  sec = Math.max(0, Number(sec || 0));

  const d = Math.floor(sec / 86400);

  sec %= 86400;

  const h = Math.floor(sec / 3600);

  sec %= 3600;

  const m = Math.floor(sec / 60);

  const s = Math.floor(sec % 60);

  const parts = [];

  if (d) parts.push(`${d}d`);

  if (h) parts.push(`${h}h`);

  if (m) parts.push(`${m}m`);

  parts.push(`${s}s`);

  return parts.join(" ");

}

function detectHosting() {

  // Heuristics only

  const env = process.env || {};

  if (env.TERMUX_VERSION || env.PREFIX?.includes("com.termux")) return "Termux 📱";

  if (fs.existsSync("/data/data/com.termux")) return "Termux 📱";

  if (env.PTERODACTYL || env.PANEL || env.SERVER_UUID || env.DOCKER_ENV) return "Panel/Docker 🐳";

  if (fs.existsSync("/.dockerenv")) return "Docker/VPS 🐳";

  if (os.platform() === "linux") return "VPS/Linux 🖥️";

  return "Unknown ❓";

}

function getDiskInfo() {

  // Best effort: Linux/macOS via `df -k /`

  try {

    const out = execSync("df -k /", { stdio: ["ignore", "pipe", "ignore"] }).toString();

    const lines = out.trim().split("\n");

    if (lines.length < 2) return null;

    const cols = lines[1].split(/\s+/);

    // Filesystem 1K-blocks Used Available Use% Mounted

    const total = Number(cols[1]) * 1024;

    const used = Number(cols[2]) * 1024;

    const avail = Number(cols[3]) * 1024;

    const usep = cols[4] || "";

    return { total, used, avail, usep };

  } catch {

    return null;

  }

}

export default {

  name: "system",

  aliases: ["sys", "sysinfo"],

  category: "TOOLS",

  description: "Show system status (RAM, disk, latency, uptime). Owner only.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    // ✅ Owner only (your working check)

    if (!isOwner(m, sock)) {

      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    }

    const t0 = Date.now();

    // send a tiny ping to measure latency (message round-trip-ish)

    await sock.sendMessage(from, { text: "⚡ Checking system..." }, { quoted: m });

    const latency = Date.now() - t0;

    const totalMem = os.totalmem();

    const freeMem = os.freemem();

    const usedMem = totalMem - freeMem;

    const rss = process.memoryUsage().rss; // process RAM usage

    const load = os.platform() === "linux" ? os.loadavg() : null;

    const disk = getDiskInfo();

    const hosting = detectHosting();

    const uptime = fmtUptime(process.uptime());

    const text =

      `🧾 *BMEDIA-MD System Status*\n\n` +

      `🖥️ *Hosting:* ${hosting}\n` +

      `⏱️ *Uptime:* ${uptime}\n` +

      `⚡ *Latency:* ${latency} ms\n\n` +

      `🧠 *RAM (Host):* ${fmtBytes(usedMem)} / ${fmtBytes(totalMem)}\n` +

      `🧩 *RAM (Process):* ${fmtBytes(rss)}\n` +

      (load

        ? `📈 *Load Avg:* ${load.map((x) => x.toFixed(2)).join(" / ")}\n`

        : "") +

      `🧬 *Node:* ${process.version}\n` +

      `🧱 *Platform:* ${os.platform()} (${os.arch()})\n\n` +

      (disk

        ? `💾 *Disk (/):* ${fmtBytes(disk.used)} used / ${fmtBytes(disk.total)} total\n` +

          `🗄️ *Free:* ${fmtBytes(disk.avail)} (${disk.usep} used)\n`

        : `💾 *Disk:* Unknown (df not available)\n`);

    return sock.sendMessage(from, { text }, { quoted: m });

  },

};