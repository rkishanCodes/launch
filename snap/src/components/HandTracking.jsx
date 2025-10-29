import React, { useRef, useEffect, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { useWebSocket } from '../hooks/useWebSocket';

export default function HandTracking() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const previousHandPositionsRef = useRef([]);
  const lastGestureTimeRef = useRef(0);
  const isManualRotatingRef = useRef(false);
  const snapCountRef = useRef(0);
  const lastSnapTimeRef = useRef(0);
  const snapStateRef = useRef('open');
  
  // WebSocket hook
  const { 
    isConnected, 
    syncedState, 
    triggerPulse: emitPulse, 
    updatePosition: emitPosition,
    snapDetected: emitSnap,
    startCountdown: emitCountdown
  } = useWebSocket();

  const [gestureStatus, setGestureStatus] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [snapCount, setSnapCount] = useState(0);
  const [snapProgress, setSnapProgress] = useState([false, false, false, false]);
  const [launching, setLaunching] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const gestureDebounce = 500;
  const snapDebounce = 300;
  const snapResetTime = 3000;

  // Sync countdown from WebSocket
  useEffect(() => {
    if (syncedState.countdown !== null) {
      setShowCountdown(true);
      setCountdown(syncedState.countdown);
    }
  }, [syncedState.countdown]);

  // Sync snap count from WebSocket
  useEffect(() => {
    if (syncedState.snapCount !== snapCount) {
      setSnapCount(syncedState.snapCount);
      const newProgress = [false, false, false, false];
      for (let i = 0; i < Math.min(syncedState.snapCount, 4); i++) {
        newProgress[i] = true;
      }
      setSnapProgress(newProgress);
    }
  }, [syncedState.snapCount]);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera access is not supported in this browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: 'user' } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6
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
          height: 480
        });

        await camera.start();
        cameraRef.current = camera;
        setCameraError(null);

      } catch (error) {
        console.error('Camera initialization error:', error);
        if (error.name === 'NotAllowedError') {
          setCameraError('Camera permission denied. Please allow camera access.');
        } else if (error.name === 'NotFoundError') {
          setCameraError('No camera found.');
        } else {
          setCameraError(`Camera error: ${error.message}`);
        }
      }
    };

    initMediaPipe();

    return () => {
      if (cameraRef.current) {
        try { cameraRef.current.stop(); } catch (e) {}
      }
      if (handsRef.current) {
        try { handsRef.current.close(); } catch (e) {}
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      setLaunching(true);
      setTimeout(() => {
        window.location.href = 'https://caias.in';
      }, 2500);
    }
  }, [showCountdown, countdown]);

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
    
    if (snapStateRef.current === 'open' && distance < closeThreshold) {
      snapStateRef.current = 'closed';
    } else if (snapStateRef.current === 'closed' && distance > openThreshold) {
      snapStateRef.current = 'open';
      
      if (currentTime - lastSnapTimeRef.current > snapDebounce) {
        if (currentTime - lastSnapTimeRef.current > snapResetTime) {
          snapCountRef.current = 0;
          setSnapCount(0);
          setSnapProgress([false, false, false, false]);
        }
        
        snapCountRef.current += 1;
        lastSnapTimeRef.current = currentTime;
        
        const newCount = snapCountRef.current;
        
        // Emit to WebSocket server
        emitSnap(newCount);
        
        setSnapCount(newCount);
        
        const newProgress = [false, false, false, false];
        for (let i = 0; i < Math.min(newCount, 4); i++) {
          newProgress[i] = true;
        }
        setSnapProgress(newProgress);
        
        if (newCount >= 4) {
          // Emit countdown start to all devices
          emitCountdown();
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
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    let newGesture = 'none';
    let active = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      active = true;
      
      results.multiHandLandmarks.forEach((landmarks, i) => {
        const color = i === 0 ? 'rgba(255, 183, 43, 0.9)' : 'rgba(2, 75, 110, 0.9)';
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: color, lineWidth: 3 });
        drawLandmarks(ctx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 3 });
        
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        ctx.beginPath();
        ctx.moveTo(thumbTip.x * 200, thumbTip.y * 150);
        ctx.lineTo(indexTip.x * 200, indexTip.y * 150);
        ctx.strokeStyle = 'rgba(255, 183, 43, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      const snapDetected = detectSnap(results.multiHandLandmarks[0]);
      if (snapDetected) {
        newGesture = 'snap';
      }

      let isFistDetected = false;
      for (const landmarks of results.multiHandLandmarks) {
        if (recognizeSingleHandGesture(landmarks) === 'fist') {
          isFistDetected = true;
          break;
        }
      }

      if (isFistDetected) {
        const currentTime = Date.now();
        if (currentTime - lastGestureTimeRef.current > gestureDebounce) {
          // Emit pulse to WebSocket
          emitPulse();
          
          if (window.triggerPulse) {
            window.triggerPulse();
          }
          lastGestureTimeRef.current = currentTime;
        }
        if (newGesture !== 'snap') {
          newGesture = 'fist';
        }
      }

      if (results.multiHandLandmarks.length === 2 && newGesture !== 'snap') {
        handleTwoHandNavigation(results.multiHandLandmarks);
        if (newGesture !== 'snap') {
          newGesture = 'two_hands';
        }
      } else if (results.multiHandLandmarks.length === 1) {
        isManualRotatingRef.current = false;
      }
    } else {
      isManualRotatingRef.current = false;
      snapStateRef.current = 'open';
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

    return allFingersCurled ? 'fist' : 'none';
  };

  const handleTwoHandNavigation = (handsLandmarks) => {
    const hand1Center = handsLandmarks[0][0];
    const hand2Center = handsLandmarks[1][0];
    const currentPositions = [
      { x: hand1Center.x, y: hand1Center.y },
      { x: hand2Center.x, y: hand2Center.y }
    ];

    if (previousHandPositionsRef.current.length === 2) {
      const prevCenter = {
        x: (previousHandPositionsRef.current[0].x + previousHandPositionsRef.current[1].x) / 2,
        y: (previousHandPositionsRef.current[0].y + previousHandPositionsRef.current[1].y) / 2
      };
      const currentCenter = {
        x: (currentPositions[0].x + currentPositions[1].x) / 2,
        y: (currentPositions[0].y + currentPositions[1].y) / 2
      };

      const deltaX = currentCenter.x - prevCenter.x;
      const deltaY = currentCenter.y - prevCenter.y;
      const moveSensitivity = 150;

      if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
        isManualRotatingRef.current = true;
        
        // Emit position update to WebSocket
        emitPosition(deltaX * moveSensitivity, -deltaY * moveSensitivity);
        
        if (window.setStarPosition) {
          window.setStarPosition(deltaX * moveSensitivity, -deltaY * moveSensitivity);
        }
      }
    }
    previousHandPositionsRef.current = currentPositions;
  };

  const handleGesture = (gesture) => {
    let statusText = 'No Hands Detected';
    if (gesture === 'snap') statusText = `Snap Detected! (${snapCount}/4)`;
    else if (gesture === 'fist') statusText = 'Stellar Pulse!';
    else if (gesture === 'two_hands') statusText = 'Navigating Star';
    else if (gesture !== 'none') statusText = 'Hand Detected';

    setGestureStatus(statusText);
  };

  return (
    <>
      {/* WebSocket Connection Status */}
      <div
        style={{
          position: 'absolute',
          top: '220px',
          right: '20px',
          padding: '8px 12px',
          background: isConnected ? 'rgba(0, 255, 0, 0.15)' : 'rgba(255, 0, 0, 0.15)',
          border: `1px solid ${isConnected ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)'}`,
          borderRadius: '8px',
          color: isConnected ? '#00ff00' : '#ff0000',
          fontSize: '12px',
          zIndex: 201,
          fontWeight: 'bold'
        }}
      >
        ● {isConnected ? 'SYNCED' : 'OFFLINE'}
      </div>

      <video
        ref={videoRef}
        id="video"
        autoPlay
        playsInline
        muted
        style={{ display: 'none' }}
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
            animation: "fadeIn 0.3s ease-in-out",
            overflow: "hidden",
          }}
        >
          {/* Animated Stars */}
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="star"
              style={{
                position: "absolute",
                width: "2px",
                height: "2px",
                background: "white",
                borderRadius: "50%",
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `twinkle ${
                  2 + Math.random() * 3
                }s infinite ease-in-out ${Math.random() * 2}s`,
              }}
            />
          ))}

          {/* Rocket Container */}
          <div
            className="rocket-container"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: launching
                ? "liftoff 2.5s cubic-bezier(0.75, 0, 0.25, 1) forwards"
                : "none",
            }}
          >
            {/* Smoke/Exhaust Trail */}
            {launching && (
              <>
                <div className="smoke smoke1" />
                <div className="smoke smoke2" />
                <div className="smoke smoke3" />
                <div className="flame flame1" />
                <div className="flame flame2" />
              </>
            )}

            {/* Rocket Emoji/Icon */}
            <div
              className="rocket"
              style={{
                fontSize: launching ? "120px" : "100px",
                filter: launching
                  ? "drop-shadow(0 0 40px #F9009A) drop-shadow(0 0 80px #00F5FF)"
                  : "none",
                transition: "all 0.5s ease",
                animation: launching
                  ? "rocketShake 0.1s infinite"
                  : "rocketFloat 2s ease-in-out infinite",
                position: "relative",
                zIndex: 10,
              }}
            >
              🚀
            </div>

            {/* Countdown Number */}
            {!launching && countdown > 0 && (
              <div
                style={{
                  fontSize: "180px",
                  fontWeight: "bold",
                  background: "linear-gradient(135deg, #F9009A, #00F5FF)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "countdownPulse 1s ease-in-out",
                  textShadow: "0 0 60px rgba(249, 0, 154, 0.8)",
                  marginTop: "30px",
                  position: "relative",
                }}
              >
                {countdown}
              </div>
            )}

            {/* Launch Message */}
            {launching && (
              <div
                style={{
                  fontSize: "48px",
                  fontWeight: "bold",
                  background:
                    "linear-gradient(135deg, #FFD700, #FFA500, #FF6B6B)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "pulse 1s ease-in-out infinite",
                  marginTop: "40px",
                  letterSpacing: "4px",
                  textTransform: "uppercase",
                }}
              >
                Lift Off!
              </div>
            )}

            {/* Status Message */}
            {!launching && (
              <div
                style={{
                  fontSize: "32px",
                  marginTop: "40px",
                  opacity: 0.9,
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  fontWeight: "600",
                  background: "linear-gradient(135deg, #ffffff, #00F5FF)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "fadeInUp 0.5s ease-out",
                }}
              >
                Preparing Launch...
              </div>
            )}

            {/* Progress Bar */}
            {!launching && (
              <div
                style={{
                  width: "500px",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.15)",
                  borderRadius: "4px",
                  marginTop: "50px",
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "0 0 20px rgba(0, 245, 255, 0.3)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background:
                      "linear-gradient(90deg, #F9009A, #FF6B6B, #00F5FF)",
                    borderRadius: "4px",
                    width: `${((3 - countdown) / 3) * 100}%`,
                    transition: "width 1s linear",
                    boxShadow: "0 0 20px rgba(0, 245, 255, 0.8)",
                    animation: "shimmer 2s infinite",
                  }}
                />
              </div>
            )}

            {/* Particle Burst on Launch */}
            {launching && (
              <>
                {[...Array(30)].map((_, i) => (
                  <div
                    key={`particle-${i}`}
                    className="particle"
                    style={{
                      position: "absolute",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: `hsl(${Math.random() * 60 + 330}, 100%, 60%)`,
                      bottom: "80px",
                      left: "50%",
                      animation: `explode ${
                        0.8 + Math.random() * 0.4
                      }s ease-out forwards`,
                      animationDelay: `${Math.random() * 0.2}s`,
                      transform: `rotate(${i * 12}deg)`,
                    }}
                  />
                ))}
              </>
            )}
          </div>

          {/* Sub-message */}
          <div
            style={{
              fontSize: "18px",
              marginTop: "60px",
              opacity: 0.6,
              letterSpacing: "2px",
              color: "#ffffff",
              animation: "fadeIn 1s ease-in",
            }}
          >
            {launching ? "Redirecting to CAIAS..." : "Get ready for takeoff!"}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }

          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes countdownPulse {
            0% { transform: scale(0.8); opacity: 0.3; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }

          @keyframes rocketFloat {
            0%, 100% { transform: translateY(0px) rotate(-5deg); }
            50% { transform: translateY(-15px) rotate(-8deg); }
          }

          @keyframes rocketShake {
            0%, 100% { transform: translateX(0) rotate(-5deg); }
            25% { transform: translateX(-3px) rotate(-7deg); }
            75% { transform: translateX(3px) rotate(-3deg); }
          }

          @keyframes liftoff {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            60% { transform: translateY(-50vh) scale(1.2); opacity: 1; }
            100% { transform: translateY(-120vh) scale(0.5); opacity: 0; }
          }

          @keyframes twinkle {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.3); }
          }

          @keyframes shimmer {
            0% { background-position: -500px 0; }
            100% { background-position: 500px 0; }
          }

          @keyframes explode {
            0% {
              transform: translate(0, 0) rotate(var(--angle)) scale(1);
              opacity: 1;
            }
            100% {
              transform: translate(
                calc(cos(var(--angle)) * 200px), 
                calc(sin(var(--angle)) * 200px)
              ) rotate(var(--angle)) scale(0);
              opacity: 0;
            }
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
          }

          .smoke {
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 60px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.4), transparent 70%);
            border-radius: 50%;
            animation: smokePuff 0.6s ease-out infinite;
            z-index: 1;
          }

          .smoke1 { animation-delay: 0s; }
          .smoke2 { animation-delay: 0.2s; opacity: 0.7; }
          .smoke3 { animation-delay: 0.4s; opacity: 0.5; }

          @keyframes smokePuff {
            0% { opacity: 0.6; transform: translateX(-50%) translateY(0) scale(0.8); }
            100% { opacity: 0; transform: translateX(-50%) translateY(80px) scale(2); }
          }

          .flame {
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 40px;
            height: 80px;
            background: linear-gradient(to top, #FF6B6B, #FFA500, #FFD700);
            border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
            animation: flicker 0.1s infinite alternate;
            z-index: 2;
            filter: blur(4px);
          }

          .flame1 { animation-delay: 0s; }
          .flame2 { animation-delay: 0.05s; opacity: 0.8; transform: translateX(-50%) scale(0.9); }

          @keyframes flicker {
            0% { transform: translateX(-50%) scaleY(1); opacity: 1; }
            100% { transform: translateX(-50%) scaleY(1.1); opacity: 0.9; }
          }

          @media (max-width: 768px) {
            .rocket { font-size: 80px !important; }
            .countdown-overlay > div > div:first-of-type { font-size: 120px !important; }
          }
        `}
      </style>
    </>
  );
}





