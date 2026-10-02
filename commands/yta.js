// commands/yta.js
// BMEDIA-MD — YouTube audio via Elite Pro /download/ytmp3.
//
// TITLE:
//   .yta Alan Walker Faded
//   -> search -> first result -> ytmp3
//
// LINK:
//   .yta https://youtube.com/watch?v=...
//   -> direct ytmp3

import {
  findYouTubeUrl,
  searchTopYouTube,
  downloadYouTube,
  safeFileName,
} from "../utils/eliteYouTube.js";

function buildCaption(title, searchResult = null, result = null) {
  const rows = [];

  if (title) rows.push(`*Title:* ${title}`);
  if (searchResult?.author) rows.push(`*Channel:* ${searchResult.author}`);

  const duration = result?.duration || searchResult?.duration;
  if (duration) rows.push(`*Duration:* ${duration}`);

  if (searchResult?.views) rows.push(`*Views:* ${searchResult.views}`);
  if (!rows.length) rows.push("*Audio ready*");

  return [
    "╭─〔 *YOUTUBE AUDIO* 〕",
    ...rows.map((row, i) => `${i === rows.length - 1 ? "╰◦" : "├◦"} ${row}`),
    "",
    "> POWERED BY BMEDIA-MD",
  ].join("\n");
}

export default {
  name: "yta",
  aliases: ["ytmp3", "youtubeaudio", "play", "song"],
  category: "DOWNLOAD",
  description: "Search for or download YouTube audio.",
  usage: "yta <YouTube link or song title>",

  async execute(ctx) {
    const { sock, m, from, args = [], prefix = "." } = ctx;
    const input = args.join(" ").trim();

    if (!input) {
      return sock.sendMessage(
        from,
        {
          text: [
            "╭─〔 *YOUTUBE AUDIO* 〕",
            `├◦ ${prefix}yta <song title>`,
            `╰◦ ${prefix}yta <YouTube link>`,
            "",
            "> POWERED BY BMEDIA-MD",
          ].join("\n"),
        },
        { quoted: m }
      );
    }

    try {
      await sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

      const directUrl = findYouTubeUrl(input);
      let youtubeUrl = directUrl;
      let searchResult = null;

      if (!youtubeUrl) {
        searchResult = await searchTopYouTube(input);
        youtubeUrl = searchResult?.url || "";
      }

      if (!youtubeUrl) {
        throw new Error("Could not find a YouTube result.");
      }

      const result = await downloadYouTube(youtubeUrl, "mp3");
      const title = result.title || searchResult?.title || "YouTube Audio";

      await sock.sendMessage(
        from,
        { text: buildCaption(title, searchResult, result) },
        { quoted: m }
      );

      const sent = await sock.sendMessage(
        from,
        {
          audio: { url: result.downloadURL },
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${safeFileName(title, "YouTube Audio")}.mp3`,
        },
        { quoted: m }
      );

      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
      return sent;
    } catch (error) {
      await sock.sendMessage(from, { react: { text: "❌", key: m.key } }).catch(() => {});

      return sock.sendMessage(
        from,
        {
          text: [
            "╭─〔 *YOUTUBE AUDIO ERROR* 〕",
            `╰◦ ${error?.message || "Audio download failed."}`,
            "",
            "> POWERED BY BMEDIA-MD",
          ].join("\n"),
        },
        { quoted: m }
      );
    }
  },
};
