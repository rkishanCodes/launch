import React, { useState, useEffect, useRef } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS } from "@mediapipe/hands";

// Renamed component to 'App' to match the file's default export
export default function App() {
  // --- Refs for MediaPipe and Dino ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const previousHandPositionsRef = useRef([]);
  const lastGestureTimeRef = useRef(0);
  const isManualRotatingRef = useRef(false);
  const snapCountRef = useRef(0);
  const lastSnapTimeRef = useRef(0);
  const snapStateRef = useRef("open");
  const ground1Ref = useRef(null);
  const ground2Ref = useRef(null);

  // --- State for MediaPipe and Dino ---
  const [gestureStatus, setGestureStatus] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false); // This will be triggered by MediaPipe
  const [countdown, setCountdown] = useState(3);
  const [snapCount, setSnapCount] = useState(0);
  const [snapProgress, setSnapProgress] = useState([
    false,
    false,
    false,
    false,
  ]);
  const [launching, setLaunching] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // --- Constants ---
  const gestureDebounce = 500;
  const snapDebounce = 300;
  const snapResetTime = 3000;

  // --- Helper functions for dino ground animation ---
  const setCustomProperty = (elem, prop, value) => {
    if (elem) {
      elem.style.setProperty(prop, value);
    }
  };

  const getCustomProperty = (elem, prop) => {
    if (elem) {
      return parseFloat(getComputedStyle(elem).getPropertyValue(prop)) || 0;
    }
    return 0;
  };

  const incrementCustomProperty = (elem, prop, inc) => {
    if (elem) {
      setCustomProperty(elem, prop, getCustomProperty(elem, prop) + inc + "px");
    }
  };

  // --- WebSocket code removed as the import is not available ---

  // --- MediaPipe Initialization ---
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError("Camera access is not supported in this browser.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults(onHandResults);
        handsRef.current = hands;

        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        await camera.start();
        cameraRef.current = camera;
        setCameraError(null);
      } catch (error) {
        console.error("Camera initialization error:", error);
        if (error.name === "NotAllowedError") {
          setCameraError(
            "Camera permission denied. Please allow camera access."
          );
        } else if (error.name === "NotFoundError") {
          setCameraError("No camera found.");
        } else {
          setCameraError(`Camera error: ${error.message}`);
        }
      }
    };

    initMediaPipe();

    return () => {
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {}
      }
      if (handsRef.current) {
        try {
          handsRef.current.close();
        } catch (e) {}
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // --- Countdown Logic ---
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0 && !launching) {
      // Added !launching check to prevent multiple triggers
      setLaunching(true);
      setTimeout(() => {
        // Redirecting to CAIAS as in the original logic
        window.location.href = "https://caias.in";
      }, 2500);
    }
  }, [showCountdown, countdown, launching]);

  // --- Dino Ground Animation Logic ---
  useEffect(() => {
    if (!showCountdown) return; // Only run if overlay is visible

    const groundElems = [ground1Ref.current, ground2Ref.current];
    if (!groundElems[0] || !groundElems[1]) {
      // Refs might not be ready on first render
      return;
    }

    // Initial setup from original moveGround
    setCustomProperty(
      groundElems[1],
      "--right",
      (groundElems[1].width || 600) * -1 + "px"
    );

    const interval = setInterval(() => {
      groundElems.forEach((ground) => {
        if (!ground) return;
        const groundWidth = ground.width || 600; // Fallback width
        incrementCustomProperty(ground, "--right", 1);
        if (getCustomProperty(ground, "--right") >= groundWidth) {
          incrementCustomProperty(ground, "--right", -groundWidth * 2);
        }
      });
    }, 5);

    return () => clearInterval(interval); // Cleanup interval on unmount
  }, [showCountdown]); // Rerun when overlay appears

  // --- MediaPipe Hand Tracking Functions ---

  const detectSnap = (landmarks) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2)
    );

    const currentTime = Date.now();
    const closeThreshold = 0.08;
    const openThreshold = 0.12;

    if (snapStateRef.current === "open" && distance < closeThreshold) {
      snapStateRef.current = "closed";
    } else if (snapStateRef.current === "closed" && distance > openThreshold) {
      snapStateRef.current = "open";

      if (currentTime - lastSnapTimeRef.current > snapDebounce) {
        if (currentTime - lastSnapTimeRef.current > snapResetTime) {
          snapCountRef.current = 0;
          setSnapCount(0);
          setSnapProgress([false, false, false, false]);
        }

        snapCountRef.current += 1;
        lastSnapTimeRef.current = currentTime;

        const newCount = snapCountRef.current;

        setSnapCount(newCount);

        const newProgress = [false, false, false, false];
        for (let i = 0; i < Math.min(newCount, 4); i++) {
          newProgress[i] = true;
        }
        setSnapProgress(newProgress);

        if (newCount >= 4) {
          // Trigger the countdown locally
          setShowCountdown(true);
          setCountdown(3);
          snapCountRef.current = 0;
          setSnapCount(0);
          setSnapProgress([false, false, false, false]);
        }

        return true;
      }
    }

    return false;
  };

  const onHandResults = (results) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    let newGesture = "none";
    let active = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      active = true;

      results.multiHandLandmarks.forEach((landmarks, i) => {
        const color =
          i === 0 ? "rgba(255, 183, 43, 0.9)" : "rgba(2, 75, 110, 0.9)";
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
          color: color,
          lineWidth: 3,
        });
        drawLandmarks(ctx, landmarks, {
          color: "#ffffff",
          lineWidth: 1,
          radius: 3,
        });

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        ctx.beginPath();
        ctx.moveTo(thumbTip.x * 200, thumbTip.y * 150);
        ctx.lineTo(indexTip.x * 200, indexTip.y * 150);
        ctx.strokeStyle = "rgba(255, 183, 43, 0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      const snapDetected = detectSnap(results.multiHandLandmarks[0]);
      if (snapDetected) {
        newGesture = "snap";
      }

      let isFistDetected = false;
      for (const landmarks of results.multiHandLandmarks) {
        if (recognizeSingleHandGesture(landmarks) === "fist") {
          isFistDetected = true;
          break;
        }
      }

      if (isFistDetected) {
        const currentTime = Date.now();
        if (currentTime - lastGestureTimeRef.current > gestureDebounce) {
          // Removed WebSocket emitPulse
          if (window.triggerPulse) {
            window.triggerPulse();
          }
          lastGestureTimeRef.current = currentTime;
        }
        if (newGesture !== "snap") {
          newGesture = "fist";
        }
      }

      if (results.multiHandLandmarks.length === 2 && newGesture !== "snap") {
        handleTwoHandNavigation(results.multiHandLandmarks);
        if (newGesture !== "snap") {
          newGesture = "two_hands";
        }
      } else if (results.multiHandLandmarks.length === 1) {
        isManualRotatingRef.current = false;
      }
    } else {
      isManualRotatingRef.current = false;
      snapStateRef.current = "open";
    }

    setIsActive(active);
    handleGesture(newGesture);
  };

  const recognizeSingleHandGesture = (landmarks) => {
    const indexTip = landmarks[8];
    const indexPIP = landmarks[6];
    const middleTip = landmarks[12];
    const middlePIP = landmarks[10];
    const ringTip = landmarks[16];
    const ringPIP = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPIP = landmarks[18];

    const allFingersCurled =
      indexTip.y > indexPIP.y &&
      middleTip.y > middlePIP.y &&
      ringTip.y > ringPIP.y &&
      pinkyTip.y > pinkyPIP.y;

    return allFingersCurled ? "fist" : "none";
  };

  const handleTwoHandNavigation = (handsLandmarks) => {
    const hand1Center = handsLandmarks[0][0];
    const hand2Center = handsLandmarks[1][0];
    const currentPositions = [
      { x: hand1Center.x, y: hand1Center.y },
      { x: hand2Center.x, y: hand2Center.y },
    ];

    if (previousHandPositionsRef.current.length === 2) {
      const prevCenter = {
        x:
          (previousHandPositionsRef.current[0].x +
            previousHandPositionsRef.current[1].x) /
          2,
        y:
          (previousHandPositionsRef.current[0].y +
            previousHandPositionsRef.current[1].y) /
          2,
      };
      const currentCenter = {
        x: (currentPositions[0].x + currentPositions[1].x) / 2,
        y: (currentPositions[0].y + currentPositions[1].y) / 2,
      };

      const deltaX = currentCenter.x - prevCenter.x;
      const deltaY = currentCenter.y - prevCenter.y;
      const moveSensitivity = 150;

      if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
        isManualRotatingRef.current = true;

        // Removed WebSocket emitPosition
        if (window.setStarPosition) {
          window.setStarPosition(
            deltaX * moveSensitivity,
            -deltaY * moveSensitivity
          );
        }
      }
    }
    previousHandPositionsRef.current = currentPositions;
  };

  const handleGesture = (gesture) => {
    let statusText = "No Hands Detected";
    if (gesture === "snap") statusText = `Snap Detected! (${snapCount}/4)`;
    else if (gesture === "fist") statusText = "Stellar Pulse!";
    else if (gesture === "two_hands") statusText = "Navigating Star";
    else if (gesture !== "none") statusText = "Hand Detected";

    setGestureStatus(statusText);
  };

  return (
    <>
      {/* WebSocket Connection Status (REMOVED) */}

      <video
        ref={videoRef}
        id="video"
        autoPlay
        playsInline
        muted
        style={{ display: "none" }}
      />

      <canvas
        ref={canvasRef}
        id="hand-canvas"
        width="200"
        height="150"
        className={isActive ? "active" : ""}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          width: "200px",
          height: "150px",
          background: "rgba(255, 255, 255, 0.1)",
          borderRadius: "15px",
          zIndex: 200,
          backdropFilter: "blur(15px)",
          WebkitBackdropFilter: "blur(15px)",
          border: isActive
            ? "1px solid rgba(255, 255, 255, 0.5)"
            : "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: isActive
            ? "0 0 20px rgba(255, 255, 255, 0.2)"
            : "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
          transition: "box-shadow 0.4s ease, border-color 0.4s ease",
        }}
      />

      {/* Camera Error Message */}
      {cameraError && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255, 0, 0, 0.8)",
            color: "white",
            padding: "10px 20px",
            borderRadius: "8px",
            zIndex: 10000,
            textAlign: "center",
          }}
        >
          {cameraError}
        </div>
      )}

      {/* Snap Progress Indicator */}
      <div
        style={{
          position: "absolute",
          top: "190px",
          right: "20px",
          display: "flex",
          gap: "8px",
          zIndex: 200,
        }}
      >
        {snapProgress.map((completed, index) => (
          <div
            key={index}
            style={{
              width: "40px",
              height: "8px",
              borderRadius: "4px",
              background: completed
                ? "linear-gradient(135deg, #F9009A, #00F5FF)"
                : "rgba(255, 255, 255, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              boxShadow: completed ? "0 0 10px rgba(249, 0, 154, 0.6)" : "none",
              transition: "all 0.3s ease",
              transform: completed ? "scale(1.1)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <div
        id="gesture-status"
        className={
          gestureStatus && gestureStatus !== "No Hands Detected"
            ? "visible"
            : ""
        }
        style={{
          position: "absolute",
          bottom: "25px",
          left: "50%",
          fontSize: "18px",
          fontWeight: "bold",
          textShadow: "0 0 10px #ffffff, 0 0 20px #ffffff",
          padding: "12px 25px",
          borderRadius: "50px",
          opacity:
            gestureStatus && gestureStatus !== "No Hands Detected" ? 1 : 0,
          transform:
            gestureStatus && gestureStatus !== "No Hands Detected"
              ? "translateX(-50%)"
              : "translate(-50%, 20px)",
          transition: "all 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
          color: "#ffffff",
          zIndex: 100,
          pointerEvents: "none",
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(15px)",
          WebkitBackdropFilter: "blur(15px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
        }}
      >
        {gestureStatus}
      </div>

      {/* Countdown Overlay with Launch Animation */}
      {showCountdown && (
        <div
          className="countdown-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: launching
              ? "radial-gradient(circle at center, #1a0033 0%, #000000 100%)"
              : "radial-gradient(circle at bottom, #1a0033 0%, #000000 100%)",
            zIndex: 9999,
            animation: "fadeInOverlay 0.3s ease-in-out",
            overflow: "hidden",
            color: "white", // Default text color for overlay
          }}
        >
          {/* --- Dino Animation --- */}
          <div className="world">
            <img
              className="dino"
              src="https://i.imgur.com/Zvm9K3m.png"
              alt="Dino"
            />
            <img
              className="cactus"
              src="https://i.imgur.com/iTDwHri.png"
              alt="Cactus"
            />
            <img
              className="cactus hide"
              src="https://i.imgur.com/iTDwHri.png"
              alt="Cactus"
            />
            <div className="ground-container">
              <img
                ref={ground1Ref}
                className="ground"
                src="https://i.imgur.com/vj58SOA.png"
                alt="Ground"
              />
              <img
                ref={ground2Ref}
                className="ground"
                src="https://i.imgur.com/vj58SOA.png"
                alt="Ground"
              />
            </div>
          </div>
          {/* --- End Dino Animation --- */}

          {/* Apple-style Countdown Number */}
          {!launching && countdown > 0 && (
            <div key={countdown} className="apple-countdown">
              {countdown}
            </div>
          )}

          {/* Dynamic Fun Status Messages */}
          <div className="status-message">
            {launching
              ? "🚀 Blasting Off to CAIAS..."
              : countdown === 3
              ? "🎉 New Website Ready for Launch!"
              : countdown === 2
              ? "✨ Polishing the Pixels..."
              : countdown === 1
              ? "🎯 Get Ready for Awesomeness!"
              : "Initializing Experience..."}
          </div>

          {/* Minimal Status Message */}
          {/* <div className="status-message">
            {launching ? "Redirecting to CAIAS..." : "Preparing Launch..."}
          </div> */}
        </div>
      )}

      <style>
        {`
          /* --- Minimal Overlay Style --- */
          @keyframes fadeInOverlay {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          /* --- Apple-style Counter --- */
          .apple-countdown {
            font-size: 160px;
            font-weight: 200;
            color: rgba(255, 255, 255, 0.9);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            animation: applePulse 1s ease-in-out;
            position: relative;
            margin-top: 20px;
          }

          @keyframes applePulse {
            0% { transform: scale(0.9); opacity: 0; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }

          /* --- Minimal Status Message --- */
        .status-message {
              font-size: 28px;
              font-weight: 500;
              color: rgba(255, 255, 255, 0.95);
              margin-top: 30px;
              position: relative;
              letter-spacing: 1px;
              animation: slideInUp 0.6s ease-out;
              text-shadow: 0 2px 20px rgba(255, 255, 255, 0.3);
            }

          /* --- Dino Animation Styles --- */
          .world {
            width: 450px;
            height: 200px; 
            position: relative;
            overflow: hidden;
            padding-top: 80px; /* <-- ADD THIS LINE */
          }
          .dino, .cactus {
            height: 50px;
            margin-bottom: -25px;
          }
          .dino {
            animation: walk .25s infinite, 
                       jump 2.4s 2s infinite;
          }
          .cactus {
            position: absolute;
            animation: 2.4s cactus infinite linear;
          }
          .hide {
            display: none;
          }
          .ground-container {
            display: flex;
          }
          .ground {
            --right: 0px;
            position: absolute;
            transform: translateX(calc(var(--right)*-1));
            /* Ensure ground image displays correctly */
            width: 600px; 
            height: auto;
          }
          
          @keyframes walk {
            0%, 100% {
              content: url(https://i.imgur.com/evf6C9r.png);
            }
            50% {
              content: url(https://i.imgur.com/1r7Qtm2.png);
            }
          }
          
          @keyframes jump {
              0%, 30% {
                  transform: translateY(0);
              }
              15% {
                  transform: translateY(-75px);
              }
          }
          
          @keyframes cactus {
              from {
                  right: -30px;
              }
              to {
                  right: 100%;
              }
          }
        `}
      </style>
    </>
  );
}
