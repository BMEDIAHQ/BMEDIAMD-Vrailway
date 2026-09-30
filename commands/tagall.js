// commands/tagall.js (ESM)
// Owner-only tagall using the same owner check style as tag.js
// Modified to send ALL mentions in one single message (no batching)

import { isOwner } from "../checks/isOwner.js";

function numFromJid(jid) {
  return String(jid || "").split("@")[0];
}

export default {
  name: "tagall",
  aliases: ["everyone", "alltag", "mentionall"],
  category: "GROUP",
  description: "Mention all group members in one message.",

  async execute(ctx) {
    const { sock, m, from, args } = ctx;

    if (!from?.endsWith("@g.us")) {
      return sock.sendMessage(
        from,
        { text: "❌ This command works in groups only." },
        { quoted: m }
      );
    }

    // ✅ Owner-only (same check style as your tag command)
    if (!isOwner(m, sock)) {
      return sock.sendMessage(
        from,
        { text: "❌ Owner only." },
        { quoted: m }
      );
    }

    const note = String((args || []).join(" ") || "").trim();

    try {
      const meta = await sock.groupMetadata(from);
      const members = (Array.isArray(meta?.participants) ? meta.participants : [])
        .map((p) => p.id)
        .filter(Boolean);

      if (!members.length) {
        return sock.sendMessage(
          from,
          { text: "❌ No participants found." },
          { quoted: m }
        );
      }

      const list = members
        .map((jid, i) => `${i + 1}. @${numFromJid(jid)}`)
        .join("\n");

      const text =
        `📢 *Tag All*` +
        (note ? `\n${note}` : "") +
        `\n\n${list}`;

      await sock.sendMessage(
        from,
        {
          text,
          mentions: members,
        },
        { quoted: m }
      );
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: `❌ Failed: ${e?.message || e}` },
        { quoted: m }
      );
    }
  },
};
