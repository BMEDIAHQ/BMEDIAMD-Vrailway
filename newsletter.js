// commands/newsletter.js (ESM)

// Usage: !newsletter <https://whatsapp.com/channel/XXXX...>  OR  !newsletter <inviteCode>

// Returns newsletter/channel metadata (jid, name, etc.) using Baileys newsletterMetadata().

//

// Requires a Baileys build that includes newsletterMetadata().

// (Many newer forks/builds expose it; see Baileys issues/docs around newsletters.) 3

function extractInviteCode(input) {

  const s = String(input || "").trim();

  // Accept either full link or plain code

  // Typical: https://whatsapp.com/channel/<code>

  // Some links may have extra path segments; we grab the first code-like token after /channel/

  const m = s.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);

  if (m?.[1]) return m[1];

  // fallback: treat as code

  if (/^[A-Za-z0-9_-]{6,}$/i.test(s)) return s;

  return "";

}

export default {

  name: "newsletter",

  aliases: ["channeljid", "channelinfo"],

  category: "TOOLS",

  description: "Get WhatsApp Channel (newsletter) metadata/JID from an invite link or code.",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const input = (args || []).join(" ").trim();

    if (!input) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}newsletter <channel link or invite code>` },

        { quoted: m }

      );

    }

    const code = extractInviteCode(input);

    if (!code) {

      return sock.sendMessage(from, { text: "❌ Invalid channel link or code." }, { quoted: m });

    }

    try {

      if (typeof sock.newsletterMetadata !== "function") {

        return sock.sendMessage(

          from,

          { text: "❌ Your Baileys build doesn't support newsletterMetadata(). Update Baileys." },

          { quoted: m }

        );

      }

      // 'invite' mode resolves invite code → metadata (jid, name, etc.)

      const meta = await sock.newsletterMetadata("invite", code);

      // Meta shape can vary by Baileys version/fork; print safely

      const jid =

        meta?.jid ||

        meta?.id ||

        meta?.newsletterJid ||

        meta?.newsletter?.jid ||

        "Unknown";

      const name =

        meta?.name ||

        meta?.title ||

        meta?.subject ||

        meta?.newsletter?.name ||

        "Unknown";

      const reply =

        `✅ *Channel / Newsletter Info*\n` +

        `*Name:* ${name}\n` +

        `*JID:* ${jid}\n` +

        `*Invite Code:* ${code}`;

      return sock.sendMessage(from, { text: reply }, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Failed: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};