import { isOwner } from "../checks/isOwner.js";

import {

  DEFAULT_WARN_LIMIT,

  readAntiGMState,

  writeAntiGMState,

} from "../control/antiGroupMentionHandler.js";

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

      mode: "off",

      limit: DEFAULT_WARN_LIMIT,

      warns: {},

    };

  }

  return state.groups[groupJid];

}

export default {

  name: "antigm",

  aliases: ["agm", "antigroupmention"],

  category: "GROUP",

  description: "Block private status group mentions by non-admins.",

  usage: "antigm warn|delete|kick|off|status|limit <number>",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "❌ Group only." }, { quoted: m });

    }

    if (!(await isGroupAdminOrOwner(sock, m, from))) {

      return sock.sendMessage(from, { text: "❌ Admin only." }, { quoted: m });

    }

    const state = await readAntiGMState();

    const cfg = getGroupCfg(state, from);

    const sub = String(args[0] || "status").trim().toLowerCase();

    if (sub === "status") {

      return sock.sendMessage(

        from,

        {

          text:

            `⚙️ *Anti Group Mention*\n\n` +

            `Mode: *${cfg.mode}*\n` +

            `Warn limit: *${cfg.limit || DEFAULT_WARN_LIMIT}*`,

        },

        { quoted: m }

      );

    }

    if (sub === "limit") {

      const n = parseInt(String(args[1] || "").trim(), 10);

      if (!Number.isFinite(n) || n < 1 || n > 50) {

        return sock.sendMessage(

          from,

          { text: "❌ Use a valid limit from 1 to 50.\nExample: antigm limit 3" },

          { quoted: m }

        );

      }

      cfg.limit = n;

      await writeAntiGMState(state);

      return sock.sendMessage(

        from,

        { text: `✅ AntiGM warn limit set to *${n}*.` },

        { quoted: m }

      );

    }

    if (["warn", "delete", "kick", "off"].includes(sub)) {

      cfg.mode = sub;

      if (!Number.isFinite(cfg.limit) || cfg.limit < 1) cfg.limit = DEFAULT_WARN_LIMIT;

      if (!cfg.warns || typeof cfg.warns !== "object") cfg.warns = {};

      await writeAntiGMState(state);

      return sock.sendMessage(

        from,

        {

          text:

            `✅ AntiGM mode set to *${sub}*.` +

            (sub === "warn" ? `\nWarn limit: *${cfg.limit}*` : ""),

        },

        { quoted: m }

      );

    }

    return sock.sendMessage(

      from,

      {

        text:

          "❌ Usage:\n" +

          "• antigm warn\n" +

          "• antigm delete\n" +

          "• antigm kick\n" +

          "• antigm off\n" +

          "• antigm status\n" +

          "• antigm limit 3",

      },

      { quoted: m }

    );

  },

};