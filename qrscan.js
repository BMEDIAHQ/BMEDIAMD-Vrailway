// commands/qrscan.js (ESM)

// Scan QR from an image (reply an image with: <prefix>qrscan)

//

// ✅ Works with Jimp v1.x (NO default import)

// ✅ Uses jsqr to decode

//

// Install deps:

// npm i jimp jsqr

//

// Usage:

// .qrscan   (reply to an image)

import { downloadContentFromMessage } from "@whiskeysockets/baileys";

import { Jimp } from "jimp";

import jsQR from "jsqr";

async function streamToBuffer(stream) {

  const chunks = [];

  for await (const c of stream) chunks.push(c);

  return Buffer.concat(chunks);

}

function getQuotedMessage(m) {

  return m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

}

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    m?.message?.documentMessage?.caption ||

    ""

  ).trim();

}

export default {

  name: "qrscan",

  aliases: ["scanqr", "qrr", "readqr"],

  category: "TOOLS",

  description: "Scan QR code from an image (reply to an image).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    // must be reply to an image

    const quoted = getQuotedMessage(m);

    const imgMsg = quoted?.imageMessage;

    if (!imgMsg) {

      return sock.sendMessage(

        from,

        { text: "Reply to an image with: qrscan" },

        { quoted: m }

      );

    }

    try {

      // download image buffer

      const stream = await downloadContentFromMessage(imgMsg, "image");

      const buf = await streamToBuffer(stream);

      // decode with Jimp -> jsQR

      const img = await Jimp.read(buf);

      const { data, width, height } = img.bitmap;

      const result = jsQR(new Uint8ClampedArray(data), width, height);

      const decoded = result?.data ? String(result.data).trim() : "";

      if (!decoded) {

        return sock.sendMessage(

          from,

          { text: "❌ No QR code found in that image." },

          { quoted: m }

        );

      }

      return sock.sendMessage(

        from,

        { text: `✅ QR RESULT:\n${decoded}` },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ QRScan error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};