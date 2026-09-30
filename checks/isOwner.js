// checks/isOwner.js (ESM)
// ✅ JID-only owner check (NO LID)
// ✅ Strips device suffix (":xx") if present
// ✅ Works in groups, DMs, and other private chats

import { normalizeJid, numberToUserJid, getSenderJidFromMessage } from "../utils/jid.js";

function parseOwnerJidsFromEnv() {
  // Primary: OWNER_NUMBER (recommended)
  const one = normalizeJid(numberToUserJid(process.env.OWNER_NUMBER || ""));

  // Optional: BOT_OWNER / BOT_OWNERS / OWNERS (numbers or JIDs)
  const raw = String(
    process.env.BOT_OWNERS ||
    process.env.OWNERS ||
    process.env.BOT_OWNER ||
    ""
  ).trim();

  const many = raw
    ? raw.split(/[,|\n\s]+/g).map((x) => normalizeJid(x)).filter(Boolean)
    : [];

  const out = [one, ...many].filter(Boolean);
  return [...new Set(out)];
}

export function isOwnerByJid(jid, ctrl = null) {
  const me = normalizeJid(jid);
  if (!me) return false;

  const owners =
    (ctrl && Array.isArray(ctrl.owners) ? ctrl.owners.map(normalizeJid).filter(Boolean) : null) ||
    parseOwnerJidsFromEnv();

  return owners.includes(me);
}

/**
 * Convenience:
 * - If passed an object: { senderJid }
 * - Else, pass (m, sock, ctrl)
 */
export function isOwner(a, b = null, c = null) {
  // isOwner({senderJid}, ctrl?)
  if (a && typeof a === "object" && !a.key && ("senderJid" in a || "jid" in a)) {
    const senderJid = a.senderJid || a.jid || "";
    const ctrl = b;
    return isOwnerByJid(senderJid, ctrl);
  }

  // isOwner(m, sock, ctrl)
  const m = a;
  const sock = b;
  const ctrl = c;
  const senderJid = getSenderJidFromMessage(m, sock);
  return isOwnerByJid(senderJid, ctrl);
}

export { getSenderJidFromMessage, normalizeJid };

export default { isOwnerByJid, isOwner, getSenderJidFromMessage, normalizeJid };
