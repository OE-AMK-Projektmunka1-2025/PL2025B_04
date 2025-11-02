const express = require('express');
const { Server } = require('socket.io');
const { v4: uuidV4 } = require('uuid');
const http = require('http');
const cors = require('cors');
const storage = require('node-persist');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"]
});

// --- Helper functions ---
async function loadRooms() {
  const saved = await storage.getItem("rooms");
  return saved ? new Map(saved) : new Map();
}

async function saveRooms(rooms) {
  await storage.setItem("rooms", Array.from(rooms.entries()));
}

// --- Main init ---
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

    socket.on("createRoom", async (callback) => {
      const roomId = uuidV4();
      await socket.join(roomId);
      rooms.set(roomId, {
        roomId,
        players: [{ id: socket.id, username: socket.data?.username, color: "white" }],
        board: null,
        turnColor: "white",
        hasMoved: {},
        enPassantTarget: null,
      });
      await saveRooms(rooms);
      callback(roomId);
      console.log(`🆕 Room created: ${roomId}`);
    });

    socket.on("joinRoom", async (args, callback) => {
      const room = rooms.get(args.roomId);
      let error, message;

      if (!room) {
        error = true; message = "room does not exist";
      } else if (room.players.length >= 2) {
        error = true; message = "room is full";
      }

      if (error) {
        if (callback) callback({ error, message });
        return;
      }

      await socket.join(args.roomId);
      const newPlayer = { id: socket.id, username: socket.data?.username, color: "black" };
      const updatedRoom = { ...room, players: [...room.players, newPlayer] };
      rooms.set(args.roomId, updatedRoom);
      await saveRooms(rooms);

      callback(updatedRoom);
      socket.to(args.roomId).emit("opponentJoined", updatedRoom);
      console.log(`👥 ${socket.data.username} joined room ${args.roomId}`);
    });

    // --- MOVE HANDLER (with correct en passant logic) ---
    socket.on("move", ({ room, board, move, playerId, enPassantTarget }) => {
      const game = rooms.get(room);
      if (!game) return;

      // Mindkét játékosnak csatlakoznia kell
      if (game.players.length < 2) {
        io.to(playerId).emit("errorMessage", "Mindkét játékosnak csatlakoznia kell, mielőtt léphettek.");
        return;
      }

      if (!game.turnColor) game.turnColor = "white";
      if (!game.hasMoved) game.hasMoved = {};
      if (!("enPassantTarget" in game)) game.enPassantTarget = null;

      const player = game.players.find(p => p.id === playerId);
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

      // --- En passant frissítése ---
      if (move && move.piece && move.piece.toLowerCase() === "p") {
        const diff = Math.abs(move.fromRow - move.toRow);
        // Ha gyalog két mezőt lépett → beállítjuk az en passant targetet
        if (diff === 2) {
          game.enPassantTarget = {
            row: (move.fromRow + move.toRow) / 2,
            col: move.fromCol
          };
        } else {
          // Ha gyalog lépett, de nem kettőt → töröljük a korábbi lehetőséget
          game.enPassantTarget = null;
        }
      } else {
        // Más báb nem hoz létre en passant lehetőséget
        game.enPassantTarget = null;
      }

      // --- Állapot frissítése ---
      game.board = board;
      game.hasMoved[playerId] = true;
      game.turnColor = playerColor === "white" ? "black" : "white";

      // --- Lépés szinkronizálása ---
      io.to(room).emit("move", {
        board: game.board,
        enPassantTarget: game.enPassantTarget,
        turnColor: game.turnColor
      });

      // --- Kör lezárása, ha mindkét játékos lépett ---
      const allMoved = game.players.every(p => game.hasMoved[p.id]);
      if (allMoved) {
        game.hasMoved = {};
        // a következő kör elején töröljük az en passant-ot, ha senki nem élt vele
        game.enPassantTarget = null;
      }

      rooms.set(room, game);
      saveRooms(rooms);
    });

    // --- DISCONNECT HANDLER ---
    socket.on("disconnect", async () => {
      console.log(`${socket.data.username} disconnected`);

      rooms.forEach((room, roomId) => {
        const stillInRoom = room.players.filter(p => p.id !== socket.id);

        if (stillInRoom.length < room.players.length) {
          if (stillInRoom.length === 0) {
            rooms.delete(roomId);
          } else {
            rooms.set(roomId, { ...room, players: stillInRoom });
            stillInRoom.forEach(p => {
              io.to(p.id).emit("playerDisconnected", { username: socket.data.username });
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
