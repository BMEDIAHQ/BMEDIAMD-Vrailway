// commands/symbols.js

export default {

  name: "symbols",

  aliases: ["specialsymbols", "sym"],

  category: "TOOLS",

  description: "Show special symbols.",

  usage: "symbols",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const text = `*BOX DRAWING*

─ ━ │ ┃ ┄ ┅ ┆ ┇ ┈ ┉ ┊ ┋

┌ ┍ ┎ ┏ ┐ ┑ ┒ ┓

└ ┕ ┖ ┗ ┘ ┙ ┚ ┛

├ ┝ ┞ ┟ ┠ ┡ ┢ ┣

┤ ┥ ┦ ┧ ┨ ┩ ┪ ┫

┬ ┭ ┮ ┯ ┰ ┱ ┲ ┳

┴ ┵ ┶ ┷ ┸ ┹ ┺ ┻

┼ ┽ ┾ ┿ ╀ ╁ ╂ ╃ ╄ ╅ ╆ ╇ ╈ ╉ ╊ ╋

╌ ╍ ╎ ╏

═ ║

╒ ╓ ╔ ╕ ╖ ╗

╘ ╙ ╚ ╛ ╜ ╝

╞ ╟ ╠ ╡ ╢ ╣

╤ ╥ ╦ ╧ ╨ ╩

╪ ╫ ╬

╭ ╮ ╯ ╰

╱ ╲ ╳

╴ ╵ ╶ ╷

╸ ╹ ╺ ╻

╼ ╽ ╾ ╿

*BLOCK ELEMENTS*

▀ ▁ ▂ ▃ ▄ ▅ ▆ ▇ █

▉ ▊ ▋ ▌ ▍ ▎ ▏

▐ ░ ▒ ▓

▔ ▕ ▖ ▗ ▘ ▙ ▚ ▛ ▜ ▝ ▞ ▟

*SQUARES / RECTANGLES*

■ □ ▢ ▣ ▤ ▥ ▦ ▧ ▨ ▩

▪ ▫ ▬ ▭ ▮ ▯

◧ ◨ ◩ ◪

◫ ◬

◻ ◼ ◽ ◾

*TRIANGLES*

▲ △ ▴ ▵

▶ ▷ ▸ ▹ ► ▻

▼ ▽ ▾ ▿

◀ ◁ ◂ ◃ ◄ ◅

◢ ◣ ◤ ◥

◬ ◭ ◮ ◸ ◹ ◺

*CIRCLES*

○ ◌ ◍ ◎ ● ◉ ◯

◐ ◑ ◒ ◓

◔ ◕

◖ ◗

◘ ◙

◚ ◛

◜ ◝ ◞ ◟

◠ ◡

◦ ∘

⊙ ⊚ ⊛ ⊜ ⊝

*DIAMONDS*

◆ ◇ ◈ ♦ ♢ ❖

⬥ ⬦ ⬧ ⬨

⋄

*BULLETS / DOTS*

• ‣ ․ ‧ ⁃

⁌ ⁍

∙ ⋅ ∘

·

◦

▪ ▫

*STARS / SPARKLES*

★ ☆

✦ ✧ ✩ ✪ ✫ ✬ ✭ ✮ ✯ ✰

✱ ✲ ✳ ✴ ✵ ✶ ✷ ✸ ✹ ✺ ✻ ✼ ✽ ✾

❂ ❃ ❇ ❈ ❉ ❊ ❋

⋆ ∗

*BRACKETS / FRAMES*

( )

[ ]

{ }

⌈ ⌉

⌊ ⌋

⌜ ⌝

⌞ ⌟

⟅ ⟆

⟦ ⟧

⟨ ⟩

⟪ ⟫

⟬ ⟭

⟮ ⟯

〈 〉

《 》

「 」

『 』

【 】

〔 〕

〖 〗

〘 〙

〚 〛

〝 〞

*SLASHES / DIVIDERS*

/ \\ |

¦ ‖

╱ ╲ ╳

*ARROWS*

← ↑ → ↓

↔ ↕

↖ ↗ ↘ ↙

↚ ↛

↜ ↝ ↞ ↟ ↠ ↡

↢ ↣ ↤ ↥ ↦ ↧ ↨

↩ ↪ ↫ ↬

↭ ↮ ↯

↰ ↱ ↲ ↳ ↴ ↵

⇐ ⇑ ⇒ ⇓ ⇔ ⇕

⇖ ⇗ ⇘ ⇙

⇚ ⇛ ⇜ ⇝ ⇞ ⇟

⇠ ⇡ ⇢ ⇣

⇤ ⇥

⟵ ⟶ ⟷

⟸ ⟹ ⟺

*CROSSES / PLUS / MULTIPLY*

+ − ± ∓

× ÷

✕ ✖ ✗ ✘

† ‡

⊕ ⊖ ⊗ ⊘

⊞ ⊟ ⊠ ⊡

*MATH / RELATIONS*

= ≠ ≈ ≉ ≊ ≋

≡ ≢

< > ≤ ≥

≪ ≫

∝ ∞

√ ∛ ∜

∟ ∠ ∡ ∢

∣ ∥ ⊥

∴ ∵

*WAVES / CURVES*

~ ∼ ≈ ≋ ≀

⌒ ⌢ ⌣

‿ ⁀

﹏ ︴

*DASHES / BARS*

- ‐ - ‒ – — ―

_ ¯

‖

*ORNAMENTS*

※ ⁂ ⁑ ⁕

§ ¶

❂ ❃ ❇ ❈ ❉ ❊ ❋ ❖

*COMMON PAIRS*

╭ ╮ ╰ ╯

┌ ┐ └ ┘

╔ ╗ ╚ ╝

◜ ◝ ◞ ◟

「 」

『 』

【 】

〔 〕

《 》

〈 〉

( )

[ ]

{ }`;

    await sock.sendMessage(from, { text }, { quoted: m });

  },

};