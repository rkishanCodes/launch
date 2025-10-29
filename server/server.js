const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());


app.get("/", (req, res) => {
  res.send("✅ WebSocket server is running!");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, specify your domain
    methods: ["GET", "POST"],
  },
});

let currentState = {
  starPosition: { x: 0, y: 0 },
  pulseActive: false,
  snapCount: 0,
  countdown: null,
};

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current state to newly connected client
  socket.emit("sync-state", currentState);

  // Broadcast pulse trigger to all clients
  socket.on("trigger-pulse", () => {
    console.log("Pulse triggered");
    currentState.pulseActive = true;
    io.emit("pulse-triggered");

    // Reset pulse state after animation
    setTimeout(() => {
      currentState.pulseActive = false;
    }, 2000);
  });

  // Broadcast star position changes
  socket.on("update-position", (position) => {
    currentState.starPosition = position;
    socket.broadcast.emit("position-updated", position);
  });

  // Broadcast snap detection
  socket.on("snap-detected", (snapData) => {
    console.log(`Snap detected: ${snapData.count}/4`);
    currentState.snapCount = snapData.count;
    io.emit("snap-updated", snapData);
  });

  // Broadcast countdown start
  socket.on("start-countdown", () => {
    console.log("Countdown started");
    currentState.countdown = 3;
    io.emit("countdown-started");
  });

  // Reset state (optional, for admin control)
  socket.on("reset-state", () => {
    currentState = {
      starPosition: { x: 0, y: 0 },
      pulseActive: false,
      snapCount: 0,
      countdown: null,
    };
    io.emit("state-reset", currentState);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
