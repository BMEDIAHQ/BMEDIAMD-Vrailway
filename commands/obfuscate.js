// commands/obfuscate.js (ESM)

// Usage:

//   obfuscate <level> <code...>

//   obfuscate <code...>            (defaults to low)

//   (reply to a message) obfuscate <level>

//

// Example:

//   !obfuscate low console.log('Hello world')

export default {

  name: "obfuscate",

  aliases: ["obf", "jsobf"],

  category: "UTILITIES",

  description: "Obfuscate JavaScript code using DavidCyril API.",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const API = "https://apis.davidcyril.name.ng/obfuscate";

    const levels = new Set(["low", "medium", "high"]);

    // -------- helpers --------

    const safeSendText = async (text) =>

      sock.sendMessage(from, { text }, { quoted: m }).catch(() => {});

    const getQuotedText = () => {

      const q = m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!q) return "";

      return (

        q.conversation ||

        q.extendedTextMessage?.text ||

        q.imageMessage?.caption ||

        q.videoMessage?.caption ||

        q.documentMessage?.caption ||

        ""

      );

    };

    // -------- parse input --------

    let level = "low";

    let code = "";

    const first = (args[0] || "").toLowerCase().trim();

    if (levels.has(first)) {

      level = first;

      code = args.slice(1).join(" ").trim();

    } else {

      code = args.join(" ").trim();

    }

    // If no inline code, try quoted message text

    if (!code) {

      code = getQuotedText().trim();

    }

    if (!code) {

      return safeSendText(

        "Usage:\n" +

          "• obfuscate <low|medium|high> <code>\n" +

          "• Reply to a code message then: obfuscate <level>\n\n" +

          "Example:\nobfuscate low console.log('Hello');"

      );

    }

    // prevent insane input sizes (keeps URL from exploding)

    if (code.length > 8000) {

      return safeSendText("❌ Code too long. Please keep it under ~8000 characters or send a smaller snippet.");

    }

    const url = `${API}?code=${encodeURIComponent(code)}&level=${encodeURIComponent(level)}`;

    try {

      await sock.sendMessage(from, { react: { text: "🧩", key: m.key } }).catch(() => {});

      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });

      if (!res.ok) {

        const t = await res.text().catch(() => "");

        throw new Error(`API error ${res.status}: ${t || res.statusText}`);

      }

      const data = await res.json().catch(() => null);

      if (!data || data.success !== true) {

        throw new Error("API returned an invalid response.");

      }

      const obfCode = data?.result?.obfuscated_code?.code;

      const originalUrl = data?.result?.original_code;

      if (!obfCode || typeof obfCode !== "string") {

        throw new Error("No obfuscated code returned by API.");

      }

      // Build a file buffer (best for long output)

      const buf = Buffer.from(obfCode, "utf8");

      const fileName = `obfuscated_${level}_${Date.now()}.js`;

      // Caption preview (keep short)

      const preview = obfCode.slice(0, 500);

      const caption =

        `✅ JS Obfuscated (${level})\n` +

        `📦 Output: ${fileName}\n` +

        `🧾 Preview:\n${preview}${obfCode.length > 500 ? "\n…(truncated)" : ""}`;

      await sock.sendMessage(

        from,

        {

          document: buf,

          mimetype: "application/javascript",

          fileName,

          caption,

        },

        { quoted: m }

      );

      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});

    } catch (e) {

      await safeSendText(`❌ Obfuscation failed.\nReason: ${e?.message || "unknown error"}`);

    }

  },

};