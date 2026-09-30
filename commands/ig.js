// commands/ig.js (ESM)
// BMEDIA-MD Instagram downloader
// API: https://ab-instadl.abrahamdw882.workers.dev/?url=<instagram_url>
//
// IMPORTANT:
// - No temp-file download.
// - No ffmpeg.
// - No full video Buffer.
// - Baileys receives the remote video URL and streams/uploads it to WhatsApp.
// - No extra npm dependency required on Node.js 18+.

const API_BASE = "https://ab-instadl.abrahamdw882.workers.dev/?url=";
const API_TIMEOUT_MS = 25_000;
const MAX_TITLE_LENGTH = 600;

function footer() {
  return "> POWERED BY BMEDIA-MD";
}

function pickUrl(args = []) {
  const text = args.join(" ").trim();
  const match = text.match(/https?:\/\/\S+/i);
  return match ? match[0].replace(/[)>\]}.,]+$/g, "") : "";
}

function isInstagramUrl(value = "") {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return (
      host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "instagr.am" ||
      host.endsWith(".instagr.am")
    );
  } catch {
    return false;
  }
}

function cleanText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value = "", max = MAX_TITLE_LENGTH) {
  const text = cleanText(value);
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function compactNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return "";

  try {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return String(num);
  }
}

function formatUploadDate(publishTs) {
  const seconds = Number(publishTs);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "";

  const configuredTz = String(process.env.TIMEZONE || "UTC").trim() || "UTC";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: configuredTz,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }
}

function buildCaption(result = {}) {
  const lines = [];

  const title = truncate(result.title);
  if (title) lines.push(`├◦ *Title:* ${title}`);

  const views = compactNumber(result.playCount ?? result.viewCount ?? result.views);
  if (views) lines.push(`├◦ *Views:* ${views}`);

  const likes = compactNumber(result.likeCount ?? result.likes);
  if (likes) lines.push(`├◦ *Likes:* ${likes}`);

  const uploaded = formatUploadDate(result.publishTs ?? result.publishTimestamp);
  if (uploaded) lines.push(`├◦ *Uploaded:* ${uploaded}`);

  // Keep the box clean: turn the final branch into the closing branch.
  if (lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/^├◦/, "╰◦");
  } else {
    lines.push("╰◦ Video ready");
  }

  return [
    "╭─〔 *INSTAGRAM* 〕",
    ...lines,
    "",
    footer(),
  ].join("\n");
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  timer.unref?.();

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "BMEDIA-MD/Instagram",
      },
    });

    const text = await res.text();
    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Instagram API returned invalid JSON.");
    }

    if (!res.ok) {
      throw new Error(data?.message || `Instagram API HTTP ${res.status}`);
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Instagram API timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function errorBox(message) {
  return [
    "╭─〔 *INSTAGRAM* 〕",
    `╰◦ ${message}`,
    "",
    footer(),
  ].join("\n");
}

export default {
  name: "ig",
  aliases: ["instagram", "insta"],
  category: "DOWNLOAD",
  description: "Download an Instagram reel/video without storing it on disk.",

  async execute(ctx) {
    const { sock, m, from, args = [], prefix = "." } = ctx;

    const targetUrl = pickUrl(args);

    if (!targetUrl) {
      return sock.sendMessage(
        from,
        {
          text: errorBox(`Usage: ${prefix}ig <Instagram link>`),
        },
        { quoted: m }
      );
    }

    if (!isInstagramUrl(targetUrl)) {
      return sock.sendMessage(
        from,
        {
          text: errorBox("Send a valid Instagram post/reel link."),
        },
        { quoted: m }
      );
    }

    const apiUrl = `${API_BASE}${encodeURIComponent(targetUrl)}`;

    try {
      try {
        await sock.sendMessage(from, {
          react: { text: "⏳", key: m.key },
        });
      } catch {}

      const data = await fetchJson(apiUrl);

      if (!data?.success) {
        throw new Error(data?.message || "Instagram API could not process this link.");
      }

      const result = data?.result;
      if (!result || typeof result !== "object") {
        throw new Error("Instagram API returned no media result.");
      }

      const videoUrl = String(result.video || "").trim();

      if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
        throw new Error("No downloadable video was returned.");
      }

      const caption = buildCaption(result);

      // IMPORTANT: URL media input means Baileys streams the remote video into
      // WhatsApp's media upload path. We do not write the Instagram video to
      // the bot's disk and we do not create a complete video Buffer ourselves.
      const sent = await sock.sendMessage(
        from,
        {
          video: { url: videoUrl },
          mimetype: "video/mp4",
          caption,
        },
        {
          quoted: m,
          mediaUploadTimeoutMs: 180_000,
        }
      );

      try {
        await sock.sendMessage(from, {
          react: { text: "✅", key: m.key },
        });
      } catch {}

      return sent;
    } catch (error) {
      try {
        await sock.sendMessage(from, {
          react: { text: "❌", key: m.key },
        });
      } catch {}

      return sock.sendMessage(
        from,
        {
          text: errorBox(error?.message || String(error)),
        },
        { quoted: m }
      );
    }
  },
};
