// server.js
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
      const roomId = uuidV4();
      await socket.join(roomId);
      rooms.set(roomId, {
        roomId,
        players: [
          { id: socket.id, username: socket.data?.username, color: "white" },
        ],
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
      callback(roomId);
      console.log(`🆕 Room created: ${roomId} (${gameType})`);
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

      if (game.players.length < 2) {
        io.to(playerId).emit(
          "errorMessage",
          "Mindkét játékosnak csatlakoznia kell, mielőtt léphettek."
        );
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

        // --- Győzelem: ha gyalog beért az alapsorra vagy az ellenfél összes gyalogját leütötték ---
        const whiteReached = board[0]?.some((p) => p === "P");
        const blackReached = board[7]?.some((p) => p === "p");

        let whitePawns = 0;
        let blackPawns = 0;
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            if (board[i][j] === "P") whitePawns++;
            if (board[i][j] === "p") blackPawns++;
          }
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

        // --- Ha a következő játékos nem tud lépni, a másik nyer ---
        const nextIsWhite = game.turnColor === "white";
        let canMove = false;
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (!piece) continue;
            const isWhitePiece = piece === piece.toUpperCase();
            if (isWhitePiece !== nextIsWhite) continue;

            const dir = isWhitePiece ? -1 : 1;
            const ahead = board[i + dir]?.[j];
            if (ahead === null) canMove = true;

            for (const dy of [-1, 1]) {
              const x = i + dir;
              const y = j + dy;
              if (x >= 0 && x < 8 && y >= 0 && y < 8) {
                const t = board[x][y];
                if (t && (isWhitePiece !== (t === t.toUpperCase()))) canMove = true;
              }
            }
          }
        }

        if (!canMove) {
          const winner = nextIsWhite ? "Black" : "White";
          io.to(room).emit("drawOrMate", {
            status: { status: "finished", winner },
          });
          console.log(`🪖 Parasztháború vége: ${winner} nyert (ellenfél nem tud lépni)`);

          rooms.set(room, game);
          await saveRooms(rooms);
          return; // <<< Itt a kulcs: megállítja a további kódot
        }

        rooms.set(room, game);
        await saveRooms(rooms);
        return;
      }

      // --- EREDTI SAKK-LOGIKA ---
      if (move && move.piece && move.piece.toLowerCase() === "p") {
        const diff = Math.abs(move.fromRow - move.toRow);
        if (diff === 2) {
          game.enPassantTarget = {
            row: (move.fromRow + move.toRow) / 2,
            col: move.fromCol,
          };
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
      console.log(`${socket.data.username} disconnected`);

      rooms.forEach((room, roomId) => {
        const stillInRoom = room.players.filter((p) => p.id !== socket.id);

        if (stillInRoom.length < room.players.length) {
          if (stillInRoom.length === 0) {
            rooms.delete(roomId);
          } else {
            rooms.set(roomId, { ...room, players: stillInRoom });
            stillInRoom.forEach((p) => {
              io.to(p.id).emit("playerDisconnected", {
                username: socket.data.username,
              });
            });
          }
        }
      });

      await saveRooms(rooms);
    });
  });

  server.listen(port, () => {
    console.log(`✅ Listening on *:${port}`);
  });
})();
