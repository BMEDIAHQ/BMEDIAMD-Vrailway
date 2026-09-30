// commands/tb3.js

export default {

  name: "call",

  aliases: ["callbtn"],

  category: "TEST BUTTONS",

  description: "Send a message with a call button.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    // put the number you want the dialer to open

    // use digits only, with country code

    const phoneNumber = "237679261475";

    const buttonText = "Call Now";

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

          body: {

            text: `📞 Click the button below to open your dialer!\n\nHey @${mentionTag}`,

          },

          footer: {

            text: "| POWERED BY BMEDIA-TECH©",

          },

          nativeFlowMessage: {

            messageVersion: 3,

            buttons: [

              // dummy button trick

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

                    { type: "cards", cards: { enabled: false } },

                  ],

                  reference_id: "BMEDIA_" + Date.now(),

                  currency: "BRL",

                  referral: "chat_attachment",

                  total_amount: { offset: 1, value: 100 },

                }),

              },

              // actual call button

              {

                name: "cta_call",

                buttonParamsJson: JSON.stringify({

                  display_text: buttonText,

                  phone_number: phoneNumber,

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