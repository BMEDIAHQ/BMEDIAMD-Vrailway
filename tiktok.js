// commands/tiktok.js
// BMEDIA-MD — TikTok downloader using TikWM API
// No temp files, no ffmpeg, no full-video Buffer.
// POST is used first; GET is used as a fallback request method.

const API_URL = "https://www.tikwm.com/api/";

function pickUrl(args = []) {
  const text = args.join(" ").trim();
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : "";
}

function isTikTokUrl(value = "") {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");

    return (
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com") ||
      host === "vm.tiktok.com" ||
      host === "vt.tiktok.com"
    );
  } catch {
    return false;
  }
}

function cleanText(value = "", max = 180) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function formatNumber(value) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) return "";

  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000)
      .toFixed(n >= 10_000_000_000 ? 0 : 1)
      .replace(/\.0$/, "")}B`;
  }

  if (n >= 1_000_000) {
    return `${(n / 1_000_000)
      .toFixed(n >= 10_000_000 ? 0 : 1)
      .replace(/\.0$/, "")}M`;
  }

  if (n >= 1_000) {
    return `${(n / 1_000)
      .toFixed(n >= 10_000 ? 0 : 1)
      .replace(/\.0$/, "")}K`;
  }

  return String(Math.trunc(n));
}

function formatDate(value) {
  if (value === null || value === undefined || value === "") return "";

  try {
    const numeric = Number(value);
    let date;

    if (Number.isFinite(numeric) && numeric > 0) {
      date = new Date(
        String(Math.trunc(numeric)).length <= 10
          ? numeric * 1000
          : numeric
      );
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

function normalizeMediaUrl(value = "") {
  const url = String(value || "").trim();

  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://www.tikwm.com${url}`;

  return url;
}

function normalizeImages(images) {
  if (!Array.isArray(images)) return [];

  return images
    .map((item) => {
      if (typeof item === "string") return normalizeMediaUrl(item);

      return normalizeMediaUrl(
        item?.url ||
        item?.display_image?.url_list?.[0] ||
        item?.image_url ||
        ""
      );
    })
    .filter((url) => /^https?:\/\//i.test(url));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Node.js 18+ built-in fetch is required.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse(res) {
  const text = await res.text();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}

  if (!res.ok) {
    throw new Error(
      data?.msg ||
      data?.message ||
      `TikWM HTTP ${res.status}`
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("TikWM returned invalid JSON.");
  }

  if (Number(data.code) !== 0 || !data.data) {
    throw new Error(
      data?.msg ||
      "TikWM could not process this TikTok link."
    );
  }

  return data.data;
}

async function requestTikWMPost(targetUrl) {
  const headers = {
    accept: "application/json",
    "user-agent":
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  };

  // Preferred method: POST form body.
  try {
    const body = new URLSearchParams({
      url: targetUrl,
      hd: "1",
    });

    const res = await fetchWithTimeout(API_URL, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    });

    return await parseJsonResponse(res);
  } catch (postError) {
    // Fallback method: GET to the same live API.
    try {
      const url =
        `${API_URL}?url=${encodeURIComponent(targetUrl)}` +
        `&hd=1`;

      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers,
      });

      return await parseJsonResponse(res);
    } catch (getError) {
      throw new Error(
        getError?.message ||
        postError?.message ||
        "TikWM request failed."
      );
    }
  }
}

function makeCaption(data = {}) {
  const title = cleanText(data?.title);
  const username = cleanText(
    data?.author?.unique_id ||
    data?.author?.username ||
    "",
    60
  );

  const views = formatNumber(data?.play_count);
  const likes = formatNumber(data?.digg_count);
  const comments = formatNumber(data?.comment_count);
  const uploaded = formatDate(data?.create_time);

  const body = [];

  if (title) body.push(`*Title:* ${title}`);
  if (username) body.push(`*Creator:* @${username.replace(/^@/, "")}`);
  if (views) body.push(`*Views:* ${views}`);
  if (likes) body.push(`*Likes:* ${likes}`);
  if (comments) body.push(`*Comments:* ${comments}`);
  if (uploaded) body.push(`*Uploaded:* ${uploaded}`);

  if (!body.length) body.push("*Media ready*");

  return [
    "╭─〔 *TIKTOK* 〕",
    ...body.map((line, i) =>
      `${i === body.length - 1 ? "╰◦" : "├◦"} ${line}`
    ),
    "",
    "> POWERED BY BMEDIA-MD",
  ].join("\n");
}

async function sendPhotoPost(sock, from, m, images, caption) {
  const limited = images.slice(0, 10);

  for (let i = 0; i < limited.length; i++) {
    await sock.sendMessage(
      from,
      {
        image: { url: limited[i] },
        ...(i === 0 ? { caption } : {}),
      },
      i === 0 ? { quoted: m } : {}
    );
  }
}

export default {
  name: "tiktok",
  aliases: ["tt", "tik"],
  category: "DOWNLOAD",
  description: "Download a public TikTok video or photo post.",
  usage: "tiktok <TikTok link>",

  async execute(ctx) {
    const {
      sock,
      m,
      from,
      args = [],
      prefix = ".",
    } = ctx;

    const targetUrl = pickUrl(args);

    if (!targetUrl || !isTikTokUrl(targetUrl)) {
      return sock.sendMessage(
        from,
        {
          text:
            `╭─〔 *TIKTOK* 〕\n` +
            `╰◦ Usage: ${prefix}tiktok <TikTok link>\n\n` +
            `> POWERED BY BMEDIA-MD`,
        },
        { quoted: m }
      );
    }

    try {
      await sock.sendMessage(
        from,
        { react: { text: "⏳", key: m.key } }
      ).catch(() => {});

      const data = await requestTikWMPost(targetUrl);
      const caption = makeCaption(data);

      const images = normalizeImages(data?.images);

      if (images.length) {
        await sendPhotoPost(
          sock,
          from,
          m,
          images,
          caption
        );

        await sock.sendMessage(
          from,
          { react: { text: "✅", key: m.key } }
        ).catch(() => {});

        return;
      }

      const videoUrl = normalizeMediaUrl(
        data?.hdplay ||
        data?.play ||
        data?.wmplay ||
        ""
      );

      if (!/^https?:\/\//i.test(videoUrl)) {
        throw new Error(
          "TikWM returned the post, but no video URL was available."
        );
      }

      // Baileys fetches the remote media URL.
      // We do not save the whole video to disk or build a full Buffer.
      const sent = await sock.sendMessage(
        from,
        {
          video: { url: videoUrl },
          mimetype: "video/mp4",
          caption,
        },
        { quoted: m }
      );

      await sock.sendMessage(
        from,
        { react: { text: "✅", key: m.key } }
      ).catch(() => {});

      return sent;
    } catch (error) {
      console.error(
        "[tiktok] download failed:",
        error?.message || error
      );

      await sock.sendMessage(
        from,
        { react: { text: "❌", key: m.key } }
      ).catch(() => {});

      return sock.sendMessage(
        from,
        {
          text:
            `╭─〔 *TIKTOK ERROR* 〕\n` +
            `╰◦ ${error?.message || "Download failed."}\n\n` +
            `> POWERED BY BMEDIA-MD`,
        },
        { quoted: m }
      );
    }
  },
};
