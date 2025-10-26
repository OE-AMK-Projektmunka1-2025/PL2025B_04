const express = require('express');
const { Server } = require("socket.io");
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

// --- Segédfüggvények a rooms kezeléséhez ---
async function loadRooms() {
  const saved = await storage.getItem("rooms");
  return saved ? new Map(saved) : new Map();
}

async function saveRooms(rooms) {
  await storage.setItem("rooms", Array.from(rooms.entries()));
}

// --- Fő async indítás ---
(async () => {
  await storage.init({
    dir: "data",
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: "utf8",
  });

  // Betöltjük a rooms-okat
  let rooms = await loadRooms();
  console.log("✅ Rooms loaded from storage:", rooms.size);

  // --- SOCKET.IO események ---
  io.on('connection', (socket) => {
    console.log(socket.id, 'connected');

    socket.on('username', (username) => {
      socket.data.username = username;
    });

    socket.on('createRoom', async (callback) => {
      const roomId = uuidV4();
      await socket.join(roomId);
      rooms.set(roomId, {
        roomId,
        players: [{ id: socket.id, username: socket.data?.username }]
      });

      await saveRooms(rooms);
      callback(roomId);
    });

    socket.on('joinRoom', async (args, callback) => {
      const room = rooms.get(args.roomId);
      let error, message;

      if (!room) {
        error = true; message = 'room does not exist';
      } else if (room.players.length >= 2) {
        error = true; message = 'room is full';
      }

      if (error) {
        if (callback) callback({ error, message });
        return;
      }

      await socket.join(args.roomId);
      const updatedRoom = {
        ...room,
        players: [
          ...room.players,
          { id: socket.id, username: socket.data?.username },
        ],
      };
      rooms.set(args.roomId, updatedRoom);
      await saveRooms(rooms);

      callback(updatedRoom);
      socket.to(args.roomId).emit('opponentJoined', updatedRoom);
    });

    socket.on("move", (data) => {
      socket.to(data.room).emit("move", {
        move: data.move,
        fen: data.fen,
      });
    });

   socket.on("disconnect", async () => {
  console.log(`${socket.data.username} disconnected`);
  
  rooms.forEach((room, roomId) => {
    const stillInRoom = room.players.filter(p => p.id !== socket.id);

    if (stillInRoom.length < room.players.length) {
      if (stillInRoom.length === 0) {
        rooms.delete(roomId);
      } else {
        rooms.set(roomId, { ...room, players: stillInRoom });

        // 🔔 Értesítjük a bent maradt játékost
        stillInRoom.forEach(p => {
          io.to(p.id).emit("playerDisconnected", { username: socket.data.username });
        });
      }
    }
  });

  await saveRooms(rooms);
  });

})

  server.listen(port, () => {
    console.log(`✅ Listening on *:${port}`);
  });
})();
