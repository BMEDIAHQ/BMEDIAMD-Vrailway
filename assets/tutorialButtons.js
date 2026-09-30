// assets/tutorialButtons.js (ESM)

// Reusable Native Flow sender using the EXACT tb6 structure (buttons + additionalNodes).

// Use: await sendTutorialButtons(sock, m, from)

export async function sendTutorialButtons(sock, m, from) {

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

  // ✅ Change this to your YouTube channel link

  const youtubeUrl = "https://youtube.com/@bmediabotline?si=HArkpBDwSlwmswD1"; // <-- edit

  return sock.relayMessage(

    from,

    {

      interactiveMessage: {

        body: {

          text: `\n\nHey @${mentionTag} 👋\nClick the button below if you need tutorials videos.`,

        },

        footer: {

          text: "> *BMEDIA-MD*",

        },

        nativeFlowMessage: {

          messageVersion: 3,

          buttons: [

            // ✅ IMPORTANT: keep this "order_details" button (tb6-style)

            // Some clients won't render native_flow properly unless there is an order_details-type button present.

            {

              name: "review_and_pay",

              buttonParamsJson: JSON.stringify({

                type: "physical-goods",

                additional_note: "",

                payment_settings: [

                  {

                    type: "pix_static_code",

                    pix_static_code: {

                      key: "bmediabotline2@gmail.com",

                      key_type: "EMAIL",

                      merchant_name: "Merchant Name",

                    },

                  },

                  { type: "cards", cards: { enabled: false } },

                ],

                reference_id: `TUT_${Date.now()}`,

                currency: "BRL",

                referral: "chat_attachment",

                total_amount: { offset: 1, value: 1 },

              }),

            },

            {

              name: "cta_url",

              buttonParamsJson: JSON.stringify({

                display_text: "TUTORIAL",

                url: youtubeUrl,

                merchant_url: youtubeUrl,

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

}