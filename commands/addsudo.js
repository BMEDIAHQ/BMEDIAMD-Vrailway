// commands/addsudo.js (ESM)

// ✅ Owner-only (same method as delsudo.js)

// ✅ JID-only sudo list

// ✅ Adds a sudo by reply/mention/typed number/JID

//

// Uses same files as delsudo:

// - control/sudo.json

// - control/state.json (updates if arrays exist)

import fs from "fs";

import path from "path";

import { isOwner } from "../checks/isOwner.js";

import { normalizeJid, numberToUserJid } from "../utils/jid.js";

const CONTROL_DIR = path.join(process.cwd(), "control");

const SUDO_FILE = path.join(CONTROL_DIR, "sudo.json");

const STATE_FILE = path.join(CONTROL_DIR, "state.json");

function ensureControlDir() {

  if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });

}

function normalizeUserJid(anyId) {

  const s = String(anyId || "").trim();

  if (!s) return "";

  if (s.includes("@")) return normalizeJid(s);

  return normalizeJid(numberToUserJid(s));

}

function pickTargetJid(m, args) {

  const mentioned = m?.message?.extendedTextMessage?.contextInfo?.mentionedJid;

  if (Array.isArray(mentioned) && mentioned[0]) {

    const j = normalizeUserJid(mentioned[0]);

    if (j) return j;

  }

  const replied =

    m?.message?.extendedTextMessage?.contextInfo?.participant ||

    m?.message?.imageMessage?.contextInfo?.participant ||

    m?.message?.videoMessage?.contextInfo?.participant ||

    m?.message?.documentMessage?.contextInfo?.participant ||

    "";

  const r = normalizeUserJid(replied);

  if (r) return r;

  const typed = normalizeUserJid((args || []).join(" ").trim());

  if (typed) return typed;

  return "";

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

function coerceToJidArray(data) {

  const pick = (x) =>

    typeof x === "string"

      ? x

      : x?.jid || x?.id || x?.JID || x?.number || x?.phone || x?.lid || x?.LID;

  if (Array.isArray(data)) return data.map(pick).map(normalizeUserJid).filter(Boolean);

  if (data && typeof data === "object") {

    for (const k of ["sudos", "sudo", "list", "users", "items"]) {

      if (Array.isArray(data[k])) return data[k].map(pick).map(normalizeUserJid).filter(Boolean);

    }

    const keys = Object.keys(data);

    if (keys.length) return keys.map(normalizeUserJid).filter(Boolean);

  }

  return [];

}

function readSudoList() {

  ensureControlDir();

  const raw = readJsonSafe(SUDO_FILE, []);

  return [...new Set(coerceToJidArray(raw))];

}

function writeSudoList(list) {

  ensureControlDir();

  const out = [...new Set((list || []).map(normalizeUserJid).filter(Boolean))];

  fs.writeFileSync(SUDO_FILE, JSON.stringify(out, null, 2));

  // Keep state.json in sync if it already contains arrays (same as delsudo.js)

  try {

    if (!fs.existsSync(STATE_FILE)) return;

    const state = readJsonSafe(STATE_FILE, {});

    if (state && typeof state === "object") {

      if (Array.isArray(state.sudo)) state.sudo = out;

      if (Array.isArray(state.sudos)) state.sudos = out;

      if (Array.isArray(state.sudoUsers)) state.sudoUsers = out;

      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

    }

  } catch {}

}

export default {

  name: "addsudo",

  aliases: ["sudoadd"],

  category: "OWNER",

  description: "Add sudo (Owner only)",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    // ✅ SAME owner check method as delsudo.js 1

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const targetJid = pickTargetJid(m, args);

    if (!targetJid) {

      return sock.sendMessage(

        from,

        { text: `Reply/mention a user, or type a number/JID.\n\nExample:\n${prefix}addsudo 237689660487` },

        { quoted: m }

      );

    }

    const sudoList = readSudoList();

    if (sudoList.includes(targetJid)) {

      return sock.sendMessage(from, { text: "⚠️ That user is already a sudo." }, { quoted: m });

    }

    const next = [...sudoList, targetJid];

    writeSudoList(next);

    return sock.sendMessage(from, { text: `✅ Added to SUDO:\n${targetJid}` }, { quoted: m });

  },

};