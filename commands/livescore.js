// commands/livescore.js
// LiveScore via PrinceTech API
// Endpoint: https://api.princetechn.com/api/football/livescore?apikey=prince
//
// Behavior update:
// - `LiveScore` (no number) => show ALL matches in ONE message (best effort; auto-truncates if too long)
// - `LiveScore 10` => show 10 matches (max = total matches)

async function fetchJson(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "BMEDIA-MD/LiveScore",
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

function formatMatch(m) {
  const home = String(m?.homeTeam || "Home").trim();
  const away = String(m?.awayTeam || "Away").trim();
  const hs = String(m?.homeScore ?? "-").trim();
  const as = String(m?.awayScore ?? "-").trim();

  const league = String(m?.league || "").trim();
  const status = String(m?.status || "").trim();
  const minute = String(m?.minute || "").trim();
  const ht = String(m?.halfTimeScore || "").trim();
  const date = String(m?.date || "").trim();
  const time = String(m?.time || "").trim();

  const scoreLine = `*${home}*  ${hs} - ${as}  *${away}*`;

  const metaBits = [
    league ? `🏆 ${league}` : "",
    status ? `📌 ${status}` : "",
    minute && minute !== "0" ? `⏱️ ${minute}'` : "",
    (date || time) ? `🗓️ ${[date, time].filter(Boolean).join(" ")}` : "",
    ht ? `🕒 HT: ${ht}` : "",
  ].filter(Boolean);

  return `⚽ ${scoreLine}\n${metaBits.join(" | ")}`;
}

// WhatsApp/Baileys can reject very large messages.
// Keep ONE message by truncating if it exceeds this size.
const MAX_TEXT_LEN = 60000;

function buildMessage({ sport, total, shown, matches }) {
  const header =
    `📺 *LiveScore* (${sport})\n` +
    `📊 Total matches: *${total}*\n` +
    `📌 Showing: *${shown}*\n` +
    `──────────────`;

  let body = matches
    .map((mm, idx) => `\n*${idx + 1}.* ${formatMatch(mm)}`)
    .join("\n");

  let text = `${header}${body}`;

  if (text.length > MAX_TEXT_LEN) {
    text =
      text.slice(0, MAX_TEXT_LEN - 120) +
      `\n\n⚠️ Output truncated. Use: *LiveScore 50* (or any number) to reduce.`;
  }

  return text;
}

export default {
  name: "livescore",
  aliases: ["LiveScore", "live", "score", "scores", "footballlive"],
  category: "SPORTS",
  description: "Get live football scores.",
  usage: "LiveScore [number]",

  async execute(ctx) {
    const { sock, m, from, args } = ctx;

    const limitRaw = String(args?.[0] || "").trim();
    let limit = limitRaw ? parseInt(limitRaw, 10) : NaN;

    try {
      const endpoint = "https://api.princetechn.com/api/football/livescore?apikey=prince";
      const data = await fetchJson(endpoint);

      if (!data?.success || data?.status !== 200 || !data?.result?.matches) {
        throw new Error("Failed to fetch live scores.");
      }

      const sport = String(data?.result?.sport || "Football").trim();
      const total = Number(data?.result?.totalMatches || 0);
      const matches = Array.isArray(data?.result?.matches) ? data.result.matches : [];

      if (!matches.length) {
        return sock.sendMessage(from, { text: "📭 No live matches found right now." }, { quoted: m });
      }

      // If no number provided => show ALL matches
      if (!Number.isFinite(limit) || limit <= 0) {
        limit = matches.length;
      }

      if (limit > matches.length) limit = matches.length;

      const slice = matches.slice(0, limit);
      const text = buildMessage({ sport, total, shown: slice.length, matches: slice });

      return sock.sendMessage(from, { text }, { quoted: m });
    } catch (e) {
      return sock.sendMessage(from, { text: `❌ ${e?.message || e}` }, { quoted: m });
    }
  },
};
