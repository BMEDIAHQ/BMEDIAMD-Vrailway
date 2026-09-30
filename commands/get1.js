// commands/get1.js (ESM)

// Usage: get1 https://example.com

// Downloads a website as ZIP using eliteprotech webcopier API and sends the ZIP back.

export default {

  name: "webclone",

  aliases: ["get", "cloneweb"],

  category: "TOOLS",

  description: "Download a website as a ZIP file (web copier).",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const rawUrl = (args && args.length) ? args.join(" ").trim() : "";

    if (!rawUrl) {

      return sock.sendMessage(from, { text: "Usage:\nget1 https://example.com" }, { quoted: m });

    }

    // Normalize URL

    let url = rawUrl.replace(/^<|>$/g, "").trim();

    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    // Basic validation

    try {

      // eslint-disable-next-line no-new

      new URL(url);

    } catch {

      return sock.sendMessage(from, { text: "❌ Invalid URL.\nExample: get1 https://google.com" }, { quoted: m });

    }

    const api = `https://eliteprotech-apis.zone.id/webcopier?url=${encodeURIComponent(url)}`;

    try {

      await sock.sendMessage(from, { react: { text: "📦", key: m.key } }).catch(() => {});

      // 1) Call copier endpoint

      const r = await fetch(api, { headers: { Accept: "application/json" } });

      if (!r.ok) {

        const t = await r.text().catch(() => "");

        throw new Error(`API error ${r.status}: ${t || r.statusText}`);

      }

      const data = await r.json().catch(() => null);

      if (!data || data.success !== true || !data.download) {

        throw new Error("Unexpected API response (missing download link).");

      }

      const downloadUrl = String(data.download).trim();

      const originalUrl = String(data.original_url || url).trim();

      // 2) Download zip bytes

      const z = await fetch(downloadUrl);

      if (!z.ok) {

        const t = await z.text().catch(() => "");

        throw new Error(`ZIP download failed ${z.status}: ${t || z.statusText}`);

      }

      const zipBuf = Buffer.from(await z.arrayBuffer());

      // 3) Choose a filename

      const host = (() => {

        try { return new URL(originalUrl).hostname.replace(/[^a-z0-9.-]/gi, "_"); }

        catch { return "website"; }

      })();

      const filename = `${host}.zip`;

      // 4) Send as document (ZIP should be document)

      await sock.sendMessage(

        from,

        {

          document: zipBuf,

          mimetype: data.mime || "application/zip",

          fileName: filename,

          caption: `✅ Website copied.\n🌐 URL: ${originalUrl}`,

        },

        { quoted: m }

      );

      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});

    } catch (e) {

      await sock.sendMessage(

        from,

        { text: `❌ Failed.\nReason: ${e?.message || "unknown error"}` },

        { quoted: m }

      ).catch(() => {});

    }

  },

};