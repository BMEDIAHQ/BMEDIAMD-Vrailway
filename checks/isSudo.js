// checks/isSudo.js (ESM)
// ✅ JID-only sudo check (NO LID)
// ✅ Reads ./control/sudo.json
// ✅ Accepts legacy LIDs inside sudo.json and auto-migrates to JIDs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeJid, numberToUserJid, lidToUserJid, parseIdList } from "../utils/jid.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTROL_DIR = path.join(__dirname, "..", "control");
const SUDO_FILE = path.join(CONTROL_DIR, "sudo.json");

function ensureSudoFile() {
  try {
    if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });
    if (!fs.existsSync(SUDO_FILE)) fs.writeFileSync(SUDO_FILE, "[]");
  } catch {}
}

function normalizeAnyToUserJid(v) {
  const s = String(v || "").trim();
  if (!s) return "";

  // legacy lid
  if (/@lid$/i.test(s)) return normalizeJid(lidToUserJid(s));

  // user jid or group jid
  if (s.includes("@")) return normalizeJid(s);

  // digits/phone
  return normalizeJid(numberToUserJid(s));
}

function loadSudoList() {
  ensureSudoFile();

  let data;
  try {
    data = JSON.parse(fs.readFileSync(SUDO_FILE, "utf8"));
  } catch {
    return [];
  }

  const pick = (x) =>
    typeof x === "string" ? x : x?.jid || x?.id || x?.JID || x?.number || x?.phone || x?.lid || x?.LID;

  let list = [];

  if (Array.isArray(data)) {
    list = data.map(pick);
  } else {
    const possibleArrays = [data?.sudos, data?.sudo, data?.list, data?.users];
    for (const arr of possibleArrays) {
      if (Array.isArray(arr)) {
        list = arr.map(pick);
        break;
      }
    }

    if (!list.length && data && typeof data === "object") {
      list = Object.keys(data);
    }
  }

  // Normalize + dedupe
  const normalized = [...new Set(list.map(normalizeAnyToUserJid).filter(Boolean))];

  // Auto-migrate legacy formats to pure JID array
  try {
    const rawText = fs.readFileSync(SUDO_FILE, "utf8");
    const alreadySimpleArray = (() => {
      try {
        const j = JSON.parse(rawText);
        return Array.isArray(j) && j.every((x) => typeof x === "string");
      } catch {
        return false;
      }
    })();

    if (!alreadySimpleArray) {
      fs.writeFileSync(SUDO_FILE, JSON.stringify(normalized, null, 2));
    } else {
      // If it is an array but contains lids/device, still normalize & overwrite if changed
      const arr = JSON.parse(rawText);
      const norm2 = [...new Set(arr.map(normalizeAnyToUserJid).filter(Boolean))];
      if (JSON.stringify(norm2) !== JSON.stringify(arr)) {
        fs.writeFileSync(SUDO_FILE, JSON.stringify(norm2, null, 2));
      }
    }
  } catch {}

  return normalized;
}

export function isSudoByJid(anyId) {
  const me = normalizeAnyToUserJid(anyId);
  if (!me) return false;
  const sudo = loadSudoList();
  return sudo.includes(me);
}

export function isSudo(senderAnyId) {
  return isSudoByJid(senderAnyId);
}

export function normalizeUserJid(anyId) {
  return normalizeAnyToUserJid(anyId);
}

export default { isSudoByJid, isSudo, normalizeUserJid };
