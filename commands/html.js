import { randomBytes, randomUUID } from "node:crypto";

const WEBUI_PRIMITIVE_TYPENAME = "GenAIaeacdsnwHtmlPrimitive";
const DEFAULT_BOT_JID = "867051314767696@bot";
const DEFAULT_FORWARD_ORIGIN = "META_AI";
const MAX_HTML_BYTES = 64 * 1024;

function getQuotedText(m) {
  const q = m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!q) return "";
  return String(
    q.conversation ||
    q.extendedTextMessage?.text ||
    q.imageMessage?.caption ||
    q.videoMessage?.caption ||
    ""
  );
}

function getHtml(ctx) {
  const direct = String(ctx?.args?.join?.(" ") || "").trim();
  if (direct) return direct;
  return getQuotedText(ctx?.m).trim();
}

function generateMessageId() {
  return "3EB0" + randomBytes(18).toString("hex").toUpperCase();
}

function buildInlineHtmlMessage(html, title = "BMEDIA HTML") {
  const responseId = randomUUID();
  const unifiedResponse = {
    response_id: responseId,
    sections: [
      {
        view_model: {
          primitive: {
            __typename: WEBUI_PRIMITIVE_TYPENAME,
            payload: html,
            trusted_sources: []
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      }
    ]
  };

  // WhatsApp's Rich Response field carries this JSON as base64.
  const data = Buffer.from(JSON.stringify(unifiedResponse), "utf8").toString("base64");

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        botResponseId: responseId
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: "AI_RICH_RESPONSE_TYPE_STANDARD",
          submessages: [
            {
              messageType: "AI_RICH_RESPONSE_TEXT",
              messageText: title
            }
          ],
          unifiedResponse: { data },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: DEFAULT_BOT_JID
            },
            forwardOrigin: DEFAULT_FORWARD_ORIGIN
          }
        }
      }
    }
  };
}

export default {
  name: "html",
  aliases: ["renderhtml", "webui", "inlinehtml"],
  category: "TOOLS",
  description: "Render HTML/CSS/JS directly inside a supported WhatsApp chat bubble.",

  async execute(ctx) {
    const { sock, m, from } = ctx;
    const html = getHtml(ctx);

    if (!html) {
      return sock.sendMessage(
        from,
        {
          text:
            `Usage:\n` +
            `${ctx?.prefix || "."}html <html code>\n\n` +
            `Or reply to a text containing HTML with ${ctx?.prefix || "."}html`
        },
        { quoted: m }
      );
    }

    const size = Buffer.byteLength(html, "utf8");
    if (size > MAX_HTML_BYTES) {
      return sock.sendMessage(
        from,
        { text: `❌ HTML is too large (${Math.ceil(size / 1024)} KB). Maximum: 64 KB.` },
        { quoted: m }
      );
    }

    try {
      const message = buildInlineHtmlMessage(html);
      const messageId = generateMessageId();
      await sock.relayMessage(from, message, { messageId });
    } catch (error) {
      console.error("[html] inline WebUI failed:", error);
      await sock.sendMessage(
        from,
        {
          text:
            `❌ Inline HTML failed: ${String(error?.message || error)}\n\n` +
            `This WhatsApp Rich WebUI feature is experimental and client-version dependent.`
        },
        { quoted: m }
      );
    }
  }
};
