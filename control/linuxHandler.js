// handlers/linuxHandler.js (ESM)
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process"; // Changed to exec for arbitrary strings
import { promisify } from "util";
import { isOwner } from "../checks/isOwner.js";

const execAsync = promisify(exec);

const CONTROL_DIR = path.join(process.cwd(), "control");
const STATE_PATH = path.join(CONTROL_DIR, "linux.json");

export async function readLinuxState() {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const j = JSON.parse(raw);
    return { enabled: Boolean(j.enabled) };
  } catch {
    return { enabled: false };
  }
}

function extractText(m) {
  return (
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    m?.message?.imageMessage?.caption ||
    m?.message?.videoMessage?.caption ||
    ""
  );
}

function cleanOutput(s, max = 3500) {
  const t = String(s || "").replace(/\u0000/g, "");
  if (t.length <= max) return t;
  return t.slice(0, max) + "\n…(truncated)";
}

export async function handleLinuxShell(sock, m) {
  try {
    if (!m?.key?.remoteJid) return false;

    const from = m.key.remoteJid;
    const text = String(extractText(m) || "").trim();

    // Trigger on ">" prefix
    if (!text.startsWith(">")) return false;

    const state = await readLinuxState();
    if (!state.enabled) return false;

    // Owner-only check
    if (!isOwner(m, sock)) return false;

    // Extract the full command after the ">"
    const fullCommand = text.slice(1).trim();

    if (!fullCommand) {
      await sock.sendMessage(from, { text: "❌ Please provide a command.\nExample: > ls -la" }, { quoted: m });
      return true;
    }

    // Execute the command directly
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 15000, // Increased timeout for heavier tasks
      maxBuffer: 1024 * 1024 * 2, // 2MB buffer
    });

    const out = cleanOutput((stdout || "") + (stderr ? "\n" + stderr : ""));
    const msg = "```" + (out.trim() || "(Done - no output)") + "```";

    await sock.sendMessage(from, { text: msg }, { quoted: m });
    return true;
  } catch (e) {
    try {
      const from = m?.key?.remoteJid;
      // In exec, errors often contain the stderr of the failed command
      const errorMsg = e.stderr || e.stdout || e.message || e;
      if (from) await sock.sendMessage(from, { text: "```" + cleanOutput(errorMsg) + "```" }, { quoted: m });
    } catch {}
    return true;
  }
}
