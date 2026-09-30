// commands/predictions.js (ESM)

// Updated formatting per request.

// - Shows ALL available predictions (no "Showing x/y" line)

// - Adds BTTS Yes/No percentages

// - Adds predicted winner (home/away/draw based on highest FT %)

// - Adds Over 2.5 Yes/No (kept)

// - Omits "💎 Value Bets: 0" (only shows if > 0)

// - If result exists, shows ✅/❌ correctness vs predicted winner

function toNum(v, fallback = 0) {

  const n = Number(v);

  return Number.isFinite(n) ? n : fallback;

}

function pct(v) {

  return `${toNum(v).toFixed(2)}%`;

}

function fmtTime(s) {

  if (!s) return "--/--";

  const d = new Date(String(s).replace(" ", "T"));

  if (isNaN(d.getTime())) return String(s);

  return d.toLocaleString();

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

      if (line.length > maxLen) {

        for (let i = 0; i < line.length; i += maxLen) out.push(line.slice(i, i + maxLen));

        buf = "";

      } else {

        buf = line;

      }

    } else {

      buf = next;

    }

  }

  if (buf) out.push(buf);

  return out;

}

async function fetchPredictions() {

  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), 20000);

  try {

    const res = await fetch(

      "https://api.princetechn.com/api/football/predictions?apikey=prince",

      {

        method: "GET",

        headers: { accept: "application/json" },

        signal: controller.signal,

      }

    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json().catch(() => null);

    if (!data || data.success !== true || !Array.isArray(data.result)) {

      throw new Error("Invalid API response");

    }

    return data.result;

  } finally {

    clearTimeout(timer);

  }

}

function parseTeams(match) {

  const s = String(match || "").trim();

  if (!s) return { home: "Home", away: "Away" };

  const vs = s.split(/\s+vs\s+/i);

  if (vs.length === 2) return { home: vs[0].trim(), away: vs[1].trim() };

  const v = s.split(/\s+v\s+/i);

  if (v.length === 2) return { home: v[0].trim(), away: v[1].trim() };

  const dash = s.split(/\s*-\s*/);

  if (dash.length === 2) return { home: dash[0].trim(), away: dash[1].trim() };

  return { home: s, away: "Away" };

}

function pickWinner(ft, teams) {

  const homeP = toNum(ft?.home);

  const drawP = toNum(ft?.draw);

  const awayP = toNum(ft?.away);

  let outcome = "draw";

  let prob = drawP;

  if (homeP >= drawP && homeP >= awayP) {

    outcome = "home";

    prob = homeP;

  } else if (awayP >= drawP && awayP >= homeP) {

    outcome = "away";

    prob = awayP;

  }

  const label = outcome === "home" ? teams.home : outcome === "away" ? teams.away : "Draw";

  return { outcome, label, prob };

}

function bttsYesNo(btts) {

  const yes = toNum(btts?.yes);

  const no = Number.isFinite(Number(btts?.no)) ? toNum(btts?.no) : Math.max(0, 100 - yes);

  return { yes, no };

}

function parseActualOutcome(resultText, teams) {

  const t = String(resultText || "").toLowerCase();

  if (!t) return { outcome: "unknown", winner: "" };

  if (t.includes("draw")) return { outcome: "draw", winner: "Draw" };

  const homeL = teams.home.toLowerCase();

  const awayL = teams.away.toLowerCase();

  if (homeL && t.includes(homeL) && t.includes("won")) return { outcome: "home", winner: teams.home };

  if (awayL && t.includes(awayL) && t.includes("won")) return { outcome: "away", winner: teams.away };

  if (t.includes("home") && t.includes("won")) return { outcome: "home", winner: teams.home };

  if (t.includes("away") && t.includes("won")) return { outcome: "away", winner: teams.away };

  return { outcome: "unknown", winner: "" };

}

function formatResultLine(predPick, teams, resultText) {

  const actual = parseActualOutcome(resultText, teams);

  if (actual.outcome === "unknown") {

    return `ℹ️ Result: ${resultText}`;

  }

  const correct = actual.outcome === predPick.outcome;

  if (correct) {

    if (actual.outcome === "draw") return `🟩 *RESULT*: Game ended in draw *CORRECT PREDICTION*`;

    return `🟩 *RESULT*: ${actual.winner} won  *CORRECT PREDICTION*`;

  }

  if (actual.outcome === "draw") return `🟥 *RESULT*: Game ended in draw  *WRONG PREDICTION*`;

  return `🟥 *RESULT*: ${actual.winner} won  *WRONG PREDICTION*`;

}

export default {

  name: "predictions",

  aliases: ["pred", "predict", "footballpred", "predicts"],

  category: "PREMIUM",

  description: "Get latest football predictions feed.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    try {

      const rows = await fetchPredictions();

      if (!rows.length) {

        return sock.sendMessage(from, { text: "❌ No predictions found right now." }, { quoted: m });

      }

      // ADDED: played matches + success rate

      let playedMatches = 0;

      let correctPredictions = 0;

      rows.forEach((item) => {

        if (!item?.result) return;

        const ft = item?.predictions?.fulltime || {};

        const matchStr = item?.match || "--/--";

        const teams = parseTeams(matchStr);

        const pick = pickWinner(ft, teams);

        const actual = parseActualOutcome(item.result, teams);

        if (actual.outcome !== "unknown") {

          playedMatches++;

          if (actual.outcome === pick.outcome) {

            correctPredictions++;

          }

        }

      });

      let text =

        `*TODAY'S ⚽ PREDICTIONS:*\n` +

        `TOTAL: *${rows.length}*\n` +

        `PLAYED: *${playedMatches}* | SUCCESS RATE: *${correctPredictions}/${playedMatches || 0}*\n\n` +

        `SCOURCE: https://bpredict.netlify.app/\n\n`;

      rows.forEach((item, i) => {

        const ft = item?.predictions?.fulltime || {};

        const o25 = item?.predictions?.over_2_5 || {};

        const btts = item?.predictions?.bothTeamToScore || {};

        const matchStr = item?.match || "--/--";

        const teams = parseTeams(matchStr);

        const pick = pickWinner(ft, teams);

        const bttsPct = bttsYesNo(btts);

        text += `*${i + 1}. ${matchStr}*\n`;

        text += `🏆 League: ${item?.league || "--/--"}\n`;

        text += `🕒 Time: ${fmtTime(item?.time)}\n`;

        text += `📊 FT: H ${pct(ft.home)} | D ${pct(ft.draw)} | A ${pct(ft.away)}\n`;

        text += `🏅 *TO WIN*: ${pick.label} (${pick.prob.toFixed(2)}%)\n`;

        text += `🤝 BTTS: Yes ${bttsPct.yes.toFixed(2)}% | No ${bttsPct.no.toFixed(2)}%\n`;

        text += `🥅 Over 2.5: Yes ${pct(o25.yes)} | No ${pct(o25.no)}\n`;

        if (item?.result) {

          text += `${formatResultLine(pick, teams, item.result)}\n`;

        }

        text += `\n\n`;

      });

      const parts = splitLongMessage(text.trim(), 60000);

      for (let i = 0; i < parts.length; i++) {

        await sock.sendMessage(from, { text: parts[i] }, { quoted: i === 0 ? m : undefined });

      }

    } catch (e) {

      const msg = e?.name === "AbortError" ? "Request timed out." : e?.message || String(e);

      return sock.sendMessage(from, { text: `❌ Predictions error: ${msg}` }, { quoted: m });

    }

  },

};