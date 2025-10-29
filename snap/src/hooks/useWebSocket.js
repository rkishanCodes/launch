import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "launch-production-4d52.up.railway.app";

export function useWebSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [syncedState, setSyncedState] = useState({
    starPosition: { x: 0, y: 0 },
    pulseActive: false,
    snapCount: 0,
    countdownActive: false,
  });

  useEffect(() => {
    console.log("Connecting to WebSocket server:", SOCKET_URL);

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("✅ Connected to WebSocket server:", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected from WebSocket server:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setIsConnected(false);
    });

    socket.on("sync-state", (state) => {
      console.log("📥 Received server state:", state);
      setSyncedState(state);
    });

    socket.on("pulse-triggered", () => {
      console.log("💥 Pulse triggered from another device");
      if (window.triggerPulse) {
        window.triggerPulse();
      }
    });

    socket.on("position-updated", (position) => {
      console.log("📍 Position updated:", position);
      if (window.setStarPosition) {
        window.setStarPosition(position.x, position.y);
      }
    });

    socket.on("snap-updated", (snapData) => {
      console.log("🫰 Snap count updated:", snapData);
      setSyncedState((prev) => ({
        ...prev,
        snapCount: snapData.count,
      }));
    });

    socket.on("countdown-started", () => {
      console.log("🚀 Countdown started!");
      setSyncedState((prev) => ({
        ...prev,
        countdownActive: true,
        snapCount: 0,
      }));
    });

    // IMPORTANT FIX: Listen for state-reset and dispatch custom event
    socket.on("state-reset", (state) => {
      console.log("🔄 State reset received from server:", state);
      setSyncedState(state);

      // Dispatch custom event for HandTracking to listen to
      window.dispatchEvent(
        new CustomEvent("websocket-state-reset", { detail: state })
      );
    });

    return () => {
      console.log("Disconnecting socket...");
      socket.disconnect();
    };
  }, []);

  const triggerPulse = useCallback(() => {
    console.log("Emitting pulse trigger...");
    socketRef.current?.emit("trigger-pulse");
  }, []);

  const updatePosition = useCallback((x, y) => {
    socketRef.current?.emit("update-position", { x, y });
  }, []);

  const snapDetected = useCallback((count) => {
    console.log(`Emitting snap detected: ${count}/4`);
    socketRef.current?.emit("snap-detected", { count });
  }, []);

  const startCountdown = useCallback(() => {
    console.log("Emitting countdown start...");
    socketRef.current?.emit("start-countdown");
  }, []);

  const resetState = useCallback(() => {
    console.log("Emitting state reset...");
    socketRef.current?.emit("reset-state");
  }, []);

  return {
    isConnected,
    syncedState,
    triggerPulse,
    updatePosition,
    snapDetected,
    startCountdown,
    resetState,
  };
}
