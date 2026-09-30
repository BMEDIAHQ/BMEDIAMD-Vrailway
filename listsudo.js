// listsudo.js (ESM) — Owner-only
// Reads ./control/sudo.json (array of user JIDs like "2376...@s.whatsapp.net")

import fs from "fs";
import path from "path";
import { isOwner } from "../checks/isOwner.js";
import { normalizeJid } from "../utils/jid.js";

const CONTROL_DIR = path.join(process.cwd(), "control");
const SUDO_FILE = path.join(CONTROL_DIR, "sudo.json");

function readSudoList() {
  try {
    if (!fs.existsSync(SUDO_FILE)) return [];
    const raw = fs.readFileSync(SUDO_FILE, "utf-8");
    const data = JSON.parse(raw || "[]");
    if (!Array.isArray(data)) return [];
    return [...new Set(data.map((x) => normalizeJid(x)).filter(Boolean))];
  } catch {
    return [];
  }
}

export default {
  name: "listsudo",
  aliases: ["sudo", "sudolist"],
  description: "List sudo users (owner only).",
  async execute(ctx) {
    const { sock, m, from } = ctx;

    const ok = await isOwner(m, sock);
    if (!ok) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    }

    const sudo = readSudoList();
    if (sudo.length === 0) {
      return sock.sendMessage(from, { text: "ℹ️ No sudo users found." }, { quoted: m });
    }

    const text = "👑 *SUDO USERS*\n\n" + sudo.map((jid, i) => `${i + 1}. ${jid}`).join("\n");
    return sock.sendMessage(from, { text }, { quoted: m });
  },
};
