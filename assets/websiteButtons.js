// assets/tb6Buttons.js (ESM)
// Reusable Native Flow sender using the EXACT tb6 structure (buttons + additionalNodes).
// Use: await sendTb6Buttons(sock, m, from)

export async function sendWebsiteButtons(sock, m, from) {
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

  // ✅ EXACT tb6 relayMessage payload (unchanged)
  return sock.relayMessage(
    from,
    {
      interactiveMessage: {
        body: {
          text: `\n\nHey @${mentionTag} 👋`,
        },
        footer: {
          text: "> *BMEDIA-MD*",
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
                url: "http://bmediaeshop.netlify.app",
                merchant_url: "http://bmediaeshop.netlify.app",
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
