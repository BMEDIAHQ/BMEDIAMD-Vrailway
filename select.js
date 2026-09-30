// commands/selectionbtn.js

// Native Flow "selection menu" (single_select) with 4 options

// ✅ Uses the SAME tb6 trick: dummy review_and_pay first (forces buttons to appear)

//

// Usage: <prefix>tb2

//

// NOTE: When a user selects an option, WhatsApp will send back an interactive response message

// (nativeFlowResponseMessage) containing the selected row "id". You can handle that in your main message loop.

export default {

  name: "selectbtn",

  aliases: ["select", "stb"],

  category: "TEST BUTTONS",

  description: "Send a selection menu (4 options).",

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

      ? String(mentionJid).split("@")[0].split(":")[0]

      : "";

    const menuTitle = "Choose an option";

    const rows = [

      { id: "TB2_OPT_1", title: "Open Website", description: "Visit BMEDIA Eshop" },

      { id: "TB2_OPT_2", title: "Copy Link", description: "Copy website link" },

      { id: "TB2_OPT_3", title: "Support", description: "Get help / contact support" },

      { id: "TB2_OPT_4", title: "About", description: "Bot & info" },

    ];

    await sock.relayMessage(

      from,

      {

        interactiveMessage: {

          body: {

            text: `🧩 Selection Menu (4 options)\n\nHey @${mentionTag}\nTap “${menuTitle}” to pick one 👇`,

          },

          footer: {

            text: "| POWERED BY BMEDIA-TECH©",

          },

          nativeFlowMessage: {

            messageVersion: 3,

            buttons: [

              // ✅ Dummy review_and_pay (tb6 trick to force buttons to appear)

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

              // ✅ Selection menu button (single_select)

              {

                name: "single_select",

                buttonParamsJson: JSON.stringify({

                  title: menuTitle,

                  sections: [

                    {

                      title: "BMEDIA Menu",

                      highlight_label: "",

                      rows,

                    },

                  ],

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