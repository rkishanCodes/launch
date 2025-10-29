const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// PERSISTENT STATE
let globalState = {
  starPosition: { x: 0, y: 0 },
  pulseActive: false,
  snapCount: 0,
  countdownActive: false,
  lastSnapTime: 0,
};

// Auto-reset snap count after inactivity
setInterval(() => {
  const now = Date.now();
  if (globalState.snapCount > 0 && now - globalState.lastSnapTime > 5000) {
    console.log("🔄 Auto-resetting snap count (5s inactivity)");
    globalState.snapCount = 0;
    io.emit("snap-updated", { count: 0, reset: true });
  }
}, 1000);

io.on("connection", (socket) => {
  console.log(
    `✅ Client connected: ${socket.id} (Total: ${io.engine.clientsCount})`
  );

  // Send current state to new client
  socket.emit("sync-state", globalState);

  // Pulse trigger
  socket.on("trigger-pulse", () => {
    console.log("💥 Pulse triggered");
    globalState.pulseActive = true;
    io.emit("pulse-triggered");

    setTimeout(() => {
      globalState.pulseActive = false;
    }, 2000);
  });

  // Position update
  socket.on("update-position", (position) => {
    globalState.starPosition = position;
    socket.broadcast.emit("position-updated", position);
  });

  // Snap detection
  socket.on("snap-detected", (snapData) => {
    const now = Date.now();

    if (now - globalState.lastSnapTime > 3000) {
      globalState.snapCount = 0;
    }

    globalState.snapCount = snapData.count;
    globalState.lastSnapTime = now;

    console.log(`🫰 Snap: ${globalState.snapCount}/4`);
    io.emit("snap-updated", { count: globalState.snapCount });

    // Trigger countdown at 4 snaps
    if (globalState.snapCount >= 4) {
      console.log("🚀 4 snaps! Starting countdown...");
      globalState.countdownActive = true;
      io.emit("countdown-started");

      // AUTO-RESET after redirect completes (6 seconds)
      // Countdown = 3s, Launch animation = 2.5s, Buffer = 0.5s
      setTimeout(() => {
        console.log("🔄 AUTO-RESET: Clearing state after redirect");
        globalState = {
          starPosition: { x: 0, y: 0 },
          pulseActive: false,
          snapCount: 0,
          countdownActive: false,
          lastSnapTime: 0,
        };
        io.emit("state-reset", globalState);
        console.log("✨ State cleared - Ready for next demo!");
      }, 6000); // 6 seconds total
    }
  });

  // Manual countdown start
  socket.on("start-countdown", () => {
    console.log("🚀 Manual countdown started");
    globalState.countdownActive = true;
    globalState.snapCount = 0;
    io.emit("countdown-started");

    // AUTO-RESET after manual countdown too
    setTimeout(() => {
      console.log("🔄 AUTO-RESET: Clearing state after manual countdown");
      globalState = {
        starPosition: { x: 0, y: 0 },
        pulseActive: false,
        snapCount: 0,
        countdownActive: false,
        lastSnapTime: 0,
      };
      io.emit("state-reset", globalState);
    }, 6000);
  });

  // Manual admin reset
  socket.on("reset-state", () => {
    console.log("🔧 Admin manual reset");
    globalState = {
      starPosition: { x: 0, y: 0 },
      pulseActive: false,
      snapCount: 0,
      countdownActive: false,
      lastSnapTime: 0,
    };
    io.emit("state-reset", globalState);
  });

  socket.on("disconnect", () => {
    console.log(
      `❌ Client disconnected: ${socket.id} (Remaining: ${
        io.engine.clientsCount - 1
      })`
    );
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`⏰ Server time: ${new Date().toISOString()}`);
});
