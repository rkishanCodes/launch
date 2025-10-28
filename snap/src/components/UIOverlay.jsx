import React from "react";

export default function UIOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        left: "20px",
        color: "#ffffff",
        zIndex: 100,
        pointerEvents: "none",
        background: "rgba(255, 255, 255, 0.1)",
        padding: "15px 20px",
        borderRadius: "12px",
        backdropFilter: "blur(15px)",
        WebkitBackdropFilter: "blur(15px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
      }}
    >
      <h3
        style={{
          margin: "0 0 10px 0",
          fontWeight: 700,
          color: "#fff",
          textShadow: "0 0 5px rgba(255, 255, 255, 0.5)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
          paddingBottom: "8px",
        }}
      >
        Stellar Flare
      </h3>
      <div
        style={{
          margin: "8px 0",
          opacity: 0.9,
          fontSize: "14px",
          textShadow: "0 0 4px rgba(255, 255, 255, 0.4)",
        }}
      >
        <kbd
          style={{
            display: "inline-block",
            padding: "3px 6px",
            fontFamily: "Inter, sans-serif",
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: "4px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "#fff",
            fontSize: "13px",
            marginRight: "8px",
          }}
        >
          ✊
        </kbd>
        Fist: Trigger Stellar Pulse
      </div>
      <div
        style={{
          margin: "8px 0",
          opacity: 0.9,
          fontSize: "14px",
          textShadow: "0 0 4px rgba(255, 255, 255, 0.4)",
        }}
      >
        <kbd
          style={{
            display: "inline-block",
            padding: "3px 6px",
            fontFamily: "Inter, sans-serif",
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: "4px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "#fff",
            fontSize: "13px",
            marginRight: "8px",
          }}
        >
          🙌
        </kbd>
        Two Hands: Navigate Star
      </div>
      <div
        style={{
          margin: "8px 0",
          opacity: 0.9,
          fontSize: "14px",
          textShadow: "0 0 4px rgba(255, 255, 255, 0.4)",
        }}
      >
        <kbd
          style={{
            display: "inline-block",
            padding: "3px 6px",
            fontFamily: "Inter, sans-serif",
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: "4px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "#fff",
            fontSize: "13px",
            marginRight: "8px",
          }}
        >
          🫰
        </kbd>
        Snap 4x: Redirect to CAIAS
      </div>
    </div>
  );
}
