// commands/ginfo.js (ESM)

// Get group info from an invite link/code.

// Usage:

//   <prefix>ginfo https://chat.whatsapp.com/XXXX

//   <prefix>ginfo XXXX

function extractInviteCode(input = "") {

  const text = String(input || "").trim();

  // full link

  const m = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{10,})/i);

  if (m?.[1]) return m[1];

  // maybe user pasted just the code

  if (/^[0-9A-Za-z]{10,}$/.test(text)) return text;

  return null;

}

function formatDate(ts) {

  if (!ts) return "Unknown";

  const n = Number(ts);

  if (!Number.isFinite(n) || n <= 0) return "Unknown";

  // WA often returns seconds

  const ms = n < 10_000_000_000 ? n * 1000 : n;

  const d = new Date(ms);

  if (isNaN(d.getTime())) return "Unknown";

  return d.toLocaleString("en-GB", { hour12: false });

}

export default {

  name: "ginfo",

  aliases: ["groupinfo", "linkinfo"],

  category: "GROUP",

  description: "Fetch group information from a WhatsApp invite link.",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const input = args?.join(" ") || "";

    const code = extractInviteCode(input);

    if (!code) {

      return sock.sendMessage(

        from,

        {

          text:

            "❌ Provide a WhatsApp group invite link or code.\n\n" +

            "Example:\n" +

            "ginfo https://chat.whatsapp.com/XXXXXXXXXXXX\n" +

            "ginfo XXXXXXXXXXXX",

        },

        { quoted: m }

      );

    }

    try {

      // ✅ Get invite metadata

      const info = await sock.groupGetInviteInfo(code);

      // common fields (may vary)

      const jid = info?.id || info?.gid || info?.jid || null;

      const name = info?.subject || info?.title || "Unknown";

      const desc = info?.desc || info?.description || "No description";

      const size = info?.size ?? info?.participants?.length ?? "Unknown";

      const created = formatDate(info?.creation || info?.createdAt || info?.creationTime);

      const restrict = typeof info?.restrict === "boolean" ? (info.restrict ? "✅ Yes" : "❌ No") : "Unknown";

      const announce = typeof info?.announce === "boolean" ? (info.announce ? "✅ Yes" : "❌ No") : "Unknown";

      // Try to fetch group profile picture if we have jid

      let ppUrl = null;

      if (jid) {

        try {

          ppUrl = await sock.profilePictureUrl(jid, "image");

        } catch {

          ppUrl = null;

        }

      }

      const caption =

        `🔎 *Group Info*\n\n` +

        `🏷️ *Name:* ${name}\n` +

        `📝 *Description:* ${desc}\n` +

        `👥 *Members:* ${size}\n` +

        `📅 *Created:* ${created}\n` +

        `🔒 *Restrict (admins only edit):* ${restrict}\n` +

        `📢 *Announce (admins only chat):* ${announce}\n` +

        `🆔 *Group JID:* ${jid || "Unknown"}\n` +

        `🔗 *Invite Code:* ${code}`;

      // Send with profile pic if available, otherwise text

      if (ppUrl) {

        return sock.sendMessage(

          from,

          {

            image: { url: ppUrl },

            caption,

          },

          { quoted: m }

        );

      }

      return sock.sendMessage(from, { text: caption }, { quoted: m });

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(

        from,

        {

          text:

            "❌ Failed to fetch group info.\n" +

            "Make sure the invite link/code is valid and not expired.\n\n" +

            `Error: ${msg}`,

        },

        { quoted: m }

      );

    }

  },

};