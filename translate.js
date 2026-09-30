// commands/translate.js (ESM)

// Translate text (auto-detect source language).

// Usage:

//  <prefix>translate <text>

//  <prefix>translate <target_lang> | <text>

//  Reply a message: <prefix>translate

//  Reply a message: <prefix>translate fr

//

// Examples:

//  .translate Hello my friend

//  .translate fr | Hello my friend

//  .translate es | How are you?

//

// Notes:

// - Uses Google translate public endpoint (no API key).

// - Auto-detects source language.

// - Output shows detected source + target + translation.

function getTextFromMessage(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    m?.message?.documentMessage?.caption ||

    ""

  ).trim();

}

function getQuotedText(m) {

  const q = m?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (!q) return "";

  return (

    q?.conversation ||

    q?.extendedTextMessage?.text ||

    q?.imageMessage?.caption ||

    q?.videoMessage?.caption ||

    q?.documentMessage?.caption ||

    ""

  ).trim();

}

function safeSplitBar(s) {

  const i = s.indexOf("|");

  if (i === -1) return [s.trim(), ""];

  return [s.slice(0, i).trim(), s.slice(i + 1).trim()];

}

async function googleTranslate(text, target = "en") {

  // Unofficial endpoint used by many bots; returns JSON arrays.

  const url =

    "https://translate.googleapis.com/translate_a/single" +

    "?client=gtx&sl=auto&tl=" +

    encodeURIComponent(target) +

    "&dt=t&q=" +

    encodeURIComponent(text);

  const res = await fetch(url, { method: "GET" });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  // data[0] = translated segments

  const translated = Array.isArray(data?.[0])

    ? data[0].map((seg) => seg?.[0]).filter(Boolean).join("")

    : "";

  // data[2] sometimes holds detected source language

  // data[8][0][0] sometimes also holds it depending on response shape

  const detected =

    (typeof data?.[2] === "string" && data[2]) ||

    data?.[8]?.[0]?.[0] ||

    "auto";

  return { translated, detected };

}

export default {

  name: "translate",

  aliases: ["tr", "trans"],

  category: "TOOLS",

  description: "Translate text (auto-detect source language).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const raw = getTextFromMessage(m);

    const afterCmd = raw.split(/\s+/).slice(1).join(" ").trim(); // text after command

    const quoted = getQuotedText(m);

    // Determine input:

    // 1) if reply exists and no args => translate replied text to EN

    // 2) if "lang | text" => lang + text

    // 3) if "lang" only and reply => translate reply to lang

    // 4) else => translate args to EN

    let target = "en";

    let input = "";

    if (!afterCmd) {

      input = quoted;

    } else {

      // support: "fr | hello"

      const [left, right] = safeSplitBar(afterCmd);

      // if there is a bar, left may be lang and right is text

      if (right) {

        const maybeLang = left.toLowerCase();

        target = maybeLang || "en";

        input = right;

      } else {

        // no bar: could be "fr" (and reply exists), or actual text

        const maybeLang = left.toLowerCase();

        if (/^[a-z]{2,3}(-[a-z]{2})?$/i.test(maybeLang) && quoted) {

          target = maybeLang;

          input = quoted;

        } else {

          input = afterCmd;

        }

      }

    }

    if (!input) {

      return sock.sendMessage(

        from,

        {

          text:

            "Reply a message or type text.\n\n" +

            "Examples:\n" +

            "• translate Hello\n" +

            "• translate fr | Hello\n" +

            "• (reply) translate\n" +

            "• (reply) translate fr",

        },

        { quoted: m }

      );

    }

    try {

      const { translated, detected } = await googleTranslate(input, target);

      if (!translated) {

        return sock.sendMessage(from, { text: "❌ Translate: empty result." }, { quoted: m });

      }

      return sock.sendMessage(

        from,

        {

          text:

            `🌍 *Translate*\n\n` +

            `• From: *${detected}*\n` +

            `• To: *${target}*\n\n` +

            `${translated}`,

        },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Translate error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};