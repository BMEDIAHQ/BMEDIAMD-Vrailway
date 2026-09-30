// commands/tb6.js (ESM)

export default {

  name: "tb6",

  aliases: [],

  category: "UTILITY",

  description: "Test native flow buttons (only review_and_pay + cta_url).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

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

    await sock.relayMessage(

      from,

      {

        interactiveMessage: {

          body: {

            text: `Testing buttons\n\nHey @${mentionTag} 👋`,

          },

          footer: {

            text: "Sent by BMEDIA",

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

                  display_text: "Visit Website",

                  url: "https://abztech.my.id",

                  merchant_url: "https://abztech.my.id",

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