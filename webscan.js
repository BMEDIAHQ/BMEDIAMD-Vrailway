// commands/webscan.js (ESM)

// Usage:

//   <prefix>webscan <url>

// Example:

//   !webscan https://example.com

//

// Extracts:

// - Online/offline (HTTP status)

// - Final URL (after redirects)

// - Page title

// - Meta description

// - OpenGraph title/description/image/site_name

// - Hosting/server headers (server, x-powered-by, via, cf-ray, etc.)

// - Content-Type, Content-Length

// - IP (best-effort via DNS if available)

import dns from "dns/promises";

const UA =

  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function isLikelyUrl(s) {

  return /^https?:\/\//i.test(s) || /^[a-z0-9.-]+\.[a-z]{2,}([/:?#]|$)/i.test(s);

}

function normalizeUrl(input) {

  let s = String(input || "").trim();

  if (!s) return null;

  if (!isLikelyUrl(s)) return null;

  if (!/^https?:\/\//i.test(s)) s = "https://" + s;

  try {

    return new URL(s);

  } catch {

    return null;

  }

}

function firstMatch(re, html) {

  const m = re.exec(html);

  return m?.[1]?.trim() || "";

}

function decodeHtmlEntities(str) {

  return String(str || "")

    .replace(/&amp;/g, "&")

    .replace(/&quot;/g, '"')

    .replace(/&#39;/g, "'")

    .replace(/&lt;/g, "<")

    .replace(/&gt;/g, ">")

    .replace(/&#x2F;/g, "/")

    .replace(/&#x60;/g, "`")

    .replace(/&#x3D;/g, "=");

}

function extractMeta(html) {

  const title =

    decodeHtmlEntities(

      firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html)

    ) || "";

  // meta description

  const desc =

    decodeHtmlEntities(

      firstMatch(

        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,

        html

      )

    ) || "";

  // OpenGraph

  const ogTitle =

    decodeHtmlEntities(

      firstMatch(

        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i,

        html

      )

    ) || "";

  const ogDesc =

    decodeHtmlEntities(

      firstMatch(

        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i,

        html

      )

    ) || "";

  const ogImage =

    decodeHtmlEntities(

      firstMatch(

        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["'][^>]*>/i,

        html

      )

    ) || "";

  const ogSite =

    decodeHtmlEntities(

      firstMatch(

        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["'][^>]*>/i,

        html

      )

    ) || "";

  // twitter cards (optional)

  const twTitle =

    decodeHtmlEntities(

      firstMatch(

        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["'][^>]*>/i,

        html

      )

    ) || "";

  const twDesc =

    decodeHtmlEntities(

      firstMatch(

        /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']*)["'][^>]*>/i,

        html

      )

    ) || "";

  return {

    title,

    description: desc,

    ogTitle,

    ogDescription: ogDesc,

    ogImage,

    ogSiteName: ogSite,

    twitterTitle: twTitle,

    twitterDescription: twDesc,

  };

}

function pickHeader(headers, name) {

  return headers.get(name) || "";

}

function buildServerFingerprint(headers) {

  const server = pickHeader(headers, "server");

  const powered = pickHeader(headers, "x-powered-by");

  const via = pickHeader(headers, "via");

  const cfRay = pickHeader(headers, "cf-ray");

  const cfCache = pickHeader(headers, "cf-cache-status");

  const akamai = pickHeader(headers, "akamai-cache-status") || pickHeader(headers, "x-akamai-transformed");

  const varnish = pickHeader(headers, "x-varnish");

  const nginx = server.toLowerCase().includes("nginx") ? "nginx" : "";

  const bits = [];

  if (server) bits.push(`server: ${server}`);

  if (powered) bits.push(`x-powered-by: ${powered}`);

  if (via) bits.push(`via: ${via}`);

  if (cfRay || cfCache) bits.push(`cloudflare: ${[cfCache, cfRay].filter(Boolean).join(" | ")}`);

  if (akamai) bits.push(`akamai: ${akamai}`);

  if (varnish) bits.push(`varnish: ${varnish}`);

  if (nginx && !server) bits.push(`nginx detected`);

  return bits.join("\n") || "N/A";

}

async function fetchWithTimeout(url, ms = 12000) {

  const controller = new AbortController();

  const t = setTimeout(() => controller.abort(), ms);

  try {

    const res = await fetch(url, {

      method: "GET",

      redirect: "follow",

      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },

      signal: controller.signal,

    });

    return res;

  } finally {

    clearTimeout(t);

  }

}

export default {

  name: "webscan",

  aliases: ["scanweb", "meta", "siteinfo"],

  category: "TOOLS",

  description: "Scan a URL and extract metadata (title/description/server/status).",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const input = (args || []).join(" ").trim();

    const u = normalizeUrl(input);

    if (!u) {

      return sock.sendMessage(

        from,

        { text: "Usage: webscan <link>\nExample: webscan https://example.com" },

        { quoted: m }

      );

    }

    const host = u.hostname;

    let ip = "";

    try {

      const r = await dns.lookup(host);

      ip = r?.address || "";

    } catch {

      ip = "";

    }

    let res;

    try {

      res = await fetchWithTimeout(u.toString(), 12000);

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(

        from,

        {

          text:

            `🌐 WebScan\n` +

            `• URL: ${u.toString()}\n` +

            `• Online: ❌ OFFLINE\n` +

            `• Reason: ${msg}`,

        },

        { quoted: m }

      );

    }

    const status = res.status;

    const ok = res.ok;

    const finalUrl = res.url || u.toString();

    const contentType = pickHeader(res.headers, "content-type");

    const contentLen = pickHeader(res.headers, "content-length");

    const serverInfo = buildServerFingerprint(res.headers);

    let html = "";

    let meta = {

      title: "",

      description: "",

      ogTitle: "",

      ogDescription: "",

      ogImage: "",

      ogSiteName: "",

      twitterTitle: "",

      twitterDescription: "",

    };

    // Only attempt HTML parsing if it's HTML-ish

    const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType || "");

    if (isHtml) {

      try {

        // Limit read to avoid huge pages

        const text = await res.text();

        html = text.slice(0, 500_000);

        meta = extractMeta(html);

      } catch {

        // ignore

      }

    }

    const lines = [];

    lines.push("🌐 WebScan");

    lines.push(`• URL: ${u.toString()}`);

    lines.push(`• Final: ${finalUrl}`);

    lines.push(`• Online: ${ok ? "✅ ONLINE" : "⚠️ REACHED (non-2xx)"}`);

    lines.push(`• Status: ${status}`);

    if (ip) lines.push(`• IP: ${ip}`);

    lines.push(`• Content-Type: ${contentType || "N/A"}`);

    if (contentLen) lines.push(`• Content-Length: ${contentLen}`);

    // Metadata

    const title = meta.ogTitle || meta.twitterTitle || meta.title;

    const desc = meta.ogDescription || meta.twitterDescription || meta.description;

    lines.push("");

    lines.push("🧾 Metadata");

    lines.push(`• Title: ${title || "N/A"}`);

    lines.push(`• Description: ${desc || "N/A"}`);

    if (meta.ogSiteName) lines.push(`• Site name: ${meta.ogSiteName}`);

    if (meta.ogImage) lines.push(`• OG image: ${meta.ogImage}`);

    lines.push("");

    lines.push("🛰️ Hosting / Server");

    lines.push(serverInfo);

    return sock.sendMessage(from, { text: lines.join("\n") }, { quoted: m });

  },

};