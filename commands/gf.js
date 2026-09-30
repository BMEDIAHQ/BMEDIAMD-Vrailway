// commands/gf.js (ESM)
// Reply to a photo with .gf to add a realistic girlfriend.

import {
  box,
  createPartnerImage
} from "../utils/cloudflarePartnerEdit.js";

export default {
  name: "gf",
  aliases: ["girlfriend"],
  category: "AI",
  description: "Add a realistic matching girlfriend beside the person in a replied image.",

  async execute({ sock, m, from }) {
    const quoted =
      m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted?.imageMessage) {
      return sock.sendMessage(
        from,
        {
          text: box("*GF AI*", [
            "Reply to an image with: .gf",
            "The bot will add a matching girlfriend."
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
        partnerType: "girlfriend"
      });

      const sent = await sock.sendMessage(
        from,
        {
          image,
          caption: box("*GF AI*", [
            "Your matching girlfriend has arrived 😄"
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
          text: box("*GF AI ERROR*", [
            String(e?.message || e).slice(0, 700)
          ])
        },
        { quoted: m }
      );
    }
  }
};
