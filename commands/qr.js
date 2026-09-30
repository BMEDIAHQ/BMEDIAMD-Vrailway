// commands/qr.js (ESM)

// Generate QR code for text/link

// Usage: <prefix>qr <text>

import QRCode from "qrcode";

export default {

  name: "qr",

  aliases: ["qrcode"],

  category: "TOOLS",

  description: "Generate QR code from text/link.",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const input = (args || []).join(" ").trim();

    if (!input) {

      return sock.sendMessage(from, { text: "Usage: qr <text or link>" }, { quoted: m });

    }

    try {

      const dataUrl = await QRCode.toDataURL(input, { errorCorrectionLevel: "M", margin: 1, scale: 8 });

      const base64 = dataUrl.split(",")[1];

      const buf = Buffer.from(base64, "base64");

      return sock.sendMessage(

        from,

        { image: buf, caption: "✅ QR generated." },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(from, { text: `❌ QR error: ${e?.message || e}` }, { quoted: m });

    }

  },

};