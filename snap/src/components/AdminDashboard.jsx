import React, { useState, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export default function AdminDashboard() {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { resetState, syncedState, isConnected } = useWebSocket();

  // Admin password (in production, use environment variable)
  const ADMIN_PASSWORD = "caias2025";

  useEffect(() => {
    // Keyboard shortcut: Press Ctrl + Shift + A to open admin panel
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setIsOpen(true);
      }

      // Close on Escape
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert("Incorrect password");
      setPassword("");
    }
  };

  const handleReset = () => {
    if (
      window.confirm(
        "⚠️ Reset all devices? This will clear snap count and reset state."
      )
    ) {
      resetState();
      alert("✅ State reset successfully! All devices will sync.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          width: "50px",
          height: "50px",
          background: "rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 1000,
          transition: "all 0.3s ease",
          backdropFilter: "blur(10px)",
        }}
        onMouseEnter={(e) => {
          e.target.style.background = "rgba(255, 183, 43, 0.3)";
          e.target.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "rgba(0, 0, 0, 0.3)";
          e.target.style.transform = "scale(1)";
        }}
        title="Admin Panel (Ctrl+Shift+A)"
      >
        <span style={{ fontSize: "20px" }}>🔧</span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #001a33, #024b6e)",
          border: "2px solid #ffb72b",
          borderRadius: "20px",
          padding: "40px",
          minWidth: "400px",
          boxShadow: "0 20px 60px rgba(255, 183, 43, 0.3)",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          style={{
            position: "absolute",
            top: "15px",
            right: "15px",
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: "24px",
            cursor: "pointer",
            padding: "5px 10px",
          }}
        >
          ×
        </button>

        <h2
          style={{
            color: "#ffb72b",
            marginTop: 0,
            marginBottom: "20px",
            textAlign: "center",
            fontSize: "28px",
          }}
        >
          🔐 Admin Control Panel
        </h2>

        {!isAuthenticated ? (
          <form onSubmit={handleLogin} style={{ marginTop: "30px" }}>
            <label
              style={{ color: "#fff", display: "block", marginBottom: "10px" }}
            >
              Admin Password:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #ffb72b",
                background: "rgba(0, 0, 0, 0.3)",
                color: "#fff",
                fontSize: "16px",
                marginBottom: "20px",
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #ffb72b, #ff9500)",
                border: "none",
                borderRadius: "8px",
                color: "#000",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            >
              🔓 Unlock
            </button>
            <p
              style={{
                color: "rgba(255, 255, 255, 0.5)",
                fontSize: "12px",
                marginTop: "15px",
                textAlign: "center",
              }}
            >
              Hint: Default password is "caias2025"
            </p>
          </form>
        ) : (
          <div>
            {/* Server Status */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                padding: "20px",
                borderRadius: "10px",
                marginBottom: "20px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <h3 style={{ color: "#fff", marginTop: 0, fontSize: "18px" }}>
                Server Status
              </h3>
              <div
                style={{ color: "#fff", fontSize: "14px", lineHeight: "1.8" }}
              >
                <div>
                  Connection:{" "}
                  <span
                    style={{
                      color: isConnected ? "#00ff00" : "#ff0000",
                      fontWeight: "bold",
                    }}
                  >
                    {isConnected ? "✅ ONLINE" : "❌ OFFLINE"}
                  </span>
                </div>
                <div>
                  Snap Count: <strong>{syncedState.snapCount}/4</strong>
                </div>
                <div>
                  Countdown:{" "}
                  {syncedState.countdownActive ? "🚀 Active" : "⏸️ Inactive"}
                </div>
                <div>
                  Position: X: {Math.round(syncedState.starPosition?.x || 0)},
                  Y: {Math.round(syncedState.starPosition?.y || 0)}
                </div>
              </div>
            </div>

            {/* Control Buttons */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <button
                onClick={handleReset}
                disabled={!isConnected}
                style={{
                  padding: "15px",
                  background: isConnected
                    ? "linear-gradient(135deg, #ff6b6b, #ff4444)"
                    : "rgba(100, 100, 100, 0.3)",
                  border: "none",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: isConnected ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}
                onMouseEnter={(e) => {
                  if (isConnected) e.target.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
              >
                🔄 Reset All Devices
              </button>

              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "12px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.background = "rgba(255, 255, 255, 0.2)")
                }
                onMouseLeave={(e) =>
                  (e.target.style.background = "rgba(255, 255, 255, 0.1)")
                }
              >
                🔃 Reload This Device
              </button>

              <button
                onClick={handleLogout}
                style={{
                  padding: "12px",
                  background: "transparent",
                  border: "1px solid #ffb72b",
                  borderRadius: "8px",
                  color: "#ffb72b",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255, 183, 43, 0.2)";
                }}
                onMouseLeave={(e) =>
                  (e.target.style.background = "transparent")
                }
              >
                🔒 Lock & Close
              </button>
            </div>

            {/* Info */}
            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                background: "rgba(255, 183, 43, 0.1)",
                border: "1px solid rgba(255, 183, 43, 0.3)",
                borderRadius: "8px",
                color: "#ffb72b",
                fontSize: "12px",
                lineHeight: "1.6",
              }}
            >
              <strong>💡 Tip:</strong> Use this panel to reset the demo between
              presentations. All connected devices will sync automatically.
            </div>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
