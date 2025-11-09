// server/server.js
const express = require("express");
const { Server } = require("socket.io");
const { v4: uuidV4 } = require("uuid");
const http = require("http");
const cors = require("cors");
const storage = require("node-persist");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// ---------- Segédfüggvények ----------
async function loadRooms() {
  const saved = await storage.getItem("rooms");
  return saved ? new Map(saved) : new Map();
}

async function saveRooms(rooms) {
  await storage.setItem("rooms", Array.from(rooms.entries()));
}

// ---------- Main init ----------
(async () => {
  await storage.init({
    dir: "data",
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: "utf8",
  });

  let rooms = await loadRooms();
  console.log("✅ Rooms loaded from storage:", rooms.size);

  io.on("connection", (socket) => {
    console.log(`${socket.id} connected`);

    socket.on("username", (username) => {
      socket.data.username = username;
    });

    // --- CREATE ROOM ---
    socket.on("createRoom", async (callback, gameType = "alap") => {
      try {
        const roomId = uuidV4();
        await socket.join(roomId);
        rooms.set(roomId, {
          roomId,
          players: [{ id: socket.id, username: socket.data?.username, color: "white" }],
          board: null,
          turnColor: "white",
          hasMoved: {},
          enPassantTarget: null,
          positionHistory: [],
          threefoldDeclared: false,
          halfmoveClock: 0,
          fiftyDeclared: false,
          gameType,
        });
        await saveRooms(rooms);
        // if (typeof callback === "function") callback(roomId);
        if (typeof callback === "function") {
  const createdRoom = rooms.get(roomId);
  callback(createdRoom); // küldjük vissza az egész szobát, nem csak az ID-t
}

        console.log(`🆕 Room created: ${roomId} (${gameType})`);
      } catch (e) {
        console.error("createRoom error:", e);
        if (typeof callback === "function") callback(null);
      }
    });

    // --- JOIN ROOM ---
    socket.on("joinRoom", async (args, callback) => {
      const room = rooms.get(args.roomId);
      let error, message;

      if (!room) {
        error = true;
        message = "room does not exist";
      } else if (room.players.length >= 2) {
        error = true;
        message = "room is full";
      }

      if (error) {
        if (callback) callback({ error, message });
        return;
      }

      await socket.join(args.roomId);
      const newPlayer = {
        id: socket.id,
        username: socket.data?.username,
        color: "black",
      };
      const updatedRoom = { ...room, players: [...room.players, newPlayer] };
      rooms.set(args.roomId, updatedRoom);
      await saveRooms(rooms);

      callback(updatedRoom);
      socket.to(args.roomId).emit("opponentJoined", updatedRoom);
      console.log(`👥 ${socket.data.username} joined room ${args.roomId}`);
    });

    // --- MOVE HANDLER ---
    socket.on("move", async ({ room, board, move, playerId, enPassantTarget }) => {
      const game = rooms.get(room);
      if (!game) return;

      const isPeasantWar = game.gameType === "paraszthaboru";
      const isQueenBattle = game.gameType === "vezerharc";
      const isKingHunt = game.gameType === "kiralyvadaszat";


      if (game.players.length < 2) {
        io.to(playerId).emit("errorMessage", "Mindkét játékosnak csatlakoznia kell, mielőtt léphettek.");
        return;
      }

      if (!game.turnColor) game.turnColor = "white";
      if (!game.hasMoved) game.hasMoved = {};
      if (!("enPassantTarget" in game)) game.enPassantTarget = null;
      if (!Array.isArray(game.positionHistory)) game.positionHistory = [];

      const player = game.players.find((p) => p.id === playerId);
      if (!player) return;
      const playerColor = player.color;

      if (game.turnColor !== playerColor) {
        io.to(playerId).emit("errorMessage", "Nem te következel!");
        return;
      }

      if (game.hasMoved[playerId]) {
        io.to(playerId).emit("errorMessage", "Már léptél ebben a körben!");
        return;
      }

      const previousBoard = game.board ? JSON.parse(JSON.stringify(game.board)) : null;


   



      // --- PARASZTHÁBORÚ LOGIKA ---
      if (isPeasantWar) {
        game.board = board;
        game.hasMoved[playerId] = true;
        game.turnColor = playerColor === "white" ? "black" : "white";

        socket.to(room).emit("move", {
          board: game.board,
          turnColor: game.turnColor,
        });

        const whiteReached = board[0]?.some((p) => p === "P");
        const blackReached = board[7]?.some((p) => p === "p");

        let whitePawns = 0, blackPawns = 0;
        for (let i = 0; i < 8; i++)
          for (let j = 0; j < 8; j++) {
            if (board[i][j] === "P") whitePawns++;
            if (board[i][j] === "p") blackPawns++;
          }

        if (whiteReached || blackReached || whitePawns === 0 || blackPawns === 0) {
          let winner = null;
          if (whiteReached || blackPawns === 0) winner = "White";
          if (blackReached || whitePawns === 0) winner = "Black";

          io.to(room).emit("drawOrMate", {
            status: { status: "finished", winner },
          });

          console.log(`🏁 Parasztháború vége (${winner}) szoba: ${room}`);
          rooms.set(room, game);
          await saveRooms(rooms);
          return;
        }

       // ha a következő játékosnak csak 1 gyalogja maradt és nem tud szabályos lépést tenni → vége
 // --- 🔥 ÚJ: ha a következő fél összes gyalogja blokkolva van (nem tud lépni) ---
const nextIsWhite = game.turnColor === "white";
const whitePawnPositions = [];
const blackPawnPositions = [];

for (let i = 0; i < 8; i++) {
  for (let j = 0; j < 8; j++) {
    if (board[i][j] === "P") whitePawnPositions.push([i, j]);
    if (board[i][j] === "p") blackPawnPositions.push([i, j]);
  }
}

const pawns = nextIsWhite ? whitePawnPositions : blackPawnPositions;
let canMove = false;

for (const [i, j] of pawns) {
  const dir = nextIsWhite ? -1 : 1;
  // lépés előre
  if (i + dir >= 0 && i + dir < 8 && board[i + dir][j] === null) {
    canMove = true;
    break;
  }
  // ütés átlósan
  for (const dy of [-1, 1]) {
    const x = i + dir;
    const y = j + dy;
    if (x >= 0 && x < 8 && y >= 0 && y < 8) {
      const target = board[x][y];
      if (target && (nextIsWhite !== (target === target.toUpperCase()))) {
        canMove = true;
        break;
      }
    }
  }
  if (canMove) break;
}

if (!canMove && pawns.length > 0) {
  const winner = nextIsWhite ? "Black" : "White";
  io.to(room).emit("drawOrMate", {
    status: { status: "finished", winner, reason: "no-move" },
  });
  console.log(
    `🪖 Parasztháború vége: ${winner} nyert (ellenfél összes gyalogja blokkolva)`
  );
  rooms.set(room, game);
  await saveRooms(rooms);
  return;
}





        rooms.set(room, game);
        await saveRooms(rooms);
        return;
      }

      // --- VEZÉRHARC LOGIKA (Queen vs 8 Pawns) ---
      if (isQueenBattle) {
        game.board = board;
        game.hasMoved[playerId] = true;
        game.turnColor = playerColor === "white" ? "black" : "white";

        socket.to(room).emit("move", {
          board: game.board,
          turnColor: game.turnColor,
        });

        let whiteQueenAlive = false;
        let blackPawns = 0;
        let blackPromotedOrReached = false;

        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            const p = board[i][j];
            if (p === "Q") whiteQueenAlive = true;
            if (p === "p") blackPawns++;
            // ⚙️ FIX: fekete gyalog elérte a fehér alapvonalat (0. sor)
            if ((i === 0 || i === 7) && (p === "p" || p === "q")) {
              console.log("⚫ Black pawn reached promotion row:", i, j);
              blackPromotedOrReached = true;
            }
          }
        }

        let winner = null;
        let reason = "";

        if (!whiteQueenAlive) {
          winner = "Black";
          reason = "queen_captured";
        } else if (blackPawns === 0) {
          winner = "White";
          reason = "all_pawns_captured";
        } else if (blackPromotedOrReached) {
          winner = "Black";
          reason = "pawn_promoted";
        }

        if (winner) {
          io.to(room).emit("drawOrMate", {
            status: { status: "finished", winner, reason },
          });

          const message =
            winner === "Black" && reason === "pawn_promoted"
              ? "🏴 Black wins — a pawn reached promotion!"
              : winner === "White"
              ? "⚪ White wins — all pawns have been taken!"
              : "🏴 Black wins — the Queen was captured!";

          console.log(`👑 Vézerharc vége: ${message} (room: ${room})`);
          rooms.set(room, game);
          await saveRooms(rooms);
          return;
        }




        rooms.set(room, game);
        await saveRooms(rooms);
        return;
      }

      // --- BÁSTYAHARC LOGIKA (Rook vs 5 Pawns) ---
if (game.gameType === "bastyaharc") {
  game.board = board;
  game.hasMoved[playerId] = true;
  game.turnColor = playerColor === "white" ? "black" : "white";

  socket.to(room).emit("move", {
    board: game.board,
    turnColor: game.turnColor,
  });

  let rookAlive = false;
  let pawns = [];

  // keresés a táblán
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const p = board[i][j];
      if (p === "R") rookAlive = true;
      if (p === "p") pawns.push([i, j]);
    }
  }

  let winner = null;
  let reason = "";

  // ha a bástyát leütötték → gyalogok nyernek
  if (!rookAlive) {
    winner = "Black";
    reason = "rook_captured";
  }

  // ha az összes gyalog elfogyott → bástya nyer
  if (pawns.length === 0) {
    winner = "White";
    reason = "all_pawns_captured";
  }

  // ha egy gyalog biztonságosan eléri az utolsó sort
  if (!winner) {
    for (const [i, j] of pawns) {
      if (i === 7) {
        let safe = true;
        // nézd meg, hogy a bástya tudná-e azonnal ütni
        // vízszintesen balra
        for (let y = j - 1; y >= 0; y--) {
          if (board[i][y] === "R") safe = false;
          if (board[i][y]) break;
        }
        // vízszintesen jobbra
        for (let y = j + 1; y < 8; y++) {
          if (board[i][y] === "R") safe = false;
          if (board[i][y]) break;
        }
        // függőlegesen felfelé
        for (let x = i - 1; x >= 0; x--) {
          if (board[x][j] === "R") safe = false;
          if (board[x][j]) break;
        }

        if (safe) {
          winner = "Black";
          reason = "safe_pawn_promoted";
          break;
        }
      }
    }
  }

  if (winner) {
    io.to(room).emit("drawOrMate", {
      status: { status: "finished", winner, reason },
    });

    const message =
      winner === "Black" && reason === "safe_pawn_promoted"
        ? "⚫ Black wins — a pawn reached the promotion!"
        : winner === "Black" && reason === "rook_captured"
        ? "⚫ Black wins — the Rook has been captured!"
        : "⚪ White wins — all pawns have been taken!";

    console.log(`🏰 Bástyaharc vége: ${message} (room: ${room})`);
    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  rooms.set(room, game);
  await saveRooms(rooms);
  return;
}


// --- FUTÓHARC LOGIKA (Bishop vs 3 Pawns) ---
if (game.gameType === "futoharc") {
  game.board = board;
  game.hasMoved[playerId] = true;
  game.turnColor = playerColor === "white" ? "black" : "white";

  socket.to(room).emit("move", {
    board: game.board,
    turnColor: game.turnColor,
  });

  let bishopAlive = false;
  let pawns = [];

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const p = board[i][j];
      if (p === "B") bishopAlive = true;
      if (p === "p") pawns.push([i, j]);
    }
  }

  let winner = null;
  let reason = "";

  if (!bishopAlive) {
    winner = "Black";
    reason = "bishop_captured";
  }

  if (pawns.length === 0) {
    winner = "White";
    reason = "all_pawns_captured";
  }

  if (!winner) {
    for (const [i, j] of pawns) {
      if (i === 7) {
        let safe = true;
        const dirs = [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ];
        for (const [dx, dy] of dirs) {
          for (let k = 1; k < 8; k++) {
            const x = i + dx * k;
            const y = j + dy * k;
            if (x < 0 || x > 7 || y < 0 || y > 7) break;
            if (board[x][y] === "B") safe = false;
            if (board[x][y]) break;
          }
        }
        if (safe) {
          winner = "Black";
          reason = "safe_pawn_promoted";
          break;
        }
      }
    }
  }

  if (winner) {
    io.to(room).emit("drawOrMate", {
      status: { status: "finished", winner, reason },
    });

    const message =
      winner === "Black" && reason === "safe_pawn_promoted"
        ? "⚫ Black wins — a pawn reached the promotion!"
        : winner === "Black" && reason === "bishop_captured"
        ? "⚫ Black wins — the Bishop has been captured!"
        : "⚪ White wins — all pawns have been taken!";

    console.log(`🏹 Futóharc vége: ${message} (room: ${room})`);
    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  rooms.set(room, game);
  await saveRooms(rooms);
  return;
}


// --- HUSZÁROK VS GYALOGOK LOGIKA (2 Knights vs 3 Pawns) ---
if (game.gameType === "huszarok_vs_gyalogok") {
  game.board = board;
  game.hasMoved[playerId] = true;
  game.turnColor = playerColor === "white" ? "black" : "white";

  socket.to(room).emit("move", {
    board: game.board,
    turnColor: game.turnColor,
  });

  let knights = [];
  let pawns = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const p = board[i][j];
      if (p === "n") knights.push([i, j]);
      if (p === "P") pawns.push([i, j]);
    }
  }

  let winner = null;
  let reason = "";

  // ha a huszárokat leütötték
  if (knights.length === 0) {
    winner = "White";
    reason = "knights_captured";
  }

  // ha minden gyalog elfogyott
  if (pawns.length === 0) {
    winner = "Black";
    reason = "all_pawns_captured";
  }

  // ha gyalog biztonságosan beér
  if (!winner) {
    for (const [i, j] of pawns) {
      if (i === 0) {
        let safe = true;
        for (const [kx, ky] of knights) {
          const moves = [
            [kx + 2, ky + 1],
            [kx + 2, ky - 1],
            [kx - 2, ky + 1],
            [kx - 2, ky - 1],
            [kx + 1, ky + 2],
            [kx + 1, ky - 2],
            [kx - 1, ky + 2],
            [kx - 1, ky - 2],
          ];
          for (const [mx, my] of moves) {
            if (mx === i && my === j) safe = false;
          }
        }
        if (safe) {
          winner = "White";
          reason = "safe_pawn_promoted";
          break;
        }
      }
    }
  }

  if (winner) {
    io.to(room).emit("drawOrMate", {
      status: { status: "finished", winner, reason },
    });

    const message =
      winner === "White" && reason === "safe_pawn_promoted"
        ? "⚪ White wins — a pawn reached the promotion!"
        : winner === "White" && reason === "knights_captured"
        ? "⚪ White wins — both Knights have been captured!"
        : "⚫ Black wins — all pawns have been taken!";

    console.log(`🐴 Huszárharc vége: ${message} (room: ${room})`);
    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  rooms.set(room, game);
  await saveRooms(rooms);
  return;
}



// --- VEZÉR VS HUSZÁR LOGIKA ---
if (game.gameType === "queen_vs_knight") {
  game.board = board;
  game.hasMoved[playerId] = true;
  game.turnColor = playerColor === "white" ? "black" : "white";

  socket.to(room).emit("move", {
    board: game.board,
    turnColor: game.turnColor,
  });

  let queenAlive = false;
  let knightAlive = false;

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const p = board[i][j];
      if (p === "q") queenAlive = true;
      if (p === "N") knightAlive = true;
    }
  }

  let winner = null;
  let reason = "";

  if (!queenAlive) {
    winner = "Black";
    reason = "queen_captured";
  } else if (!knightAlive) {
    winner = "White";
    reason = "knight_captured";
  }

  if (winner) {
    io.to(room).emit("drawOrMate", {
      status: { status: "finished", winner, reason },
    });

    const message =
      winner === "White"
        ? "⚪ White wins — the Knight has been captured!"
        : "⚫ Black wins — the Queen has been captured!";

    console.log(`👑♞ Vezér–Huszár vége: ${message} (room: ${room})`);
    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  rooms.set(room, game);
  await saveRooms(rooms);
  return;
}


// --- KIRÁLYVADÁSZAT LOGIKA (világos vs egy király) ---
if (isKingHunt) {
  game.board = board;
  game.hasMoved[playerId] = true;
  game.turnColor = playerColor === "white" ? "black" : "white";

  socket.to(room).emit("move", {
    board: game.board,
    turnColor: game.turnColor,
  });

  // fekete király pozíció keresése
  let blackKingPos = null;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (board[i][j] === "k") blackKingPos = [i, j];
    }
  }

  // ha nincs király (extrém eset)
  if (!blackKingPos) {
    io.to(room).emit("drawOrMate", {
      status: { status: "finished", winner: "White", reason: "checkmate" },
    });
    console.log("👑 King Hunt vége: White wins (king removed)");
    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  // sakkban van-e
  const inCheck = (() => {
    const [kx, ky] = blackKingPos;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const p = board[i][j];
        if (!p || p === "k" || p === "K") continue;
        if (p === p.toUpperCase()) {
          const moves = getRawMoves(board, i, j);
          for (const [x, y] of moves) {
            if (x === kx && y === ky) return true;
          }
        }
      }
    }
    return false;
  })();

  // tud-e lépni
  const [kx, ky] = blackKingPos;
  let canMove = false;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const x = kx + dx, y = ky + dy;
      if (x < 0 || x > 7 || y < 0 || y > 7) continue;
      const target = board[x][y];
      if (!target || target === target.toUpperCase()) {
        const test = board.map((r) => [...r]);
        test[kx][ky] = null;
        test[x][y] = "k";
        // ha az új pozícióban nincs sakkban, akkor tud lépni
        if (!isKingInCheck(test, false)) canMove = true;
      }
    }
  }

  if (!canMove) {
    if (inCheck) {
      io.to(room).emit("drawOrMate", {
        status: { status: "finished", winner: "White", reason: "checkmate" },
      });
      console.log("♔ King Hunt vége: White wins by checkmate");
    } else {
      io.to(room).emit("drawOrMate", {
        status: { status: "finished", winner: "Draw", reason: "stalemate" },
      });
      console.log("🕊️ King Hunt vége: stalemate (patt)");
    }
    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  rooms.set(room, game);
  await saveRooms(rooms);
  return;
}


// --- ACTIVE CHESS LOGIKA (9x8-as tábla, bővített sakk) ---
if (game.gameType === "active_chess") {
  game.board = board;
  game.hasMoved[playerId] = true;
  game.turnColor = playerColor === "white" ? "black" : "white";

  socket.to(room).emit("move", {
    board: game.board,
    turnColor: game.turnColor,
  });

  const height = board.length;
  const width = board[0].length;

  // --- Királyok keresése ---
  let whiteKing = false;
  let blackKing = false;
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (board[i][j] === "K") whiteKing = true;
      if (board[i][j] === "k") blackKing = true;
    }
  }

  if (!whiteKing || !blackKing) {
    const winner = !whiteKing ? "Black" : "White";
    io.to(room).emit("drawOrMate", {
      status: { status: "checkmate", winner },
    });
    console.log(`♜ Active Chess vége: ${winner} nyert (király leütve)`);
    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  // --- Patt vagy matt detektálás ---
  const inCheck = (colorWhite) => {
    const kingSymbol = colorWhite ? "K" : "k";
    let kingPos = null;
    for (let i = 0; i < height; i++)
      for (let j = 0; j < width; j++)
        if (board[i][j] === kingSymbol) kingPos = [i, j];
    if (!kingPos) return false;

    const [kx, ky] = kingPos;
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const p = board[i][j];
        if (!p) continue;
        if ((colorWhite && p === p.toUpperCase()) || (!colorWhite && p === p.toLowerCase())) continue;
        const moves = getRawMoves(board, i, j, null, "active_chess");
        for (const [x, y] of moves)
          if (x === kx && y === ky) return true;
      }
    }
    return false;
  };

  const whiteInCheck = inCheck(true);
  const blackInCheck = inCheck(false);

  // --- Tud-e lépni az aktuális fél ---
  let hasMove = false;
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const p = board[i][j];
      if (!p) continue;
      if (
        (game.turnColor === "white" && p === p.toUpperCase()) ||
        (game.turnColor === "black" && p === p.toLowerCase())
      ) {
        const moves = getRawMoves(board, i, j, null, "active_chess");
        if (moves.length > 0) {
          hasMove = true;
          break;
        }
      }
    }
    if (hasMove) break;
  }

if (!hasMove) {
  let status;
  const colorWhite = game.turnColor === "white";
  const inCheckNow = isKingInCheck(board, colorWhite, "active_chess");

  if (inCheckNow)
    status = { status: "checkmate", winner: colorWhite ? "Black" : "White" };
  else
    status = { status: "stalemate" };


    io.to(room).emit("drawOrMate", { status });
    console.log(
      `♟️ Active Chess vége: ${status.status === "checkmate" ? "Matt" : "Patt"} — ${status.winner || "Döntetlen"}`
    );

    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  rooms.set(room, game);
  await saveRooms(rooms);
  return;
}



// --- FARAWAY CHESS LOGIKA (8x9-es tábla, alap sakk szabályokkal) ---
if (game.gameType === "faraway_chess") {
  game.board = board;
  game.hasMoved[playerId] = true;
  game.turnColor = playerColor === "white" ? "black" : "white";

  socket.to(room).emit("move", {
    board: game.board,
    turnColor: game.turnColor,
  });

  // ugyanazt a státuszellenőrzést használd, mint a normál sakk
  const height = board.length;
  const width = board[0].length;

  let whiteKing = false;
  let blackKing = false;
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (board[i][j] === "K") whiteKing = true;
      if (board[i][j] === "k") blackKing = true;
    }
  }

  if (!whiteKing || !blackKing) {
    const winner = !whiteKing ? "Black" : "White";
    io.to(room).emit("drawOrMate", {
      status: { status: "checkmate", winner },
    });
    console.log(`♜ Faraway Chess vége: ${winner} nyert (király leütve)`);
    rooms.set(room, game);
    await saveRooms(rooms);
    return;
  }

  rooms.set(room, game);
  await saveRooms(rooms);
  return;
}



      // --- EREDTI SAKK-LOGIKA ---
      if (move && move.piece && move.piece.toLowerCase() === "p") {
        const diff = Math.abs(move.fromRow - move.toRow);
        if (diff === 2) {
          game.enPassantTarget = { row: (move.fromRow + move.toRow) / 2, col: move.fromCol };
        } else {
          game.enPassantTarget = null;
        }
      } else {
        game.enPassantTarget = null;
      }

      game.board = board;
      game.hasMoved[playerId] = true;
      game.turnColor = playerColor === "white" ? "black" : "white";

      let captured = false;
      if (previousBoard && move && typeof move.toRow === "number" && typeof move.toCol === "number") {
        const prevTarget = previousBoard[move.toRow]?.[move.toCol];
        if (prevTarget) captured = true;
      }
      if ((move && move.piece && move.piece.toLowerCase() === "p") || captured) {
        game.halfmoveClock = 0;
      } else {
        game.halfmoveClock = (game.halfmoveClock || 0) + 1;
      }

      const positionKey = JSON.stringify({
        board: game.board,
        turnColor: game.turnColor,
        enPassantTarget: game.enPassantTarget,
      });
      game.positionHistory.push(positionKey);

      const repetitionCount = game.positionHistory.filter((p) => p === positionKey).length;

      if (repetitionCount >= 3 && !game.threefoldDeclared) {
        game.threefoldDeclared = true;
        io.to(room).emit("threefoldRepetition", {
          room,
          status: "threefold",
          message: "Háromszori állásismétlés – döntetlen kérhető!",
          positionKey,
          repetitionCount,
        });
      }

      if ((game.halfmoveClock || 0) >= 100 && !game.fiftyDeclared) {
        game.fiftyDeclared = true;
        io.to(room).emit("fiftyMoveRule", {
          room,
          status: "fifty-move-rule",
          message: "Ötven lépés szabálya teljesült – döntetlen kérhető!",
          halfmoveClock: game.halfmoveClock,
        });
      }

      socket.to(room).emit("move", {
        board: game.board,
        enPassantTarget: game.enPassantTarget,
        turnColor: game.turnColor,
        halfmoveClock: game.halfmoveClock || 0,
      });

      const allMoved = game.players.every((p) => game.hasMoved[p.id]);
      if (allMoved) {
        game.hasMoved = {};
        game.enPassantTarget = null;
      }

      rooms.set(room, game);
      await saveRooms(rooms);
    });

    // --- DISCONNECT ---
    socket.on("disconnect", async () => {
      console.log(`${socket.data.username || socket.id} disconnected`);

      rooms.forEach((room, roomId) => {
        const stillInRoom = room.players.filter((p) => p.id !== socket.id);

        if (stillInRoom.length < room.players.length) {
          if (stillInRoom.length === 0) {
            rooms.delete(roomId);
          } else {
            rooms.set(roomId, { ...room, players: stillInRoom });
            stillInRoom.forEach((p) => {
              io.to(p.id).emit("playerDisconnected", {
                username: socket.data.username || socket.id,
              });
            });
          }
        }
      });

      await saveRooms(rooms);
    });
  });

  // FONTOS: IPv4 bind, hogy ne ütközz az IPv6-only dual-stack változással
  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ Listening on 0.0.0.0:${port}`);
  });
})();
