// commands/yts.js
// BMEDIA-MD — YouTube search using Elite Pro's working search endpoint.

import {
  searchYouTube,
  cleanText,
} from "../utils/eliteYouTube.js";

export default {
  name: "yts",
  aliases: ["ytsearch"],
  category: "SEARCH",
  description: "Search YouTube videos.",
  usage: "yts <query>",

  async execute(ctx) {
    const {
      sock,
      m,
      from,
      args = [],
      prefix = ".",
    } = ctx;

    const query = args.join(" ").trim();

    if (!query) {
      return sock.sendMessage(
        from,
        {
          text:
            `╭─〔 *YOUTUBE SEARCH* 〕\n` +
            `╰◦ Usage: ${prefix}yts <query>\n\n` +
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
            text: "🔎",
            key: m.key,
          },
        }
      ).catch(() => {});

      const { videos } =
        await searchYouTube(query);

      // Keep it compact: top 6 results.
      const top = videos.slice(0, 6);

      const blocks = top.map((v, i) => {
        const meta = [
          v.duration,
          v.views ? `${v.views} views` : "",
          v.author,
          v.uploaded,
        ]
          .filter(Boolean)
          .join(" • ");

        return [
          `*${i + 1}. ${cleanText(v.title, 100)}*`,
          meta || null,
          v.url,
        ]
          .filter(Boolean)
          .join("\n");
      });

      const caption = [
        "╭─〔 *YOUTUBE SEARCH* 〕",
        `├◦ Query: *${cleanText(query, 75)}*`,
        `╰◦ Results: *${top.length}*`,
        "",
        blocks.join("\n\n"),
        "",
        "> POWERED BY BMEDIA-MD",
      ].join("\n");

      const first = top[0];

      // Top search-result thumbnail preview.
      if (
        first?.thumbnail &&
        /^https?:\/\//i.test(first.thumbnail)
      ) {
        try {
          const sent =
            await sock.sendMessage(
              from,
              {
                image: {
                  url: first.thumbnail,
                },
                caption,
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
        } catch {}
      }

      const sent =
        await sock.sendMessage(
          from,
          { text: caption },
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
            "╭─〔 *YOUTUBE SEARCH ERROR* 〕",
            `╰◦ ${error?.message || "Search failed."}`,
            "",
            "> POWERED BY BMEDIA-MD",
          ].join("\n"),
        },
        { quoted: m }
      );
    }
  },
};
