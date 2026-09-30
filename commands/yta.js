// commands/yta.js
// BMEDIA-MD — YouTube audio using Elite Pro's working ytdown endpoint.
//
// TITLE:
//   .play Alan Walker Faded
//   -> search -> first result -> mp3 endpoint
//
// LINK:
//   .yta https://youtube.com/watch?v=...
//   -> skip search -> mp3 endpoint

import {
  findYouTubeUrl,
  searchTopYouTube,
  downloadYouTube,
  safeFileName,
} from "../utils/eliteYouTube.js";

function buildCaption(title, searchResult = null) {
  const rows = [];

  if (title) {
    rows.push(`*Title:* ${title}`);
  }

  if (searchResult?.author) {
    rows.push(`*Channel:* ${searchResult.author}`);
  }

  if (searchResult?.duration) {
    rows.push(`*Duration:* ${searchResult.duration}`);
  }

  if (searchResult?.views) {
    rows.push(`*Views:* ${searchResult.views}`);
  }

  if (!rows.length) {
    rows.push("*Audio ready*");
  }

  return [
    "╭─〔 *YOUTUBE AUDIO* 〕",
    ...rows.map((row, i) =>
      `${i === rows.length - 1 ? "╰◦" : "├◦"} ${row}`
    ),
    "",
    "> POWERED BY BMEDIA-MD",
  ].join("\n");
}

export default {
  name: "yta",

  aliases: [
    "ytmp3",
    "youtubeaudio",
    "play",
    "song",
  ],

  category: "DOWNLOAD",

  description:
    "Search for or download YouTube audio.",

  usage:
    "yta <YouTube link or song title>",

  async execute(ctx) {
    const {
      sock,
      m,
      from,
      args = [],
      prefix = ".",
    } = ctx;

    const input = args.join(" ").trim();

    if (!input) {
      return sock.sendMessage(
        from,
        {
          text: [
            "╭─〔 *YOUTUBE AUDIO* 〕",
            `├◦ ${prefix}play <song title>`,
            `├◦ ${prefix}song <song title>`,
            `╰◦ ${prefix}yta <YouTube link>`,
            "",
            "> POWERED BY BMEDIA-MD",
          ].join("\n"),
        },
        { quoted: m }
      );
    }

    try {
      await sock.sendMessage(
        from,
        {
          react: {
            text: "⏳",
            key: m.key,
          },
        }
      ).catch(() => {});

      const directUrl =
        findYouTubeUrl(input);

      let youtubeUrl = directUrl;
      let searchResult = null;

      // If the user typed a title instead of a URL,
      // search Elite Pro and use result #1.
      if (!youtubeUrl) {
        searchResult =
          await searchTopYouTube(input);

        youtubeUrl =
          searchResult?.url || "";
      }

      if (!youtubeUrl) {
        throw new Error(
          "Could not find a YouTube result."
        );
      }

      const result =
        await downloadYouTube(
          youtubeUrl,
          "mp3"
        );

      const title =
        result.title ||
        searchResult?.title ||
        "YouTube Audio";

      // Audio messages do not display ordinary captions
      // consistently, so send the info card first.
      await sock.sendMessage(
        from,
        {
          text:
            buildCaption(
              title,
              searchResult
            ),
        },
        { quoted: m }
      );

      const sent =
        await sock.sendMessage(
          from,
          {
            audio: {
              url: result.downloadURL,
            },
            mimetype: "audio/mpeg",
            ptt: false,
            fileName:
              `${safeFileName(
                title,
                "YouTube Audio"
              )}.mp3`,
          }
        );

      await sock.sendMessage(
        from,
        {
          react: {
            text: "✅",
            key: m.key,
          },
        }
      ).catch(() => {});

      return sent;
    } catch (error) {
      await sock.sendMessage(
        from,
        {
          react: {
            text: "❌",
            key: m.key,
          },
        }
      ).catch(() => {});

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
