import fs from "fs/promises";

import path from "path";

export const DEFAULT_GMC_MESSAGE =

  "No matter how many times you mention. I shall see no Evil 🙈😹";

const CONTROL_DIR = path.join(process.cwd(), "control");

const STATE_PATH = path.join(CONTROL_DIR, "gmc.json");

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

export async function readGMCommentState() {

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

export async function writeGMCommentState(state) {

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

      enabled: false,

      message: DEFAULT_GMC_MESSAGE,

    };

  }

  const cfg = state.groups[groupJid];

  if (typeof cfg.enabled !== "boolean") cfg.enabled = false;

  if (!cfg.message || typeof cfg.message !== "string") cfg.message = DEFAULT_GMC_MESSAGE;

  return cfg;

}

export async function handleGMComment(sock, m) {

  try {

    const from = m?.key?.remoteJid;

    if (!from || !from.endsWith("@g.us")) return false;

    const state = await readGMCommentState();

    const cfg = getGroupCfg(state, from);

    if (!cfg.enabled) return false;

    if (!isGroupStatusMentionMessage(m, from)) return false;

    const rawSender = m?.key?.participant || m?.participant || m?.sender || "";

    if (!rawSender) return true;

    const sender = normalizeUserJid(rawSender);

    if (!sender) return true;

    await sock.sendMessage(

      from,

      {

        text: `${makeTag(rawSender)} ${cfg.message}`,

        mentions: [rawSender],

      },

      { quoted: m }

    );

    return true;

  } catch {

    return false;

  }

}