const express = require('express');
const { Server } = require("socket.io");
const { v4: uuidV4 } = require('uuid');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;

// Engedélyezzük a CORS-t az Express-nek is
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
}));

// Socket.IO szerver, helyes CORS beállítással
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"]
});


const rooms = new Map();

io.on('connection', (socket) => {
  console.log(socket.id, 'connected');

  socket.on('username', (username) => {
    console.log('username:', username);
    socket.data.username = username;
  });

  socket.on('createRoom', async (callback) => {
    const roomId = uuidV4();
    await socket.join(roomId);
    rooms.set(roomId, {
      roomId,
      players: [{ id: socket.id, username: socket.data?.username }]
    });
    callback(roomId);
  });

  socket.on('joinRoom', async (args, callback) => {
    const room = rooms.get(args.roomId);
    let error, message;

    if (!room) {
      error = true; message = 'room does not exist';
    } else if (room.players.length <= 0) {
      error = true; message = 'room is empty';
    } else if (room.players.length >= 2) {
      error = true; message = 'room is full';
    }

    if (error) {
      if (callback) callback({ error, message });
      return;
    }

    await socket.join(args.roomId);

    const roomUpdate = {
      ...room,
      players: [
        ...room.players,
        { id: socket.id, username: socket.data?.username },
      ],
    };

    rooms.set(args.roomId, roomUpdate);

    callback(roomUpdate);
    socket.to(args.roomId).emit('opponentJoined', roomUpdate);
  });

  // socket.on('move', (data) => {
  //   socket.to(data.room).emit('move', data.move);
  // });

  socket.on("move", (data) => {
  // broadcast to other player
  socket.to(data.room).emit("move", {
    move: data.move,
    fen: data.fen, // <<< küldjük az új FEN-t is
  });
});


  // 💡 Itt a disconnect esemény
  socket.on("disconnect", () => {
    console.log(`${socket.data.username} disconnected`);
    
    rooms.forEach((room) => {
      if (room.players.find(p => p.id === socket.id)) {
        socket.to(room.roomId).emit("playerDisconnected", {
          id: socket.id,
          username: socket.data.username
        });
      }
    });
  });

});

server.listen(port, () => {
  console.log(`✅ Listening on *:${port}`);
});
