// commands/openshop.js (ESM)

// Opens your site inside WhatsApp webview with image header

// Usage: <prefix>openwebview
import { generateWAMessageContent } from "@whiskeysockets/baileys";

export default {

  name: "shopnow",

  aliases: ["openshop", "sn"],

  category: "TEST BUTTONS",

  description: "Open BMEDIA Eshop inside WhatsApp webview.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const webUrl = "https://bmediaeshop.netlify.app";
    const imageUrl = "https://eliteprotech-url.zone.id/177223198907336lzdr.jpg";
      
const { imageMessage } = await generateWAMessageContent(

  { image: { url: imageUrl } },

  { upload: sock.waUploadToServer }

);
      

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

    await sock.relayMessage(

      from,

      {

        interactiveMessage: {

         header: {

  hasMediaAttachment: true,

  imageMessage,

},

          body: {

            text: `🌐 Click the button below to open the webview.\n\nHey @${mentionTag}`,

          },

          footer: {

            text: "| POWERED BY BMEDIA",

          },

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

                        key: "noreply@bmediaeshop.com",

                        key_type: "EMAIL",

                        merchant_name: "BMEDIA",

                      },

                    },

                    {

                      type: "cards",

                      cards: { enabled: false },

                    },

                  ],

                  reference_id: "BMEDIA_" + Date.now(),

                  currency: "BRL",

                  referral: "chat_attachment",

                  total_amount: { offset: 1, value: 100 },

                }),

              },

              {

                name: "open_webview",

                buttonParamsJson: JSON.stringify({

                  title: "Open Bmedia Eshop",

                  link: {

                    in_app_webview: true,

                    url: webUrl,

                  },

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

  },

};