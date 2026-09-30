// commands/image.js (ESM)

import { generateWAMessageContent } from "@whiskeysockets/baileys";

async function fetchJson(url) {

  const res = await fetch(url, {

    method: "GET",

    headers: {

      Accept: "application/json",

      "User-Agent": "Mozilla/5.0",

    },

  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  return res.json();

}

async function fetchImageBuffer(url) {

  const res = await fetch(url, {

    method: "GET",

    headers: {

      Accept: "image/*,*/*;q=0.8",

      "User-Agent": "Mozilla/5.0",

      Referer: url,

    },

  });

  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);

  const ab = await res.arrayBuffer();

  return Buffer.from(ab);

}

export default {

  name: "image",

  aliases: ["imgsearch", "img"],

  category: "UTILITY",

  description: "Search images and display first 5 results in carousel cards.",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const query = args.join(" ").trim();

    if (!query) {

      return sock.sendMessage(

        from,

        { text: "Usage: image <query>\nExample: image nezuko" },

        { quoted: m }

      ).catch(() => {});

    }

    const apiUrl =

      "https://eliteprotech-apis.zone.id/image?q=" + encodeURIComponent(query);

    try {

      await sock.sendMessage(from, {

        react: { text: "🖼️", key: m.key }

      }).catch(() => {});

      const data = await fetchJson(apiUrl);

      if (!data || data.status !== true || !Array.isArray(data.images)) {

        throw new Error(data?.message || "Invalid API response.");

      }

      const total = Number.isFinite(data.count) ? data.count : data.images.length;

      const images = data.images.filter(Boolean);

      if (!images.length) {

        return sock.sendMessage(

          from,

          { text: `❌ No images found for: ${query}` },

          { quoted: m }

        ).catch(() => {});

      }

      const take = Math.min(5, images.length);

      const picked = images.slice(0, take);

      // ✅ SAME BUTTON TAGGING STYLE

      const sender =

        m?.key?.participant ||

        m?.participant ||

        m?.sender ||

        m?.key?.remoteJid ||

        "";

      const mentionJid = m?.sender || sender || "";

      const mentionTag = String(mentionJid).includes("@")

        ? String(mentionJid).split("@")[0].split(":")[0]

        : "";

      const cards = [];

      for (let i = 0; i < picked.length; i++) {

        const url = picked[i];

        let imageMessage;

        try {

          const imgBuffer = await fetchImageBuffer(url);

          const media = await generateWAMessageContent(

            { image: imgBuffer },

            { upload: sock.waUploadToServer }

          );

          imageMessage = media.imageMessage;

        } catch {

          imageMessage = undefined;

        }

        cards.push({

          header: imageMessage

            ? {

                hasMediaAttachment: true,

                imageMessage,

              }

            : {

                hasMediaAttachment: false,

              },

          body: {

            text: `🖼️ Image ${i + 1}`,

          },

          footer: {

            text: "| POWERED BY BMEDIA-TECH©",

          },

          nativeFlowMessage: {

            buttons: [

              {

                name: "cta_url",

                buttonParamsJson: JSON.stringify({

                  display_text: "Open Image",

                  url,

                  merchant_url: url,

                }),

              },

              {

                name: "cta_copy",

                buttonParamsJson: JSON.stringify({

                  display_text: "Copy Image URL",

                  copy_code: url,

                }),

              },

            ],

          },

        });

      }

      await sock.relayMessage(

        from,

        {

          viewOnceMessage: {

            message: {

              interactiveMessage: {

                body: {

                  text:

                    `🖼️ Image Results for: *${query}*\n` +

                    `📁 Showing ${take} of ${total} images\n` +

                    `Swipe to view more cards\n\n` +

                    `Hey @${mentionTag}`,

                },

                footer: {

                  text: "| POWERED BY BMEDIA-TECH©",

                },

                header: {

                  hasMediaAttachment: false,

                },

                carouselMessage: {

                  cards,

                  messageVersion: 1,

                },

                contextInfo: {

                  mentionedJid: mentionJid ? [mentionJid] : [],

                },

              },

            },

          },

        },

        {

          messageId: `BMEDIA_${Date.now()}`,

        }

      );

      await sock.sendMessage(from, {

        react: { text: "✅", key: m.key }

      }).catch(() => {});

    } catch (e) {

      await sock.sendMessage(

        from,

        { text: `❌ Image search failed.\nReason: ${e?.message || "unknown error"}` },

        { quoted: m }

      ).catch(() => {});

    }

  },

};