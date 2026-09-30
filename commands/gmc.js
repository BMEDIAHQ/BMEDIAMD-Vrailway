import { isOwner } from "../checks/isOwner.js";

import {

  DEFAULT_GMC_MESSAGE,

  readGMCommentState,

  writeGMCommentState,

} from "../control/gmCommentHandler.js";

function normalizeUserJid(jid = "") {

  const s = String(jid || "");

  if (!s) return "";

  if (s.endsWith("@g.us")) return s;

  const left = s.split("@")[0].split(":")[0];

  return /^\d+$/.test(left) ? `${left}@s.whatsapp.net` : s;

}

async function isGroupAdminOrOwner(sock, m, from) {

  try {

    if (isOwner(m, sock)) return true;

  } catch {}

  try {

    const meta = await sock.groupMetadata(from);

    const me = normalizeUserJid(m?.key?.participant || m?.participant || m?.sender);

    const row = (meta?.participants || []).find((p) => normalizeUserJid(p.id) === me);

    return !!row?.admin;

  } catch {

    return false;

  }

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

export default {

  name: "gmc",

  aliases: ["gmcomment", "groupmentioncomment"],

  category: "GROUP",

  description: "Reply whenever someone mentions this group in private status.",

  usage: "gmc on | off | message <text> | status",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "❌ Group only." }, { quoted: m });

    }

    if (!(await isGroupAdminOrOwner(sock, m, from))) {

      return sock.sendMessage(from, { text: "❌ Admin only." }, { quoted: m });

    }

    const state = await readGMCommentState();

    const cfg = getGroupCfg(state, from);

    const sub = String(args[0] || "status").trim().toLowerCase();

    if (sub === "status") {

      return sock.sendMessage(

        from,

        {

          text:

            `⚙️ *GMComment*\n\n` +

            `Status: *${cfg.enabled ? "ON" : "OFF"}*\n` +

            `Message: ${cfg.message}`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      cfg.enabled = true;

      await writeGMCommentState(state);

      return sock.sendMessage(

        from,

        { text: "✅ GMComment enabled." },

        { quoted: m }

      );

    }

    if (sub === "off") {

      cfg.enabled = false;

      await writeGMCommentState(state);

      return sock.sendMessage(

        from,

        { text: "✅ GMComment disabled." },

        { quoted: m }

      );

    }

    if (sub === "message") {

      const msg = String(args.slice(1).join(" ") || "").trim();

      if (!msg) {

        return sock.sendMessage(

          from,

          {

            text:

              "❌ Provide the reply message.\n" +

              "Example: gmc message No matter how many times you mention. I shall see no Evil 🙈😹",

          },

          { quoted: m }

        );

      }

      cfg.message = msg;

      await writeGMCommentState(state);

      return sock.sendMessage(

        from,

        { text: `✅ GMComment message updated.\n\n${cfg.message}` },

        { quoted: m }

      );

    }

    return sock.sendMessage(

      from,

      {

        text:

          "❌ Usage:\n" +

          "• gmc on\n" +

          "• gmc off\n" +

          "• gmc status\n" +

          "• gmc message <text>",

      },

      { quoted: m }

    );

  },

};