// commands/bf.js (ESM)
// Reply to a photo with .bf to add a realistic boyfriend.

import {
  box,
  createPartnerImage
} from "../utils/cloudflarePartnerEdit.js";

export default {
  name: "bf",
  aliases: ["boyfriend"],
  category: "AI",
  description: "Add a realistic matching boyfriend beside the person in a replied image.",

  async execute({ sock, m, from }) {
    const quoted =
      m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted?.imageMessage) {
      return sock.sendMessage(
        from,
        {
          text: box("*BF AI*", [
            "Reply to an image with: .bf",
            "The bot will add a matching boyfriend."
          ])
        },
        { quoted: m }
      );
    }

    try {
      try {
        await sock.sendMessage(from, {
          react: { text: "💞", key: m.key }
        });
      } catch {}

      const image = await createPartnerImage({
        sock,
        m,
        from,
        partnerType: "boyfriend"
      });

      const sent = await sock.sendMessage(
        from,
        {
          image,
          caption: box("*BF AI*", [
            "Your matching boyfriend has arrived 😄"
          ])
        },
        { quoted: m }
      );

      try {
        await sock.sendMessage(from, {
          react: { text: "✅", key: m.key }
        });
      } catch {}

      return sent;
    } catch (e) {
      try {
        await sock.sendMessage(from, {
          react: { text: "❌", key: m.key }
        });
      } catch {}

      return sock.sendMessage(
        from,
        {
          text: box("*BF AI ERROR*", [
            String(e?.message || e).slice(0, 700)
          ])
        },
        { quoted: m }
      );
    }
  }
};
