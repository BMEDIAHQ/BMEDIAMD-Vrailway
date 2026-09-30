// commands/approve.js (ESM)

// Owner-only: set join approval mode (chat-specific)

// Usage:

//   <prefix>approve off

//   <prefix>approve approve   (auto-approve join requests)

//   <prefix>approve reject    (auto-reject join requests)

//

// Shortcut: <prefix>approve  => sets approve

import { isOwner } from "../checks/isOwner.js";

import { setJoinApprovalMode } from "../control/joinApprovalHandler.js";

export default {

  name: "approve",

  aliases: ["joinapprove", "joinapproval"],

  category: "GROUP",

  description: "Owner-only: auto-approve join requests (or set off/reject).",

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

    const mode = (args[0] || "approve").toLowerCase();

    let setTo = "approve";

    if (mode === "off" || mode === "disable") setTo = "off";

    else if (mode === "reject") setTo = "reject";

    else if (mode === "approve" || mode === "on" || mode === "enable") setTo = "approve";

    const finalMode = await setJoinApprovalMode(from, setTo);

    const pretty =

      finalMode === "off" ? "OFF" : finalMode === "approve" ? "APPROVE ✅" : "REJECT ❌";

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