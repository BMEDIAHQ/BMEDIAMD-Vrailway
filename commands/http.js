// commands/http.js (ESM)

// HTTP status checker

// Usage:

//   <prefix>http https://example.com

//   <prefix>http example.com

function normalizeUrl(input) {

  let u = String(input || "").trim();

  if (!u) return null;

  // if no scheme, assume https

  if (!/^https?:\/\//i.test(u)) u = "https://" + u;

  // basic URL validation

  try {

    const parsed = new URL(u);

    return parsed.toString();

  } catch {

    return null;

  }

}

function msNow() {

  return Number(process.hrtime.bigint() / 1000000n);

}

export default {

  name: "http",

  aliases: ["status", "check", "urlstatus"],

  category: "TOOLS",

  description: "Check a URL HTTP status (online/offline, status code, server, latency).",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const raw = args?.join(" ") || "";

    const url = normalizeUrl(raw);

    if (!url) {

      return sock.sendMessage(

        from,

        { text: "Usage: http <url>\nExample: http https://google.com" },

        { quoted: m }

      );

    }

    const start = msNow();

    try {

      // Try HEAD first (faster). Some sites block HEAD -> fallback to GET.

      let res;

      try {

        res = await fetch(url, {

          method: "HEAD",

          redirect: "follow",

          // small-ish timeout using AbortController

          signal: AbortSignal.timeout(15000),

        });

      } catch {

        res = await fetch(url, {

          method: "GET",

          redirect: "follow",

          signal: AbortSignal.timeout(15000),

        });

      }

      const end = msNow();

      const ms = end - start;

      const status = res.status;

      const ok = res.ok;

      const finalUrl = res.url || url;

      const contentType = res.headers.get("content-type") || "unknown";

      const server = res.headers.get("server") || "unknown";

      const length = res.headers.get("content-length") || "unknown";

      const text =

        `🌐 *HTTP Status Checker*\n\n` +

        `🔗 URL: ${url}\n` +

        `➡️ Final: ${finalUrl}\n\n` +

        `📡 Status: ${ok ? "✅ ONLINE" : "❌ OFFLINE"}\n` +

        `🔢 Code: ${status} ${res.statusText || ""}\n` +

        `⏱️ Time: ${ms}ms\n` +

        `🧾 Type: ${contentType}\n` +

        `🖥️ Server: ${server}\n` +

        `📦 Length: ${length}`;

      return sock.sendMessage(from, { text }, { quoted: m });

    } catch (e) {

      const end = msNow();

      const ms = end - start;

      return sock.sendMessage(

        from,

        {

          text:

            `🌐 *HTTP Status Checker*\n\n` +

            `🔗 URL: ${url}\n\n` +

            `📡 Status: ❌ OFFLINE\n` +

            `⏱️ Time: ${ms}ms\n` +

            `⚠️ Error: ${String(e?.message || e)}`,

        },

        { quoted: m }

      );

    }

  },

};