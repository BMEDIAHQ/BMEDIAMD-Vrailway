// commands/imagein.js (ESM)
// Sends ONE image (first result from EliteProTech image API) with tb6 native flow buttons under it.
//
// Usage:
//   imagein <query>

import { prepareWAMessageMedia } from "@whiskeysockets/baileys";

export default {
  name: "imagin",
  aliases: [],
  category: "UTILITY",
  description: "Send one API image with native flow buttons under it.",

  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    const query = args.join(" ").trim();
    if (!query) {
      return sock
        .sendMessage(
          from,
          { text: "Usage: imagein <query>\nExample: imagein A boy" },
          { quoted: m }
        )
        .catch(() => {});
    }

    const sender =
      m?.key?.participant ||
      m?.participant ||
      m?.sender ||
      m?.key?.remoteJid ||
      "";

    const mentionJid = m?.sender || sender || "";
    const mentionTag = String(mentionJid).includes("@")
      ? String(mentionJid).split("@")[0]
      : "";

    const apiUrl =
      "https://eliteprotech-apis.zone.id/image?q=" + encodeURIComponent(query);

    try {
      // fetch first image url
      const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json().catch(() => null);
      if (!data || data.status !== true || !Array.isArray(data.images)) {
        throw new Error(data?.message || "Invalid API response.");
      }

      const images = data.images.filter(Boolean);
      if (!images.length) throw new Error("No images found.");

      const imgUrl = images[0];

      // download image as buffer
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);
      const arrBuf = await imgRes.arrayBuffer();
      const imgBuffer = Buffer.from(arrBuf);

      // Build an imageMessage for the interactive header
      const media = await prepareWAMessageMedia(
        { image: imgBuffer },
        { upload: sock.waUploadToServer }
      );

      const imageMessage = media?.imageMessage;
      if (!imageMessage) throw new Error("Failed to prepare image message.");

      await sock.relayMessage(
        from,
        {
          interactiveMessage: {
            // ✅ image on top
            header: {
              hasMediaAttachment: true,
              imageMessage,
            },

            // ✅ keep body text (small)
            body: {
              text: `\n\nHey @${mentionTag} 👋`,
            },

            footer: {
              text: "BMEDIA SAYS 关注该频道",
            },

            // ✅ DO NOT CHANGE ANYTHING ON BUTTON CODE (copied as-is)
            nativeFlowMessage: {
              messageVersion: 3,
              buttons: [
                {
                  name: "review_and_pay",
                  buttonParamsJson: JSON.stringify({
                    type: "physical-goods",
                    additional_note: "",
                    payment_settings: [
                      {
                        type: "pix_static_code",
                        pix_static_code: {
                          key: "email@example.com",
                          key_type: "EMAIL",
                          merchant_name: "Merchant Name",
                        },
                      },
                      {
                        type: "cards",
                        cards: { enabled: false },
                      },
                    ],
                    reference_id: "PCG0IGM3V08Y",
                    currency: "BRL",
                    referral: "chat_attachment",
                    total_amount: { offset: 1, value: 99999 },
                  }),
                },
                {
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: "Follow Channel",
                    url: "https://whatsapp.com/channel/0029Vb4y4trHVvTbIjozUD45",
                    merchant_url: "https://whatsapp.com/channel/0029Vb4y4trHVvTbIjozUD45",
                  }),
                },
              ],
            },

            contextInfo: {
              mentionedJid: mentionJid ? [mentionJid] : [],
            },
          },
        },
        {
          messageId: `BMEDIA_${Date.now()}`,
          additionalNodes: [
            {
              tag: "biz",
              attrs: {},
              content: [
                {
                  tag: "interactive",
                  attrs: { type: "native_flow", v: "1" },
                  content: [{ tag: "native_flow", attrs: { name: "order_details" } }],
                },
              ],
            },
          ],
        }
      );

      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
    } catch (e) {
      await sock
        .sendMessage(
          from,
          { text: `❌ imagein failed.\nReason: ${e?.message || "unknown error"}` },
          { quoted: m }
        )
        .catch(() => {});
    }
  },
};
