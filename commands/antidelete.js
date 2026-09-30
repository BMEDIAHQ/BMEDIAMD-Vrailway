// commands/antidelete.js (ESM)

import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";

import { isOwner } from "../checks/isOwner.js";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// same store file used by control/antiDeleteHandler.js

const STORE_FILE = path.join(__dirname, "../control/antiDeleteStore.json");

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function tagOf(jid) {

  return `@${bare(jid)}`;

}

function normalizeJid(input) {

  const raw = String(input || "").trim();

  if (!raw) return null;

  // already full jid

  if (/@s\.whatsapp\.net$/i.test(raw)) {

    const n = bare(raw).replace(/[^\d]/g, "");

    if (!n) return null;

    return `${n}@s.whatsapp.net`;

  }

  // number only

  const n = raw.replace(/[^\d]/g, "");

  if (!n) return null;

  return `${n}@s.whatsapp.net`;

}

function ownerJidFromEnv(sock) {

  const envNum =

    process.env.OWNER_NUMBER ||

    process.env.OWNER ||

    process.env.BOT_OWNER ||

    "";

  const n = String(envNum).replace(/[^\d]/g, "");

  if (n) return `${n}@s.whatsapp.net`;

  const me = sock?.user?.id ? bare(sock.user.id).replace(/[^\d]/g, "") : "";

  if (me) return `${me}@s.whatsapp.net`;

  return null;

}

function readStore() {

  try {

    if (!fs.existsSync(STORE_FILE)) {

      return { enabled: false, mode: "chat", targetJid: null };

    }

    const raw = fs.readFileSync(STORE_FILE, "utf8");

    const parsed = JSON.parse(raw || "{}");

    return {

      enabled: Boolean(parsed.enabled),

      mode: parsed.mode || "chat",

      targetJid: parsed.targetJid || null,

    };

  } catch {

    return { enabled: false, mode: "chat", targetJid: null };

  }

}

function writeStore(data) {

  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf8");

}

export default {

  name: "antidelete",

  aliases: ["adelete", "antidel"],

  category: "OWNER",

  description: "Owner-only: configure anti-delete destination.",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const sender =

      m?.sender ||

      m?.key?.participant ||

      m?.participant ||

      m?.key?.remoteJid ||

      "";

    if (!isOwner(m, sock)) {

      return sock.sendMessage(

        from,

        {

          text: `❌ Owner only.\n\n${tagOf(sender)}`,

          mentions: sender ? [sender] : [],

        },

        { quoted: m }

      );

    }

    const input = String(args[0] || "").trim().toLowerCase();

    const store = readStore();

    // status

    if (!input || input === "status") {

      let destText = "Current chat";

      if (!store.enabled) {

        destText = "--";

      } else if (store.mode === "dm") {

        destText = ownerJidFromEnv(sock) || "Owner DM";

      } else if (store.mode === "jid") {

        destText = store.targetJid || "--";

      }

      return sock.sendMessage(

        from,

        {

          text:

            `🛑 *ANTI-DELETE STATUS*\n\n` +

            `• Enabled: *${store.enabled ? "ON" : "OFF"}*\n` +

            `• Mode: *${store.mode || "chat"}*\n` +

            `• Destination: *${destText}*`,

        },

        { quoted: m }

      );

    }

    // on

    if (input === "on") {

      const next = {

        enabled: true,

        mode: "chat",

        targetJid: null,

      };

      writeStore(next);

      return sock.sendMessage(

        from,

        {

          text:

            `✅ Anti-delete enabled.\n` +

            `📨 Deleted messages will be sent to *the same chat*.`,

        },

        { quoted: m }

      );

    }

    // off

    if (input === "off") {

      const next = {

        enabled: false,

        mode: "chat",

        targetJid: null,

      };

      writeStore(next);

      return sock.sendMessage(

        from,

        {

          text: `✅ Anti-delete disabled.`,

        },

        { quoted: m }

      );

    }

    // dm

    if (input === "dm") {

      const ownerJid = ownerJidFromEnv(sock);

      const next = {

        enabled: true,

        mode: "dm",

        targetJid: ownerJid,

      };

      writeStore(next);

      return sock.sendMessage(

        from,

        {

          text:

            `✅ Anti-delete enabled in *DM mode*.\n` +

            `📨 Deleted messages will be sent to: *${ownerJid || "owner DM"}*`,

        },

        { quoted: m }

      );

    }

    // antidelete <jid or number>

    const jid = normalizeJid(args[0]);

    if (jid) {

      const next = {

        enabled: true,

        mode: "jid",

        targetJid: jid,

      };

      writeStore(next);

      return sock.sendMessage(

        from,

        {

          text:

            `✅ Anti-delete enabled with custom destination.\n` +

            `📨 Deleted messages will be sent to: *${jid}*`,

        },

        { quoted: m }

      );

    }

    return sock.sendMessage(

      from,

      {

        text:

          `❌ Invalid anti-delete option.\n\n` +

          `Use:\n` +

          `• antidelete on\n` +

          `• antidelete off\n` +

          `• antidelete dm\n` +

          `• antidelete 237xxxxxxxxx\n` +

          `• antidelete 237xxxxxxxxx@s.whatsapp.net\n` +

          `• antidelete status`,

      },

      { quoted: m }

    );

  },

};