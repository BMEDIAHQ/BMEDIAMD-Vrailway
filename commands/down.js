// commands/down.js (ESM)

// Site Up/Down checker (multi-probe)

// Usage:

//   <prefix>down https://example.com

//   <prefix>down example.com

//

// Result:

// ✅ UP (all probes ok)

// 🟡 DEGRADED (some ok, some failed)

// ❌ DOWN (all failed)

function normalizeBase(input) {

  let u = String(input || "").trim();

  if (!u) return null;

  if (!/^https?:\/\//i.test(u)) u = "https://" + u;

  try {

    const parsed = new URL(u);

    // Keep origin + pathname if they gave a path, but drop query/hash.

    parsed.hash = "";

    parsed.search = "";

    return parsed.toString();

  } catch {

    return null;

  }

}

function msNow() {

  return Number(process.hrtime.bigint() / 1000000n);

}

async function probe(url) {

  const start = msNow();

  try {

    // HEAD first, fallback GET (some servers block HEAD)

    let res;

    try {

      res = await fetch(url, {

        method: "HEAD",

        redirect: "follow",

        signal: AbortSignal.timeout(12000),

      });

    } catch {

      res = await fetch(url, {

        method: "GET",

        redirect: "follow",

        signal: AbortSignal.timeout(12000),

      });

    }

    const ms = msNow() - start;

    return {

      ok: res.ok,

      status: res.status,

      statusText: res.statusText || "",

      finalUrl: res.url || url,

      ms,

      error: null,

    };

  } catch (e) {

    const ms = msNow() - start;

    return {

      ok: false,

      status: 0,

      statusText: "",

      finalUrl: url,

      ms,

      error: String(e?.message || e),

    };

  }

}

export default {

  name: "down",

  aliases: ["isdown", "updown", "site"],

  category: "TOOLS",

  description: "Check if a website is UP/DOWN using multiple probes.",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const raw = args?.join(" ") || "";

    const base = normalizeBase(raw);

    if (!base) {

      return sock.sendMessage(

        from,

        { text: "Usage: down <url>\nExample: down google.com" },

        { quoted: m }

      );

    }

    const origin = new URL(base).origin;

    // Multi-probe endpoints (cheap + common)

    const targets = [

      base, // whatever user provided

      origin + "/", // homepage

      origin + "/robots.txt",

      origin + "/favicon.ico",

    ];

    const results = [];

    for (const t of targets) results.push({ url: t, ...(await probe(t)) });

    const okCount = results.filter((r) => r.ok).length;

    const total = results.length;

    let state;

    if (okCount === total) state = "UP";

    else if (okCount === 0) state = "DOWN";

    else state = "DEGRADED";

    const emoji = state === "UP" ? "✅" : state === "DEGRADED" ? "🟡" : "❌";

    const lines = results.map((r, i) => {

      if (r.ok) {

        return `• Probe ${i + 1}: ✅ ${r.status} (${r.ms}ms)`;

      }

      const why = r.status ? `${r.status}` : (r.error || "failed");

      return `• Probe ${i + 1}: ❌ ${why} (${r.ms}ms)`;

    });

    const firstFail = results.find((r) => !r.ok);

    const failReason = firstFail

      ? (firstFail.error ? firstFail.error : `HTTP ${firstFail.status}`)

      : null;

    const text =

      `🌍 *Site Up/Down Checker*\n\n` +

      `🔗 Target: ${origin}\n` +

      `📡 Result: ${emoji} *${state}* (${okCount}/${total} probes OK)\n` +

      (failReason ? `⚠️ First issue: ${failReason}\n` : "") +

      `\n` +

      lines.join("\n");

    return sock.sendMessage(from, { text }, { quoted: m });

  },

};