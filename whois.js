// commands/whois.js (ESM)

// Show user info in a group: admin status + presence + join date (if available).

//

// Usage:

//  - <prefix>whois              (shows your info)

//  - reply someone: <prefix>whois

//  - mention someone: <prefix>whois @user

//  - type number: <prefix>whois 237xxxxxxxxx

//

// Changes requested:

// ✅ Remove number line completely

// ✅ If something is unknown, show --/-- (not "Unknown")

function getContextInfo(m) {

  return m?.message?.extendedTextMessage?.contextInfo || null;

}

function getMentionedJids(m) {

  return getContextInfo(m)?.mentionedJid || [];

}

function getQuotedParticipant(m) {

  return getContextInfo(m)?.participant || null;

}

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

const bare = (id) => String(id || "").split("@")[0].split(":")[0];

const toUserJid = (x) => {

  const n = String(x || "").trim().replace(/[^\d]/g, "");

  if (!n) return null;

  return `${n}@s.whatsapp.net`;

};

const tagOf = (jid) => `@${bare(jid)}`;

function getArgNumber(args = []) {

  const first = String(args[0] || "").trim();

  if (!first) return null;

  if (/^\+?\d{6,20}$/.test(first)) return first;

  return null;

}

function formatMaybeDate(x) {

  if (!x) return "--/--";

  const n = Number(x);

  if (!Number.isFinite(n)) return "--/--";

  const ms = n < 10_000_000_000 ? n * 1000 : n; // seconds -> ms heuristic

  const d = new Date(ms);

  if (isNaN(d.getTime())) return "--/--";

  return d.toLocaleString();

}

export default {

  name: "whois",

  aliases: ["userinfo", "info", "check"],

  category: "GROUP",

  description: "Show user info in group (admin status + join date if available).",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "❌ This command works in groups only." }, { quoted: m });

    }

    const sender = getSender(m);

    if (!sender) return;

    // target priority: mentioned > replied > number arg > self

    const mentioned = getMentionedJids(m);

    const replied = getQuotedParticipant(m);

    const numArg = getArgNumber(args);

    const targetJid =

      mentioned?.[0] ||

      replied ||

      (numArg ? toUserJid(numArg) : null) ||

      sender;

    const tag = tagOf(targetJid);

    try {

      const meta = await sock.groupMetadata(from);

      const participants = meta?.participants || [];

      const targetBare = bare(targetJid);

      // Find participant entry (may be stored with different suffix, use bare compare)

      const p = participants.find((x) => bare(x.id) === targetBare);

      const adminType =

        p?.admin === "superadmin"

          ? "⭐ Super Admin"

          : p?.admin

          ? "🛡️ Admin"

          : "👤 Member";

      // Join date (not guaranteed available)

      const joinDate = formatMaybeDate(

        p?.joinedAt || p?.ts || p?.joinTimestamp || p?.joinedAtMs

      );

      // Presence: generally not available -> show --/--

      const presence = "--/--";

      const text =

        `🧾 *WHOIS*\n\n` +

        `👤 User: ${tag}\n` +

        `🛡️ Role: *${adminType}*\n` +

        `📅 Joined: *${joinDate}*\n` +

        `🟢 Status: *${presence}*\n\n` +

        `🏘️ Group: *${meta?.subject || "--/--"}*`;

      return sock.sendMessage(

        from,

        {

          text,

          mentions: [targetJid],

        },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ whois error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};