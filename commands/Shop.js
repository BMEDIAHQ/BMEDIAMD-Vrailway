// commands/website.js
export default {
  name: "shop",
  aliases: ["ecommerce"],
  category: "TEST BUTTONS",
  description: "Send a message with a clickable link button.",
  async execute(ctx) {
    const { sock, m, from } = ctx;

    const linkUrl = "https://bmediaeshop.netlify.app";
    const linkText = "Visit Website";

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
            text: `👋 Click the button below to open the link!\n\nHey @${mentionTag}`,
          },
          footer: {
            text: "| POWERED BY BMEDIA-TECH©",
          },
          nativeFlowMessage: {
            messageVersion: 3,
            buttons: [
              // ← This dummy review_and_pay is what forces the buttons to show (tb6 trick)
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
                  total_amount: { offset: 1, value: 100 }, // 1 cent dummy
                }),
              },
              // ← Your actual link button
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: linkText,
                  url: linkUrl,
                  merchant_url: linkUrl,
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