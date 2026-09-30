// handlers/antiGroupMentionHandler.js

import fs from "fs/promises";

import path from "path";

export const DEFAULT_WARN_LIMIT = 3;

const CONTROL_DIR = path.join(process.cwd(), "control");

const STATE_PATH = path.join(CONTROL_DIR, "antigm.json");

function normalizeUserJid(jid = "") {

  const s = String(jid || "");

  if (!s) return "";

  if (s.endsWith("@g.us")) return s;

  const left = s.split("@")[0].split(":")[0];

  return /^\d+$/.test(left) ? `${left}@s.whatsapp.net` : s;

}

function makeTag(id) {

  return `@${String(id || "").split("@")[0].split(":")[0]}`;

}

function unwrapMessage(msg) {

  let x = msg || {};

  for (let i = 0; i < 6; i++) {

    if (x?.ephemeralMessage?.message) {

      x = x.ephemeralMessage.message;

      continue;

    }

    if (x?.viewOnceMessageV2?.message) {

      x = x.viewOnceMessageV2.message;

      continue;

    }

    if (x?.viewOnceMessage?.message) {

      x = x.viewOnceMessage.message;

      continue;

    }

    break;

  }

  return x || {};

}

function collectGroupJids(node, out = new Set(), depth = 0) {

  if (!node || depth > 6) return out;

  if (typeof node === "string") {

    if (node.endsWith("@g.us")) out.add(node);

    return out;

  }

  if (Array.isArray(node)) {

    for (const item of node) collectGroupJids(item, out, depth + 1);

    return out;

  }

  if (typeof node === "object") {

    for (const [k, v] of Object.entries(node)) {

      if (

        typeof v === "string" &&

        v.endsWith("@g.us") &&

        ["groupJid", "jid", "remoteJid", "targetJid", "mentionedJid"].includes(k)

      ) {

        out.add(v);

      } else {

        collectGroupJids(v, out, depth + 1);

      }

    }

  }

  return out;

}

function isGroupStatusMentionMessage(m, groupJid) {

  const msg = unwrapMessage(m?.message || {});

  const keys = Object.keys(msg || {}).map((k) => k.toLowerCase());

  if (keys.some((k) => k.includes("groupstatusmentionmessage"))) return true;

  if (keys.some((k) => k.includes("statusmentionmessage"))) {

    const groups = [...collectGroupJids(msg)];

    return groups.length ? groups.includes(groupJid) : true;

  }

  const groups = [...collectGroupJids(msg)];

  if (groups.includes(groupJid)) {

    const ctx =

      msg?.messageContextInfo ||

      msg?.extendedTextMessage?.contextInfo ||

      msg?.imageMessage?.contextInfo ||

      msg?.videoMessage?.contextInfo ||

      {};

    if (ctx?.statusMentionSources || ctx?.statusMentions || ctx?.isStatus) return true;

  }

  return false;

}

export async function readAntiGMState() {

  try {

    const raw = await fs.readFile(STATE_PATH, "utf8");

    const j = JSON.parse(raw);

    return {

      groups: typeof j?.groups === "object" && j.groups ? j.groups : {},

    };

  } catch {

    return { groups: {} };

  }

}

export async function writeAntiGMState(state) {

  await fs.mkdir(CONTROL_DIR, { recursive: true });

  await fs.writeFile(

    STATE_PATH,

    JSON.stringify(

      {

        groups: typeof state?.groups === "object" && state.groups ? state.groups : {},

      },

      null,

      2

    ),

    "utf8"

  );

}

function getGroupCfg(state, groupJid) {

  if (!state.groups[groupJid]) {

    state.groups[groupJid] = {

      mode: "off",

      limit: DEFAULT_WARN_LIMIT,

      warns: {},

    };

  }

  const cfg = state.groups[groupJid];

  if (!cfg.mode) cfg.mode = "off";

  if (!Number.isFinite(cfg.limit) || cfg.limit < 1) cfg.limit = DEFAULT_WARN_LIMIT;

  if (!cfg.warns || typeof cfg.warns !== "object") cfg.warns = {};

  return cfg;

}

async function deleteMessage(sock, jid, key) {

  try {

    await sock.sendMessage(jid, { delete: key });

    return true;

  } catch {

    return false;

  }

}

async function isAdmin(sock, groupJid, userJid) {

  try {

    const meta = await sock.groupMetadata(groupJid);

    const row = (meta?.participants || []).find(

      (p) => normalizeUserJid(p.id) === normalizeUserJid(userJid)

    );

    return !!row?.admin;

  } catch {

    return false;

  }

}

export async function handleAntiGroupMention(sock, m) {

  try {

    const from = m?.key?.remoteJid;

    if (!from || !from.endsWith("@g.us")) return false;

    const state = await readAntiGMState();

    const cfg = getGroupCfg(state, from);

    if (cfg.mode === "off") return false;

    if (!isGroupStatusMentionMessage(m, from)) return false;

    const rawSender = m?.key?.participant || m?.participant || m?.sender || "";

    if (!rawSender) return true;

    const sender = normalizeUserJid(rawSender);

    if (await isAdmin(sock, from, sender)) return true;

    await deleteMessage(sock, from, m.key);

    if (cfg.mode === "delete") {

      await sock.sendMessage(

        from,

        { text: "⚠️ Group mentioning is forbidden in this chat." },

        { quoted: m }

      );

      return true;

    }

    if (cfg.mode === "kick") {

      try {

        await sock.groupParticipantsUpdate(from, [sender], "remove");

      } catch {}

      await sock.sendMessage(

        from,

        {

          text: `🚫 ${makeTag(rawSender)} was removed.\nPrivate status group mentioning is forbidden here.`,

          mentions: [rawSender],

        },

        { quoted: m }

      );

      return true;

    }

    cfg.warns[sender] = (Number(cfg.warns[sender]) || 0) + 1;

    const count = cfg.warns[sender];

    const limit = cfg.limit || DEFAULT_WARN_LIMIT;

    await writeAntiGMState(state);

    if (count >= limit) {

      delete cfg.warns[sender];

      await writeAntiGMState(state);

      try {

        await sock.groupParticipantsUpdate(from, [sender], "remove");

      } catch {}

      await sock.sendMessage(

        from,

        {

          text:

            `🚫 ${makeTag(rawSender)} reached the AntiGM warn limit ` +

            `(${limit}/${limit}) and was removed.`,

          mentions: [rawSender],

        },

        { quoted: m }

      );

      return true;

    }

    await sock.sendMessage(

      from,

      {

        text:

          `⚠️ ${makeTag(rawSender)} private status group mentioning is forbidden here.\n` +

          `Warn: ${count}/${limit}`,

        mentions: [rawSender],

      },

      { quoted: m }

    );

    return true;

  } catch {

    return false;

  }

}