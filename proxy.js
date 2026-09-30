// commands/proxy.js
// Proxy list via PrinceTech API
// Endpoint: https://api.princetechn.com/api/tools/proxy?apikey=prince
//
// Usage:
// - proxy            => shows first 20 proxies
// - proxy 50         => shows first 50 (max 100)

import { getStoredPrefix } from "../control/getPrefix.js";

async function fetchJson(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "BMEDIA-MD/Proxy",
      accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `API error: ${res.status} ${res.statusText}${txt ? ` - ${txt.slice(0, 120)}` : ""}`
    );
  }

  return res.json();
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function fmtYesNo(v) {
  const s = safeStr(v).toLowerCase();
  if (!s) return "—";
  if (s === "yes" || s === "true") return "✅";
  if (s === "no" || s === "false") return "❌";
  return s;
}

function splitLongMessage(text, maxLen = 60000) {
  if (!text || text.length <= maxLen) return [text || ""];
  const lines = text.split("\n");
  const out = [];
  let buf = "";

  for (const line of lines) {
    const next = buf ? `${buf}\n${line}` : line;
    if (next.length > maxLen) {
      if (buf) out.push(buf);
      buf = line;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export default {
  name: "proxy",
  aliases: ["proxies", "proxylist"],
  category: "TOOLS",
  description: "Get fresh proxy list.",
  usage: "proxy [count]",
  async execute(ctx) {
    const { sock, m, from, args } = ctx;

    const countRaw = safeStr(args?.[0]);
    let count = parseInt(countRaw, 10);
    if (!Number.isFinite(count) || count <= 0) count = 20;
    if (count > 100) count = 100;

    try {
      const endpoint = "https://api.princetechn.com/api/tools/proxy?apikey=prince";
      const data = await fetchJson(endpoint);

      if (!data?.success || data?.status !== 200 || !Array.isArray(data?.results)) {
        throw new Error("Failed to fetch proxies.");
      }

      const list = data.results;
      if (!list.length) {
        return sock.sendMessage(from, { text: "📭 No proxies found right now." }, { quoted: m });
      }
const prefix = await getStoredPrefix();
      const slice = list.slice(0, count);

      let text =
        `🛡️ *Proxy List*\n` +
        `📦 Total: *${list.length}*\n` +
        `📌 Showing: *${slice.length}*\n` +
`usage: ${prefix}proxy number | default 20\n`+
        `────────────────────────\n`;

      text += slice
        .map((p, i) => {
          const ip = safeStr(p.ip) || "0.0.0.0";
          const port = safeStr(p.port) || "0";
          const country = safeStr(p.country) || "Unknown";
          const code = safeStr(p.code) || "—";
          const anonymity = safeStr(p.anonymity) || "—";
          const https = fmtYesNo(p.https);
          const google = fmtYesNo(p.google);
          const last = safeStr(p.last) || "—";

          return (
            `\n*${i + 1}.* \`${ip}:${port}\`\n` +
            `🌍 ${country} (${code}) | 🕵️ ${anonymity}\n` +
            `🔒 HTTPS: ${https} | 🔎 Google: ${google} | ⏱️ ${last}`
          );
        })
        .join("\n\n");

      const parts = splitLongMessage(text.trim(), 60000);
      for (let i = 0; i < parts.length; i++) {
        await sock.sendMessage(from, { text: parts[i] }, { quoted: i === 0 ? m : undefined });
      }
    } catch (e) {
      return sock.sendMessage(from, { text: `❌ ${e?.message || e}` }, { quoted: m });
    }
  },
};
