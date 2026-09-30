// commands/kickbatch.js (ESM)

// ✅ Kick Batch (Owner-only)

// - NO bot-admin check

// - 2-step confirmation to prevent accidents

// - ✅ Confirm now requires re-supplying the count to avoid confirming an old pending request

//

// Usage:

//   !kickbatch <count>

//   !kickbatch confirm <count> BMEDIA KICK BATCH

//   !kickbatch stop

//

// .env (recommended):

//   BOT_OWNER_LIDS=11867565125694@lid

//   BOT_OWNERS=237689660487,237696086000

//   KICKBATCH_DELAY_MS=1200

//   KICKBATCH_MAX_PER_RUN=50

//   KICKBATCH_CONFIRM_TTL_MS=90000

function isGroupJid(jid) {

  return typeof jid === "string" && jid.endsWith("@g.us");

}

function normalizeId(input) {

  if (!input) return "";

  let s = String(input).trim();

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

  const botJid = getBotJid(sock);

  if (!envOwners.length && botJid.endsWith("@s.whatsapp.net")) return [botJid];

  return envOwners;

}

function sleep(ms) {

  return new Promise((res) => setTimeout(res, ms));

}

function getStore() {

  if (!globalThis.__KICKBATCH_STORE__) globalThis.__KICKBATCH_STORE__ = new Map();

  return globalThis.__KICKBATCH_STORE__;

}

function keyFor(from, senderJid) {

  return `${from}::${senderJid}`;

}

function parseCount(arg) {

  const n = Number(String(arg || "").trim());

  if (!Number.isFinite(n)) return 0;

  return Math.floor(n);

}

export default {

  name: "kickbatch",

  aliases: ["kickbtc"],

  category: "GROUP",

  description: "Owner-only: remove a number of members (requires confirm).",

  async execute(ctx) {

    const { sock, m, from, sender, args, prefix } = ctx;

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

    const senderId = senderJids[0] || senderLids[0] || normalizeId(sender);

    const sub = String(args?.[0] || "").toLowerCase();

    const CONFIRM_TEXT = "BMEDIA KICK BATCH";

    const store = getStore();

    const k = keyFor(from, senderId);

    const delayMs = Math.max(300, Number(process.env.KICKBATCH_DELAY_MS || 1200));

    const maxPerRun = Math.max(1, Number(process.env.KICKBATCH_MAX_PER_RUN || 50));

    const ttlMs = Math.max(10_000, Number(process.env.KICKBATCH_CONFIRM_TTL_MS || 90_000));

    // stop

    if (sub === "stop") {

      store.delete(k);

      return sock.sendMessage(from, { text: "✅ Kick batch stopped / cleared." }, { quoted: m });

    }

    // confirm: !kickbatch confirm <count> BMEDIA KICK BATCH

    if (sub === "confirm") {

      const providedCount = parseCount(args?.[1]);

      const confirmPhrase = (args || []).slice(2).join(" ").trim();

      if (!providedCount) {

        return sock.sendMessage(

          from,

          { text: `❌ Missing count.\nUse:\n${prefix}kickbatch confirm <count> ${CONFIRM_TEXT}` },

          { quoted: m }

        );

      }

      if (confirmPhrase !== CONFIRM_TEXT) {

        return sock.sendMessage(

          from,

          { text: `❌ Wrong confirm text.\nUse:\n${prefix}kickbatch confirm <count> ${CONFIRM_TEXT}` },

          { quoted: m }

        );

      }

      const pending = store.get(k);

      if (!pending) {

        return sock.sendMessage(from, { text: "❌ No pending batch to confirm." }, { quoted: m });

      }

      // TTL check

      if (Date.now() - pending.createdAt > ttlMs) {

        store.delete(k);

        return sock.sendMessage(from, { text: "⏳ Confirmation expired. Start again." }, { quoted: m });

      }

      // ✅ count must match pending (prevents confirming an old/different request)

      if (providedCount !== pending.count) {

        return sock.sendMessage(

          from,

          {

            text:

              `❌ Count mismatch.\n` +

              `Pending: ${pending.count}\n` +

              `You sent: ${providedCount}\n\n` +

              `Run again with:\n${prefix}kickbatch ${providedCount}`,

          },

          { quoted: m }

        );

      }

      const meta = await sock.groupMetadata(from);

      const botJid = getBotJid(sock);

      const participants = meta?.participants || [];

      const groupOwner = normalizeId(meta?.owner || "");

      // build kick list: exclude owner + bot + sender ONLY (no admin logic)

      let targets = participants

        .map((p) => normalizeId(p?.id))

        .filter(Boolean)

        .filter((jid) => jid !== normalizeId(botJid))

        .filter((jid) => jid !== normalizeId(senderId))

        .filter((jid) => (groupOwner ? jid !== groupOwner : true));

      const count = Math.min(pending.count, maxPerRun, targets.length);

      targets = targets.slice(0, count);

      if (!targets.length) {

        store.delete(k);

        return sock.sendMessage(from, { text: "ℹ️ No eligible members to remove." }, { quoted: m });

      }

      await sock.sendMessage(

        from,

        { text: `⚠️ Starting kick batch: removing ${targets.length} member(s)...` },

        { quoted: m }

      );

      let ok = 0;

      let fail = 0;

      for (const jid of targets) {

        try {

          await sock.groupParticipantsUpdate(from, [jid], "remove");

          ok++;

        } catch {

          fail++;

        }

        await sleep(delayMs);

      }

      store.delete(k);

      return sock.sendMessage(

        from,

        { text: `✅ Kick batch done.\nRemoved: ${ok}\nFailed: ${fail}` },

        { quoted: m }

      );

    }

    // start request: !kickbatch <count>

    const count = parseCount(args?.[0]);

    if (!count || count < 1) {

      return sock.sendMessage(

        from,

        {

          text:

            `Usage:\n` +

            `${prefix}kickbatch <count>\n` +

            `${prefix}kickbatch confirm <count> ${CONFIRM_TEXT}\n` +

            `${prefix}kickbatch stop`,

        },

        { quoted: m }

      );

    }

    const safeCount = Math.min(count, Number(process.env.KICKBATCH_MAX_PER_RUN || 50));

    store.set(k, { count: safeCount, createdAt: Date.now() });

    return sock.sendMessage(

      from,

      {

        text:

          `⚠️ Kick batch requested: ${safeCount} member(s).\n` +

          `To confirm, send:\n` +

          `${prefix}kickbatch confirm ${safeCount} ${CONFIRM_TEXT}\n` +

          `To cancel: ${prefix}kickbatch stop`,

      },

      { quoted: m }

    );

  },

};