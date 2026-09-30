// control/antiLinkHandler.js (ESM)

// USES EXACT SAME METHOD as your adminlinktag.js for:

// ✅ admin check (groupMetadata + bare() compare)

// ✅ link detection (same regexes + facebook.me + ayoba.me)

// ✅ tagging ( @${sender.split("@")[0].split(":")[0]} )

// Behavior:

// - If sender is admin/superadmin: IGNORE (do nothing)

// - If sender is NOT admin:

//    mode=delete => delete message + warn text

//    mode=warn   => delete message + warn count; kick at warnLimit

//    mode=kick   => delete message + kick immediately

//

// Config (stored in control/config.json):

// cfg.antiLinkGroups[groupJid] = { enabled: boolean, mode: "delete"|"warn"|"kick", warnLimit: number }

// cfg.antiLinkWarns[groupJid][senderBare] = number

import fs from "fs";

import path from "path";

const CONTROL_DIR = path.resolve(process.cwd(), "control");

const CONFIG_FILE = path.join(CONTROL_DIR, "config.json");

function ensureControlDir() {

  if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });

}

function readConfig() {

  try {

    if (!fs.existsSync(CONFIG_FILE)) return {};

    const raw = fs.readFileSync(CONFIG_FILE, "utf8");

    return raw?.trim() ? JSON.parse(raw) : {};

  } catch {

    return {};

  }

}

function writeConfig(cfg) {

  ensureControlDir();

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));

}

// EXACT same bare() approach

const bare = (id) => String(id || "").split("@")[0].split(":")[0];

// EXACT same link detection approach

function hasLink(text = "") {

  const t = String(text || "");

  return (

    /\b(chat\.whatsapp\.com\/[0-9A-Za-z]{10,})\b/i.test(t) ||

    /\b((?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s]*)?\b/i.test(t) ||

    /facebook\.me/i.test(t) ||

    /ayoba\.me/i.test(t)

  );

}

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    ""

  );

}

function ensureGroupCfg(cfg, groupJid) {

  cfg.antiLinkGroups = cfg.antiLinkGroups || {};

  cfg.antiLinkGroups[groupJid] = cfg.antiLinkGroups[groupJid] || {};

  const g = cfg.antiLinkGroups[groupJid];

  if (typeof g.enabled !== "boolean") g.enabled = false;

  if (!["delete", "warn", "kick"].includes(g.mode)) g.mode = "delete";

  if (!Number.isInteger(g.warnLimit) || g.warnLimit < 1) g.warnLimit = 3;

  cfg.antiLinkWarns = cfg.antiLinkWarns || {};

  cfg.antiLinkWarns[groupJid] = cfg.antiLinkWarns[groupJid] || {};

  return g;

}

export async function handleAntiLink(sock, m, from, senderJid) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (m?.key?.fromMe) return; // don't moderate bot messages

    const cfg = readConfig();

    const g = ensureGroupCfg(cfg, from);

    if (!g.enabled) return;

    const text = getText(m);

    if (!text) return;

    if (!hasLink(text)) return;

    // EXACT sender detection style (same as adminlinktag)

    const sender = m?.key?.participant || m?.participant || m?.sender || senderJid;

    if (!sender) return;

    // EXACT admin check method (groupMetadata + bare compare)

    let isAdmin = false;

    let meta;

    try {

      meta = await sock.groupMetadata(from);

      const senderBare = bare(sender);

      const me = (meta.participants || []).find((p) => bare(p.id) === senderBare);

      isAdmin = Boolean(me?.admin);

    } catch {

      // if metadata fails, do nothing (safer)

      return;

    }

    // Ignore admins

    if (isAdmin) return;

    // Delete offending message (WhatsApp will block if bot can't)

    await sock.sendMessage(from, { delete: m.key }).catch(() => {});

    const tag = `@${sender.split("@")[0].split(":")[0]}`; // EXACT tagging style

    const mentions = [sender];

    // MODE: delete

    if (g.mode === "delete") {

      return sock.sendMessage(

        from,

        { text: `🚫 Links are not allowed here.\n\n${tag}`, mentions },

        { quoted: m }

      ).catch(() => {});

    }

    // MODE: kick

    if (g.mode === "kick") {

      await sock.groupParticipantsUpdate(from, [sender], "remove").catch(() => {});

      return sock.sendMessage(

        from,

        { text: `🚫 Removed for sending links.\n\n${tag}`, mentions },

        { quoted: m }

      ).catch(() => {});

    }

    // MODE: warn

    if (g.mode === "warn") {

      const senderBareKey = bare(sender);

      const current = parseInt(cfg.antiLinkWarns[from][senderBareKey] || 0, 10) || 0;

      const next = current + 1;

      cfg.antiLinkWarns[from][senderBareKey] = next;

      writeConfig(cfg);

      if (next >= g.warnLimit) {

        await sock.groupParticipantsUpdate(from, [sender], "remove").catch(() => {});

        cfg.antiLinkWarns[from][senderBareKey] = 0;

        writeConfig(cfg);

        return sock.sendMessage(

          from,

          { text: `🚫 Warn limit reached (${g.warnLimit}/${g.warnLimit}). Removed.\n\n${tag}`, mentions },

          { quoted: m }

        ).catch(() => {});

      }

      return sock.sendMessage(

        from,

        { text: `⚠️ Link not allowed.\nWarn: ${next}/${g.warnLimit}\n\n${tag}`, mentions },

        { quoted: m }

      ).catch(() => {});

    }

  } catch (e) {

    console.log("[antilink] handler error:", e?.message || e);

  }

}