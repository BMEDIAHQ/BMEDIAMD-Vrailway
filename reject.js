// commands/reject.js (ESM)

// Owner-only: quick command to set join approval mode to REJECT (or OFF)

//

// Usage:

//   <prefix>reject         => sets reject

//   <prefix>reject off     => sets off

import { isOwner } from "../checks/isOwner.js";

import { setJoinApprovalMode } from "../control/joinApprovalHandler.js";

export default {

  name: "reject",

  aliases: ["joinreject"],

  category: "GROUP",

  description: "Owner-only: auto-reject join requests (or set off).",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const sender = m?.key?.participant || m?.participant || m?.sender;

    if (!sender) return;

    const tag = `@${sender.split("@")[0].split(":")[0]}`;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    if (!isOwner(m, sock)) {

      return sock.sendMessage(

        from,

        { text: `❌ Owner only.\n\n${tag}`, mentions: [sender] },

        { quoted: m }

      );

    }

    const mode = (args[0] || "reject").toLowerCase();

    const setTo = mode === "off" || mode === "disable" ? "off" : "reject";

    const finalMode = await setJoinApprovalMode(from, setTo);

    const pretty = finalMode === "off" ? "OFF" : "REJECT ❌";

    return sock.sendMessage(

      from,

      {

        text: `✅ ${tag} set join-requests mode to: *${pretty}*`,

        mentions: [sender],

      },

      { quoted: m }

    );

  },

};