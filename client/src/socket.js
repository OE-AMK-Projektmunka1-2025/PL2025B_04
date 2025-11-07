import { io } from "socket.io-client";

const socket = io("http://54.38.157.7:8080", {
  transports: ["websocket"],
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("✅ Connected to server:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("❌ Socket connection error:", err.message);
});

export default socket;
