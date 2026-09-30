// commands/ttt.js (ESM)

// Tic Tac Toe for two users.

// Start: !ttt @user   (or reply to user then !ttt)

// Move:  !ttt 1-9

// End:   !ttt end

import fs from "fs";

import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");

const DB_FILE = path.join(DATA_DIR, "ttt.json");

function ensureDb() {

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));

}

function readDb() {

  ensureDb();

  try {

    return JSON.parse(fs.readFileSync(DB_FILE, "utf8") || "{}");

  } catch {

    return {};

  }

}

function writeDb(db) {

  ensureDb();

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

}

function jidNum(jid) {

  return String(jid || "").split("@")[0];

}

function getSenderJid(m) {

  return m?.key?.participant || m?.participant || m?.key?.remoteJid || "";

}

function getMentionedJid(m) {

  const ctx = m?.message?.extendedTextMessage?.contextInfo;

  const mentioned = ctx?.mentionedJid || [];

  if (mentioned.length) return mentioned[0];

  const replied = ctx?.participant; // if user replied to someone

  return replied || "";

}

function renderBoard(b) {

  // b is array of 9 values: "X", "O", or ""

  const cell = (i) => (b[i] ? b[i] : `${i + 1}`);

  return (

`┌───┬───┬───┐

│ ${cell(0)} │ ${cell(1)} │ ${cell(2)} │

├───┼───┼───┤

│ ${cell(3)} │ ${cell(4)} │ ${cell(5)} │

├───┼───┼───┤

│ ${cell(6)} │ ${cell(7)} │ ${cell(8)} │

└───┴───┴───┘`

  );

}

function winner(board) {

  const lines = [

    [0,1,2],[3,4,5],[6,7,8],

    [0,3,6],[1,4,7],[2,5,8],

    [0,4,8],[2,4,6]

  ];

  for (const [a,b,c] of lines) {

    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];

  }

  return "";

}

function isDraw(board) {

  return board.every((x) => x === "X" || x === "O") && !winner(board);

}

export default {

  name: "ttt",

  aliases: ["tictactoe", "xo"],

  category: "GAMES",

  description: "Play Tic-Tac-Toe with another user: !ttt @user, then !ttt 1-9.",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const chatId = from;

    const db = readDb();

    const sub = String(args?.[0] || "").toLowerCase().trim();

    const sender = getSenderJid(m);

    // End game

    if (sub === "end" || sub === "stop" || sub === "cancel") {

      if (!db[chatId]) {

        return sock.sendMessage(from, { text: "❌ No active Tic-Tac-Toe game here." }, { quoted: m });

      }

      delete db[chatId];

      writeDb(db);

      return sock.sendMessage(from, { text: "✅ Tic-Tac-Toe game ended." }, { quoted: m });

    }

    // If no active game: start game with mention/reply

    if (!db[chatId]) {

      const opponent = getMentionedJid(m);

      if (!opponent || opponent === sender) {

        return sock.sendMessage(

          from,

          { text: `Usage:\n${prefix}ttt @user (or reply to user)\nThen play: ${prefix}ttt 1-9\nEnd: ${prefix}ttt end` },

          { quoted: m }

        );

      }

      const board = Array(9).fill("");

      const game = {

        pX: sender,

        pO: opponent,

        turn: "X",         // X starts

        board,

        startedAt: Date.now()

      };

      db[chatId] = game;

      writeDb(db);

      const msg =

        `🎮 *TIC TAC TOE*\n\n` +

        `❌ X: @${jidNum(game.pX)}\n` +

        `⭕ O: @${jidNum(game.pO)}\n\n` +

        `${renderBoard(board)}\n\n` +

        `Turn: *X* (@${jidNum(game.pX)})\n` +

        `Play using: *${prefix}ttt 1-9*`;

      return sock.sendMessage(from, { text: msg, mentions: [game.pX, game.pO] }, { quoted: m });

    }

    // Active game exists: handle move

    const game = db[chatId];

    // Move input must be 1-9

    const move = parseInt(sub, 10);

    if (!Number.isInteger(move) || move < 1 || move > 9) {

      const msg =

        `🎮 *TIC TAC TOE*\n\n` +

        `${renderBoard(game.board)}\n\n` +

        `Turn: *${game.turn}* (${game.turn === "X" ? `@${jidNum(game.pX)}` : `@${jidNum(game.pO)}`})\n` +

        `Play: *${prefix}ttt 1-9*  |  End: *${prefix}ttt end*`;

      return sock.sendMessage(from, { text: msg, mentions: [game.pX, game.pO] }, { quoted: m });

    }

    const currentPlayerJid = game.turn === "X" ? game.pX : game.pO;

    if (sender !== currentPlayerJid) {

      return sock.sendMessage(

        from,

        { text: `⏳ Not your turn.\nIt’s ${game.turn}'s turn: @${jidNum(currentPlayerJid)}`, mentions: [currentPlayerJid] },

        { quoted: m }

      );

    }

    const idx = move - 1;

    if (game.board[idx]) {

      return sock.sendMessage(from, { text: "❌ That position is already taken. Choose another (1-9)." }, { quoted: m });

    }

    // Apply move

    game.board[idx] = game.turn;

    // Check win/draw

    const w = winner(game.board);

    if (w) {

      const winnerJid = w === "X" ? game.pX : game.pO;

      const msg =

        `🏆 *GAME OVER*\n\n` +

        `${renderBoard(game.board)}\n\n` +

        `Winner: *${w}* (@${jidNum(winnerJid)}) 🎉`;

      delete db[chatId];

      writeDb(db);

      return sock.sendMessage(from, { text: msg, mentions: [winnerJid] }, { quoted: m });

    }

    if (isDraw(game.board)) {

      const msg =

        `🤝 *DRAW*\n\n` +

        `${renderBoard(game.board)}\n\n` +

        `No winner this time. Start again with: *${prefix}ttt @user*`;

      delete db[chatId];

      writeDb(db);

      return sock.sendMessage(from, { text: msg }, { quoted: m });

    }

    // Switch turn

    game.turn = game.turn === "X" ? "O" : "X";

    db[chatId] = game;

    writeDb(db);

    const nextJid = game.turn === "X" ? game.pX : game.pO;

    const msg =

      `🎮 *TIC TAC TOE*\n\n` +

      `${renderBoard(game.board)}\n\n` +

      `Turn: *${game.turn}* (@${jidNum(nextJid)})\n` +

      `Play using: *${prefix}ttt 1-9*`;

    return sock.sendMessage(from, { text: msg, mentions: [nextJid] }, { quoted: m });

  },

};