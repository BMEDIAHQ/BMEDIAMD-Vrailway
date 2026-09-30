// commands/linux.js (ESM)
import fs from "fs/promises";
import path from "path";
import { isOwner } from "../checks/isOwner.js";

// Define paths locally to avoid handler dependency
const CONTROL_DIR = path.join(process.cwd(), "control");
const STATE_PATH = path.join(CONTROL_DIR, "linux.json");

/**
 * Helper to write state directly to JSON
 */
async function saveState(enabled) {
  await fs.mkdir(CONTROL_DIR, { recursive: true });
  const data = { enabled: Boolean(enabled) };
  await fs.writeFile(STATE_PATH, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Helper to read state directly from JSON
 */
async function getState() {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { enabled: false };
  }
}

export default {
  name: "linux",
  aliases: ["term", "terminal", "shell"],
  category: "OWNER",
  description: "Toggle full Linux terminal access.",
  usage: "linux on | off | status",

  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    if (!isOwner(m, sock)) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    }

    const sub = String(args[0] || "").toLowerCase().trim();
    const state = await getState();

    if (!sub) {
      return sock.sendMessage(from, {
        text: "💻 *Terminal Mode*\n\n• linux on\n• linux off\n• linux status\n\nPrefix: `>`"
      }, { quoted: m });
    }

    if (sub === "on") {
      await saveState(true);
      return sock.sendMessage(from, { text: "🚀 *Terminal ENABLED*" }, { quoted: m });
    }

    if (sub === "off") {
      await saveState(false);
      return sock.sendMessage(from, { text: "🛑 *Terminal DISABLED*" }, { quoted: m });
    }

    if (sub === "status") {
      const currentState = await getState();
      return sock.sendMessage(from, { 
        text: `💻 Terminal: *${currentState.enabled ? "ON" : "OFF"}*` 
      }, { quoted: m });
    }

    return sock.sendMessage(from, { text: "❌ Use: linux on/off/status" }, { quoted: m });
  },
};