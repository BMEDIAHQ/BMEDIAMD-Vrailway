// control/antiFakeHandler.js (ESM)

// AntiFake: block numbers by country code prefixes (group-specific)

// Modes:

// - delete: delete their messages

// - warn: delete + warn; kick at warnLimit

// - kick: kick immediately

//

// Config fields per group:

// enabled: boolean

// mode: "delete" | "warn" | "kick"

// listType: "block" | "allow"   (block list or allow-only list)

// codes: string[]              (e.g. ["234","91"] or ["1","44"])

// warnLimit: number

// warns: { senderBare: number }

//

// Call: await handleAntiFake(sock, m, from);

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, "antiFakeStore.json");

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender || null;

}

function tagOf(jid) {

  return `@${String(jid || "").split("@")[0].split(":")[0]}`;

}

async function readStore() {

  try {

    const raw = await fs.readFile(STORE_PATH, "utf8");

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};

  } catch {

    return {};

  }

}

async function writeStore(data) {

  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");

}

export async function getAntiFakeConfig(chatId) {

  const store = await readStore();

  const cfg = store[chatId] || {};

  return {

    enabled: Boolean(cfg.enabled),

    mode: cfg.mode || "delete",          // delete | warn | kick

    listType: cfg.listType || "block",   // block | allow

    codes: Array.isArray(cfg.codes) ? cfg.codes : [], // strings without "+"

    warnLimit: Number(cfg.warnLimit ?? 3),

    warns: cfg.warns || {},              // senderBare -> count

  };

}

export async function setAntiFakeConfig(chatId, patch = {}) {

  const store = await readStore();

  const cur = store[chatId] || {};

  store[chatId] = {

    ...cur,

    ...patch,

    codes: patch.codes ?? cur.codes ?? [],

    warns: patch.warns ?? cur.warns ?? {},

  };

  await writeStore(store);

  return store[chatId];

}

async function isAdminOrSuper(sock, groupJid, senderId) {

  try {

    const meta = await sock.groupMetadata(groupJid);

    const sb = bare(senderId);

    const p = (meta.participants || []).find((x) => bare(x.id) === sb);

    return Boolean(p?.admin);

  } catch {

    return false;

  }

}

async function deleteMessage(sock, from, m) {

  try {

    await sock.sendMessage(from, { delete: m.key });

    return true;

  } catch {

    return false;

  }

}

async function kickMember(sock, from, senderId) {

  try {

    const meta = await sock.groupMetadata(from);

    const sb = bare(senderId);

    const p = (meta.participants || []).find((x) => bare(x.id) === sb);

    const target = p?.id || senderId;

    await sock.groupParticipantsUpdate(from, [target], "remove");

    return true;

  } catch {

    return false;

  }

}

function extractCountryCode(senderJid) {

  // senderBare like: "2376xxxxxxx"

  const sb = bare(senderJid);

  // WhatsApp numbers are usually countrycode + national number (no "+")

  // We'll match by prefix from config list.

  return sb;

}

function normalizeCodes(codes = []) {

  return (codes || [])

    .map((c) => String(c).trim().replace(/^\+/, ""))

    .filter((c) => c && /^[0-9]{1,4}$/.test(c));

}

function matchPrefix(num, codes) {

  return codes.find((cc) => num.startsWith(cc)) || null;

}

export async function handleAntiFake(sock, m, from) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    const cfg = await getAntiFakeConfig(from);

    if (!cfg.enabled) return;

    const sender = getSender(m);

    if (!sender) return;

    // ignore admins

    const admin = await isAdminOrSuper(sock, from, sender);

    if (admin) return;

    const num = extractCountryCode(sender);

    const codes = normalizeCodes(cfg.codes);

    if (!codes.length) return; // no list => nothing to enforce

    const hit = matchPrefix(num, codes);

    // Decide block

    let shouldBlock = false;

    if (cfg.listType === "block") {

      // block if matches any blocked code

      shouldBlock = Boolean(hit);

    } else {

      // allow-only: block if NOT matching allowed codes

      shouldBlock = !Boolean(hit);

    }

    if (!shouldBlock) return;

    // Always delete their message

    await deleteMessage(sock, from, m);

    const mode = String(cfg.mode || "delete").toLowerCase();

    const tag = tagOf(sender);

    // delete => silent

    if (mode === "delete") return;

    // kick => immediate kick

    if (mode === "kick") {

      await kickMember(sock, from, sender);

      return sock.sendMessage(

        from,

        {

          text: `🚫 *AntiFake*\n\n${tag} removed (blocked country code).`,

          mentions: [sender],

        },

        { quoted: m }

      );

    }

    // warn => warn + kick at limit

    const warns = { ...(cfg.warns || {}) };

    const sb = bare(sender);

    warns[sb] = Number(warns[sb] || 0) + 1;

    const limit = Math.max(1, Number(cfg.warnLimit || 3));

    await setAntiFakeConfig(from, { warns });

    await sock.sendMessage(

      from,

      {

        text:

          `🚫 *AntiFake*\n\n` +

          `${tag} blocked country code.\n` +

          `⚠️ Warn: *${warns[sb]}/${limit}*`,

        mentions: [sender],

      },

      { quoted: m }

    );

    if (warns[sb] >= limit) {

      const kicked = await kickMember(sock, from, sender);

      // reset warns after kick attempt

      const fresh = await getAntiFakeConfig(from);

      const w2 = { ...(fresh.warns || {}) };

      delete w2[sb];

      await setAntiFakeConfig(from, { warns: w2 });

      if (kicked) {

        await sock.sendMessage(

          from,

          { text: `👢 Removed ${tag} (AntiFake warn limit reached).`, mentions: [sender] }

        );

      }

    }

  } catch (e) {

    console.log("[AntiFake] handler error:", e?.message || e);

  }

}