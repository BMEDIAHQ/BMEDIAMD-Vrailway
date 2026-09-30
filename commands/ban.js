// commands/ban.js (ESM)
// ✅ Owner-only ban
// ✅ JID-only (no LID)
// ✅ Persists to ./control/banned.json as: { banned: [jid...], updatedAt }
//
// Usage:
//   !ban @user
//   !ban (reply to a user)
//   !ban 2376xxxxxxx
//   !ban 2376xxxxxxx@s.whatsapp.net

import fs from "fs";
import path from "path";

import { isOwner } from "../checks/isOwner.js";
import { normalizeJid, numberToUserJid, isUserJid } from "../utils/jid.js";

const CONTROL_DIR = path.join(process.cwd(), "control");
const BANNED_FILE = path.join(CONTROL_DIR, "banned.json");

function ensureControlFiles() {
  if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });
  if (!fs.existsSync(BANNED_FILE)) {
    fs.writeFileSync(BANNED_FILE, JSON.stringify({ banned: [], updatedAt: Date.now() }, null, 2));
  }
}

function readJsonSafe(fp, fallback) {
  try {
    if (!fs.existsSync(fp)) return fallback;
    const raw = fs.readFileSync(fp, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeBannedList(list) {
  ensureControlFiles();
  const out = [...new Set((list || []).map((x) => normalizeJid(x)).filter(Boolean))];
  fs.writeFileSync(BANNED_FILE, JSON.stringify({ banned: out, updatedAt: Date.now() }, null, 2));
  return out;
}

function loadBannedList() {
  ensureControlFiles();
  const obj = readJsonSafe(BANNED_FILE, { banned: [] });
  const arr = Array.isArray(obj) ? obj : Array.isArray(obj?.banned) ? obj.banned : [];
  const norm = [...new Set(arr.map((x) => normalizeJid(x)).filter(Boolean))];
  // If file was legacy format, normalize it
  try {
    const current = readJsonSafe(BANNED_FILE, { banned: [] });
    const currentArr = Array.isArray(current) ? current : current?.banned;
    if (JSON.stringify(currentArr) !== JSON.stringify(norm)) writeBannedList(norm);
  } catch {}
  return norm;
}

function normalizeUserTarget(anyId) {
  const s = String(anyId || "").trim();
  if (!s) return "";
  if (s.includes("@")) return normalizeJid(s);
  return normalizeJid(numberToUserJid(s));
}

function pickTargetJid(m, args) {
  // 1) mention
  const mentioned = m?.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (Array.isArray(mentioned) && mentioned[0]) {
    const j = normalizeUserTarget(mentioned[0]);
    if (isUserJid(j)) return j;
  }

  // 2) reply target participant
  const replied =
    m?.message?.extendedTextMessage?.contextInfo?.participant ||
    m?.message?.imageMessage?.contextInfo?.participant ||
    m?.message?.videoMessage?.contextInfo?.participant ||
    m?.message?.documentMessage?.contextInfo?.participant ||
    "";
  const r = normalizeUserTarget(replied);
  if (isUserJid(r)) return r;

  // 3) typed
  const typed = normalizeUserTarget((args || []).join(" ").trim());
  if (isUserJid(typed)) return typed;

  return "";
}

export default {
  name: "ban",
  aliases: ["banuser"],
  category: "OWNER",
  description: "Ban a user from using the bot (Owner only).",

  async execute(ctx) {
    const { sock, m, from, args, prefix } = ctx;

    const ok = await isOwner(m, sock);
    if (!ok) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    }

    const targetJid = pickTargetJid(m, args);
    if (!targetJid) {
      return sock.sendMessage(
        from,
        { text: `Mention/reply a user or type a number/JID.\n\nExample:\n${prefix}ban 237689660487` },
        { quoted: m }
      );
    }

    // Don't allow banning owner(s)
    // (isOwner accepts {senderJid} form too)
    if (isOwner({ senderJid: targetJid })) {
      return sock.sendMessage(from, { text: "⚠️ You can't ban the owner." }, { quoted: m });
    }

    const list = loadBannedList();
    if (list.includes(targetJid)) {
      return sock.sendMessage(from, { text: "⚠️ User is already banned." }, { quoted: m });
    }

    const updated = writeBannedList([...list, targetJid]);
    return sock.sendMessage(
      from,
      { text: `✅ Banned:\n${targetJid}\n\nTotal banned: ${updated.length}` },
      { quoted: m }
    );
  },
};
