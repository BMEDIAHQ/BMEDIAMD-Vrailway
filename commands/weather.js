// commands/weather.js (ESM)

// Fetch weather and show a compact summary (no API key).

// Uses wttr.in JSON endpoint.

//

// Usage:

//   <prefix>weather Douala

//   <prefix>weather "New York"

//

// Notes:

// - If wttr.in is blocked on your host, it will fail with a fetch error.

const UA =

  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function toQuery(args) {

  const q = String((args || []).join(" ") || "").trim();

  return q;

}

function pick(arr, idx, fallback = "") {

  return Array.isArray(arr) && arr[idx] != null ? arr[idx] : fallback;

}

function fmtWind(kmph, dir) {

  const s = `${kmph || "?"} km/h`;

  return dir ? `${s} ${dir}` : s;

}

async function fetchJson(url, ms = 12000) {

  const controller = new AbortController();

  const t = setTimeout(() => controller.abort(), ms);

  try {

    const res = await fetch(url, {

      headers: { "user-agent": UA, accept: "application/json" },

      signal: controller.signal,

    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return await res.json();

  } finally {

    clearTimeout(t);

  }

}

export default {

  name: "weather",

  aliases: ["wthr", "meteo"],

  category: "TOOLS",

  description: "Fetch weather for a city (compact summary).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const place = toQuery(args);

    if (!place) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}weather <city>\nExample: ${prefix}weather Douala` },

        { quoted: m }

      );

    }

    // wttr supports spaces; encode everything

    const url = `https://wttr.in/${encodeURIComponent(place)}?format=j1`;

    let data;

    try {

      data = await fetchJson(url);

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(from, { text: `❌ Weather error: ${msg}` }, { quoted: m });

    }

    const area =

      pick(data?.nearest_area, 0)?.areaName?.[0]?.value ||

      pick(data?.nearest_area, 0)?.region?.[0]?.value ||

      place;

    const now = pick(data?.current_condition, 0, {});

    const desc = pick(now?.weatherDesc, 0)?.value || "N/A";

    const tempC = now?.temp_C ?? "N/A";

    const feelsC = now?.FeelsLikeC ?? "N/A";

    const humidity = now?.humidity ?? "N/A";

    const windKmph = now?.windspeedKmph ?? "N/A";

    const windDir = now?.winddir16Point || "";

    const today = pick(data?.weather, 0, {});

    const maxC = today?.maxtempC ?? "N/A";

    const minC = today?.mintempC ?? "N/A";

    // chance of rain (best effort)

    const hourly0 = pick(today?.hourly, 0, {});

    const chanceRain =

      hourly0?.chanceofrain ??

      hourly0?.chanceofRain ??

      "N/A";

    const text =

      `🌦️ Weather — ${area}\n` +

      `• Now: ${tempC}°C (feels ${feelsC}°C) — ${desc}\n` +

      `• Humidity: ${humidity}%\n` +

      `• Wind: ${fmtWind(windKmph, windDir)}\n` +

      `• Today: ${minC}°C – ${maxC}°C\n` +

      `• Chance of rain: ${chanceRain}%`;

    return sock.sendMessage(from, { text }, { quoted: m });

  },

};