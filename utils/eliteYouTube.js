// utils/eliteYouTube.js
// BMEDIA-MD — Elite Pro YouTube helper
// Working endpoints supplied/tested by user:
//   /search/ytsearch?q=...
//   /download/ytdown?url=...&format=mp3|mp4
// No ffmpeg. No temp files. No full media Buffer.

const BASE = "https://eliteprotech-apis.zone.id";

const SEARCH_TIMEOUT_MS = 30_000;
const DOWNLOAD_API_TIMEOUT_MS = 60_000;

const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 BMEDIA-MD/1.0",
};

export function cleanText(value = "", max = 180) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  return text.length > max
    ? text.slice(0, max - 3) + "..."
    : text;
}

export function safeFileName(value = "", fallback = "YouTube") {
  const name = String(value || fallback)
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);

  return name || fallback;
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "";

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

export function extractYouTubeId(input = "") {
  const raw = String(input || "").trim();
  if (!raw) return "";

  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0] || "";
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    }

    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com")
    ) {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

      const parts = u.pathname.split("/").filter(Boolean);

      for (const marker of ["shorts", "embed", "live", "v"]) {
        const i = parts.indexOf(marker);

        if (
          i >= 0 &&
          /^[A-Za-z0-9_-]{11}$/.test(parts[i + 1] || "")
        ) {
          return parts[i + 1];
        }
      }
    }
  } catch {}

  return "";
}

export function findYouTubeUrl(text = "") {
  const urls = String(text || "")
    .match(/https?:\/\/[^\s]+/gi) || [];

  for (const url of urls) {
    if (extractYouTubeId(url)) return url;
  }

  return "";
}

async function fetchJson(url, timeoutMs) {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Node.js built-in fetch is unavailable.");
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: HEADERS,
    });

    const text = await res.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}

    if (!res.ok) {
      throw new Error(
        data?.message ||
        data?.error ||
        `Elite Pro HTTP ${res.status}`
      );
    }

    if (!data || typeof data !== "object") {
      throw new Error("Elite Pro returned invalid JSON.");
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Elite Pro request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchYouTube(query) {
  const q = cleanText(query, 180);

  if (!q) {
    throw new Error("Search query is empty.");
  }

  const endpoint =
    `${BASE}/search/ytsearch?q=${encodeURIComponent(q)}`;

  const data = await fetchJson(
    endpoint,
    SEARCH_TIMEOUT_MS
  );

  if (data?.success !== true) {
    throw new Error(
      data?.message ||
      data?.error ||
      "Elite Pro search failed."
    );
  }

  const rawVideos =
    Array.isArray(data?.results?.videos)
      ? data.results.videos
      : [];

  const videos = rawVideos
    .map((v) => ({
      id: String(v?.id || "").trim(),
      title: cleanText(v?.title || "Untitled", 150),
      url: String(v?.url || "").trim(),
      thumbnail: String(v?.thumbnail || "").trim(),
      duration: cleanText(v?.duration || "", 30),
      views: formatNumber(v?.views),
      uploaded: cleanText(v?.uploaded || "", 60),
      author: cleanText(v?.author?.name || "", 80),
      authorUrl: String(v?.author?.url || "").trim(),
    }))
    .filter((v) => {
      const id =
        v.id ||
        extractYouTubeId(v.url);

      return !!id && !!v.url;
    });

  if (!videos.length) {
    throw new Error("Elite Pro returned no YouTube video results.");
  }

  return {
    videos,
    raw: data,
  };
}

export async function searchTopYouTube(query) {
  const result = await searchYouTube(query);

  if (!result?.videos?.length) {
    throw new Error("No YouTube result found.");
  }

  return result.videos[0];
}

export async function downloadYouTube(
  youtubeUrl,
  format
) {
  const normalizedFormat =
    String(format || "").toLowerCase() === "mp4"
      ? "mp4"
      : "mp3";

  if (!extractYouTubeId(youtubeUrl)) {
    throw new Error("Invalid YouTube URL.");
  }

  const endpoint =
    `${BASE}/download/ytdown` +
    `?url=${encodeURIComponent(youtubeUrl)}` +
    `&format=${normalizedFormat}`;

  const data = await fetchJson(
    endpoint,
    DOWNLOAD_API_TIMEOUT_MS
  );

  if (data?.success !== true) {
    throw new Error(
      data?.message ||
      data?.error ||
      "Elite Pro download failed."
    );
  }

  const downloadURL =
    String(
      data?.downloadURL ||
      data?.downloadUrl ||
      data?.url ||
      ""
    ).trim();

  if (!/^https?:\/\//i.test(downloadURL)) {
    throw new Error(
      "Elite Pro returned no valid downloadURL."
    );
  }

  return {
    title: cleanText(
      data?.title ||
      (normalizedFormat === "mp3"
        ? "YouTube Audio"
        : "YouTube Video"),
      180
    ),
    downloadURL,
    format: normalizedFormat,
    raw: data,
  };
}
