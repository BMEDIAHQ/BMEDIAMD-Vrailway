// commands/kick.js (ESM)

// ✅ Owner-only (LID-first) kick

// ✅ NO bot-admin precheck (WhatsApp will block it if not admin)

// ✅ Target can be JID or LID (tries both if needed)

//

// Usage:

//   !kick @user

//   !kick 2376xxxxxxx

//   Reply to user + !kick

//

// .env (RECOMMENDED):

// BOT_OWNER_LIDS=11867565125694@lid

// Optional fallback:

// BOT_OWNERS=237689660487,237696086000

function isGroupJid(jid) {

  return typeof jid === "string" && jid.endsWith("@g.us");

}

function normalizeId(input) {

  if (!input) return "";

  let s = String(input).trim();

  // remove device suffix:

  // "237xxx:75@s.whatsapp.net" -> "237xxx@s.whatsapp.net"

  // "118xxx:75@lid" -> "118xxx@lid"

  if (s.includes(":") && (s.includes("@s.whatsapp.net") || s.includes("@lid"))) {

    const base = s.split(":")[0];

    if (s.includes("@s.whatsapp.net")) return `${base}@s.whatsapp.net`;

    if (s.includes("@lid")) return `${base}@lid`;

  }

  if (s.endsWith("@s.whatsapp.net") || s.endsWith("@g.us") || s.endsWith("@lid")) return s;

  const digits = s.replace(/[^\d]/g, "");

  if (digits) return `${digits}@s.whatsapp.net`;

  return s;

}

function uniq(arr) {

  return [...new Set((arr || []).filter(Boolean))];

}

function getSenderCandidates(ctx) {

  const { sender, m } = ctx;

  const cands = [

    sender,

    m?.key?.participant,

    m?.participant,

    m?.message?.extendedTextMessage?.contextInfo?.participant,

  ].map(normalizeId);

  return uniq(cands);

}

function getOwnerLids() {

  const raw =

    process.env.BOT_OWNER_LIDS ||

    process.env.BOT_OWNERS_LID ||

    process.env.OWNER_LIDS ||

    "";

  return uniq(

    String(raw)

      .split(/[,|\n\s]+/g)

      .map((x) => normalizeId(x))

      .filter((x) => x.endsWith("@lid"))

  );

}

function getBotJid(sock) {

  return normalizeId(sock?.user?.id || sock?.user?.jid || "");

}

function getOwnerJids(sock) {

  const raw =

    process.env.BOT_OWNERS ||

    process.env.BOT_OWNER ||

    process.env.OWNERS ||

    process.env.OWNER_NUMBER ||

    "";

  const envOwners = uniq(

    String(raw)

      .split(/[,|\n\s]+/g)

      .map((x) => normalizeId(x))

      .filter((x) => x.endsWith("@s.whatsapp.net"))

  );

  // fallback: bot JID becomes owner (prevents lockout)

  const botJid = getBotJid(sock);

  if (!envOwners.length && botJid.endsWith("@s.whatsapp.net")) return [botJid];

  return envOwners;

}

function pickTarget(ctx) {

  const { m, args } = ctx;

  // 1) mention

  const mentioned =

    m?.message?.extendedTextMessage?.contextInfo?.mentionedJid ||

    [];

  if (Array.isArray(mentioned) && mentioned[0]) return normalizeId(mentioned[0]);

  // 2) reply target

  const replied =

    m?.message?.extendedTextMessage?.contextInfo?.participant ||

    "";

  if (replied) return normalizeId(replied);

  // 3) raw args

  const joined = (args || []).join(" ").trim();

  if (!joined) return "";

  return normalizeId(joined);

}

function asJidFromLid(lid) {

  const base = String(lid || "").split("@")[0].replace(/[^\d]/g, "");

  if (!base) return "";

  return `${base}@s.whatsapp.net`;

}

function looksLikeNotAdmin(errText) {

  const t = String(errText || "").toLowerCase();

  return (

    t.includes("not-authorized") ||

    t.includes("not authorized") ||

    t.includes("forbidden") ||

    t.includes("insufficient") ||

    t.includes("admin")

  );

}

export default {

  name: "kick",

  aliases: ["remove"],

  category: "owner",

  description: "Owner-only remove a member.",

  async execute(ctx) {

    const { sock, m, from, prefix } = ctx;

    if (!isGroupJid(from)) {

      return sock.sendMessage(from, { text: "❌ This command works in groups only." }, { quoted: m });

    }

    // ✅ OWNER CHECK (LID FIRST, fallback to JID)

    const senderCandidates = getSenderCandidates(ctx);

    const senderLids = senderCandidates.filter((x) => x.endsWith("@lid"));

    const senderJids = senderCandidates.filter((x) => x.endsWith("@s.whatsapp.net"));

    const ownerLids = getOwnerLids();

    const ownerJids = getOwnerJids(sock);

    let isOwner = false;

    if (senderLids.length || ownerLids.length) {

      isOwner = senderLids.some((x) => ownerLids.includes(x));

    }

    if (!isOwner) {

      isOwner = senderJids.some((x) => ownerJids.includes(x));

    }

    if (!isOwner) {

      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    }

    // ✅ TARGET

    const target = pickTarget(ctx);

    if (!target) {

      return sock.sendMessage(

        from,

        { text: `Usage:\n${prefix}kick @user\n${prefix}kick 2376xxxxxxx\n(or reply to a user then ${prefix}kick)` },

        { quoted: m }

      );

    }

    // Bot JID for safety

    const botJid = getBotJid(sock);

    if (target === botJid) {

      return sock.sendMessage(from, { text: "❌ I can't kick myself." }, { quoted: m });

    }

    // Block kicking owners (optional safety)

    if (ownerLids.includes(target) || ownerJids.includes(target)) {

      return sock.sendMessage(from, { text: "❌ I won't kick a bot owner." }, { quoted: m });

    }

    // ✅ Kick attempts:

    // 1) try target as-is (LID or JID)

    // 2) if LID, also try digits@s.whatsapp.net

    const attempts = [target];

    if (target.endsWith("@lid")) {

      const alt = asJidFromLid(target);

      if (alt) attempts.push(alt);

    }

    let lastErr = "";

    for (const t of uniq(attempts)) {

      try {

        await sock.groupParticipantsUpdate(from, [t], "remove");

        return sock.sendMessage(from, { text: "✅ Target acquired." }, { quoted: m });

      } catch (e) {

        lastErr = String(e?.message || e || "");

        if (looksLikeNotAdmin(lastErr)) {

          return sock.sendMessage(from, { text: "❌ I must be an admin to kick users." }, { quoted: m });

        }

      }

    }

    return sock.sendMessage(from, { text: `❌ Kick failed: ${lastErr.slice(0, 220)}` }, { quoted: m });

  },

};