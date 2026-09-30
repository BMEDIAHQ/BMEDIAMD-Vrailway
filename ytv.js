// commands/ytv.js
// BMEDIA-MD — YouTube video using Elite Pro's working ytdown endpoint.
// Link-only to keep video behavior explicit and predictable.

import {
  findYouTubeUrl,
  downloadYouTube,
} from "../utils/eliteYouTube.js";

function buildCaption(title) {
  return [
    "╭─〔 *YOUTUBE VIDEO* 〕",
    `╰◦ *${title || "YouTube Video"}*`,
    "",
    "> POWERED BY BMEDIA-MD",
  ].join("\n");
}

export default {
  name: "ytv",

  aliases: [
    "ytmp4",
    "youtubevideo",
  ],

  category: "DOWNLOAD",

  description:
    "Download YouTube video.",

  usage:
    "ytv <YouTube link>",

  async execute(ctx) {
    const {
      sock,
      m,
      from,
      args = [],
      prefix = ".",
    } = ctx;

    const input =
      args.join(" ").trim();

    const youtubeUrl =
      findYouTubeUrl(input);

    if (!youtubeUrl) {
      return sock.sendMessage(
        from,
        {
          text:
            `╭─〔 *YOUTUBE VIDEO* 〕\n` +
            `╰◦ Usage: ${prefix}ytv <YouTube link>\n\n` +
            `> POWERED BY BMEDIA-MD`,
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

      const result =
        await downloadYouTube(
          youtubeUrl,
          "mp4"
        );

      const sent =
        await sock.sendMessage(
          from,
          {
            video: {
              url: result.downloadURL,
            },
            mimetype: "video/mp4",
            caption:
              buildCaption(result.title),
          },
          { quoted: m }
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
            "╭─〔 *YOUTUBE VIDEO ERROR* 〕",
            `╰◦ ${error?.message || "Video download failed."}`,
            "",
            "> POWERED BY BMEDIA-MD",
          ].join("\n"),
        },
        { quoted: m }
      );
    }
  },
};
