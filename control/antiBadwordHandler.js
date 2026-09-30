// control/antiBadwordHandler.js (ESM)

// ✅ Updated to behave like your AntiLink handler style:

// - Detect sender with: m?.key?.participant || m?.participant || m?.sender || senderJid

// - Delete with: await sock.sendMessage(from, { delete: m.key })

// - Tag with: @${sender.split("@")[0].split(":")[0]}

// - Warn text exactly: "@sender bad words are not permitted"

//

// NOTE: This version deletes for EVERYONE (including admins) so it won’t “skip” during tests.

import fs from "fs";

import path from "path";

const CONTROL_DIR = path.resolve(process.cwd(), "control");

const CONFIG_FILE = path.join(CONTROL_DIR, "config.json");

function readConfig() {

  try {

    if (!fs.existsSync(CONFIG_FILE)) return {};

    const raw = fs.readFileSync(CONFIG_FILE, "utf8");

    return raw?.trim() ? JSON.parse(raw) : {};

  } catch {

    return {};

  }

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

function normalizeWords(list) {

  if (!Array.isArray(list)) return [];

  return list

    .map((w) => String(w || "").trim().toLowerCase())

    .filter(Boolean)

    .slice(0, 500);

}

function containsBadword(text, words) {

  const t = String(text || "").toLowerCase();

  for (const w of words) {

    if (!w) continue;

    if (t.includes(w)) return w; // same simple matching style as your link regex approach

  }

  return "";

}

export async function handleAntiBadword(sock, m, from, senderJid) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    const cfg = readConfig();

    const groupCfg = cfg?.antiBadwordGroups?.[from];

    if (!groupCfg?.enabled) return;

    const words = normalizeWords(groupCfg.words);

    if (!words.length) return;

    const text = getText(m);

    if (!text) return;

    const hit = containsBadword(text, words);

    if (!hit) return;

    const sender = m?.key?.participant || m?.participant || m?.sender || senderJid;

    if (!sender) return;

    // ✅ Delete (same “delete key” style you use for AntiLink)

    await sock.sendMessage(from, { delete: m.key }).catch(() => {});

    // ✅ Tagging method (exact)

    const tag = `@${sender.split("@")[0].split(":")[0]}`;

    // ✅ Warn message (exact wording requested)

    await sock

      .sendMessage(

        from,

        {

          text: `${tag} bad words are not permitted`,

          mentions: [sender],

        },

        { quoted: m }

      )

      .catch(() => {});

  } catch (e) {

    console.log("[antibadword] handler error:", e?.message || e);

  }

}