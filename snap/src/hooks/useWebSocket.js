import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3001"; 
export function useWebSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [syncedState, setSyncedState] = useState({
    starPosition: { x: 0, y: 0 },
    pulseActive: false,
    snapCount: 0,
    countdown: null,
  });

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    const socket = socketRef.current;

    // Connection handlers
    socket.on("connect", () => {
      console.log("Connected to WebSocket server");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
      setIsConnected(false);
    });

    // Sync initial state
    socket.on("sync-state", (state) => {
      console.log("Received initial state:", state);
      setSyncedState(state);
    });

    // Listen for pulse triggers
    socket.on("pulse-triggered", () => {
      if (window.triggerPulse) {
        window.triggerPulse();
      }
    });

    // Listen for position updates
    socket.on("position-updated", (position) => {
      if (window.setStarPosition) {
        window.setStarPosition(position.x, position.y);
      }
    });

    // Listen for snap updates
    socket.on("snap-updated", (snapData) => {
      setSyncedState((prev) => ({ ...prev, snapCount: snapData.count }));
    });

    // Listen for countdown start
    socket.on("countdown-started", () => {
      setSyncedState((prev) => ({ ...prev, countdown: 3 }));
    });

    // Listen for state reset
    socket.on("state-reset", (state) => {
      setSyncedState(state);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // Functions to emit events
  const triggerPulse = () => {
    socketRef.current?.emit("trigger-pulse");
  };

  const updatePosition = (x, y) => {
    socketRef.current?.emit("update-position", { x, y });
  };

  const snapDetected = (count) => {
    socketRef.current?.emit("snap-detected", { count });
  };

  const startCountdown = () => {
    socketRef.current?.emit("start-countdown");
  };

  const resetState = () => {
    socketRef.current?.emit("reset-state");
  };

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
