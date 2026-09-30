import { generateWAMessageContent } from "@whiskeysockets/baileys";

export default {

  name: "tb5",

  aliases: ["carousel", "cards"],

  category: "TOOLS",

  description: "Send a carousel with 4 cards and buttons.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const imageUrl =

      "https://i.pinimg.com/736x/fe/08/f4/fe08f40c86752505a2d3bd106860c9df.jpg";

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

    const { imageMessage } = await generateWAMessageContent(

      { image: { url: imageUrl } },

      { upload: sock.waUploadToServer }

    );

    const makeCard = (n, link) => ({

      header: {

        hasMediaAttachment: true,

        imageMessage,

      },

      body: {

        text: `📸 Image ${n}\n\nHey @${mentionTag}`,

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

              url: link,

              merchant_url: link,

            }),

          },

          {

            name: "cta_copy",

            buttonParamsJson: JSON.stringify({

              display_text: "Copy Image URL",

              copy_code: link,

            }),

          },

        ],

      },

    });

    const cards = [

      makeCard(1, imageUrl),

      makeCard(2, imageUrl),

      makeCard(3, imageUrl),

      makeCard(4, imageUrl),

    ];

    await sock.relayMessage(

      from,

      {

        viewOnceMessage: {

          message: {

            interactiveMessage: {

              body: {

                text: `🖼️ Image Results\n\nHey @${mentionTag}`,

              },

              footer: {

                text: "Swipe to view more cards",

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

      react: { text: "✅", key: m.key },

    }).catch(() => {});

  },

};