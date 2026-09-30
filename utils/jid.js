// utils/jid.js (ESM)
// Central JID normalization utilities.
// - Always strip Baileys device suffix ":xx".
// - Accepts numbers, JIDs, and legacy LIDs (converts to user JID).

export function digitsOnly(input = "") {
  return String(input || "").replace(/[^0-9]/g, "");
}

export function stripDevice(jid = "") {
  const s = String(jid || "").trim();
  if (!s.includes("@")) return s;
  const at = s.indexOf("@");
  const left = s.slice(0, at);
  const right = s.slice(at + 1);
  const cleanLeft = left.split(":")[0];
  return `${cleanLeft}@${right}`;
}

export function isUserJid(jid = "") {
  return typeof jid === "string" && jid.endsWith("@s.whatsapp.net");
}

export function isGroupJid(jid = "") {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

export function numberToUserJid(numberLike = "") {
  const d = digitsOnly(numberLike);
  return d ? `${d}@s.whatsapp.net` : "";
}

export function lidToUserJid(lid = "") {
  const s = String(lid || "").trim();
  // Accept: 123@lid or 123:99@lid
  const m = s.match(/^(\d+)(?::\d+)?@lid$/i);
  if (m) return `${m[1]}@s.whatsapp.net`;
  // Digits-only lid paste
  const d = digitsOnly(s);
  return d ? `${d}@s.whatsapp.net` : "";
}

export function normalizeJid(any = "") {
  const s0 = String(any || "").trim();
  if (!s0) return "";

  // Legacy lid -> convert
  if (/@lid$/i.test(s0)) return stripDevice(lidToUserJid(s0));

  // Already a JID
  if (s0.includes("@")) return stripDevice(s0);

  // Raw digits -> user jid
  const d = digitsOnly(s0);
  return d ? `${d}@s.whatsapp.net` : "";
}

export function parseIdList(raw = "") {
  return [...new Set(
    String(raw || "")
      .split(/[,|\n\s]+/g)
      .map((x) => normalizeJid(x))
      .filter(Boolean)
  )];
}

export function getSenderJidFromMessage(m, sock = null) {
  // 1) fromMe: use sock.user.id
  if (m?.key?.fromMe) {
    const me = normalizeJid(sock?.user?.id || sock?.user?.jid || "");
    return me;
  }

  // 2) group participant
  const p = normalizeJid(m?.key?.participant || m?.participant || "");
  if (p && isUserJid(p)) return p;

  // 3) contextInfo participant (reply)
  const ci =
    m?.message?.extendedTextMessage?.contextInfo?.participant ||
    m?.message?.imageMessage?.contextInfo?.participant ||
    m?.message?.videoMessage?.contextInfo?.participant ||
    m?.message?.documentMessage?.contextInfo?.participant ||
    "";
  const pc = normalizeJid(ci);
  if (pc && isUserJid(pc)) return pc;

  // 4) fallback: sometimes remoteJid is the sender in DMs
  const r = normalizeJid(m?.key?.remoteJid || "");
  return isUserJid(r) ? r : p || r;
}
