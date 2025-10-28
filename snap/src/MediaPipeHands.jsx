import React, { useRef, useEffect, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS } from "@mediapipe/hands";

function MediaPipeHands({ onSnapDetected, onGestureChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isHandActive, setIsHandActive] = useState(false);
  const lastSnapTime = useRef(0);
  const previousFingerDistance = useRef(null);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results) => onResults(results));

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
    };
  }, []);

  const detectSnap = (landmarks) => {
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];

    const distance = Math.sqrt(
      Math.pow(thumbTip.x - middleTip.x, 2) +
        Math.pow(thumbTip.y - middleTip.y, 2) +
        Math.pow(thumbTip.z - middleTip.z, 2)
    );

    if (previousFingerDistance.current !== null) {
      const wasClose = previousFingerDistance.current < 0.05;
      const nowFar = distance > 0.1;
      const currentTime = Date.now();

      if (wasClose && nowFar && currentTime - lastSnapTime.current > 500) {
        lastSnapTime.current = currentTime;
        onSnapDetected();
        onGestureChange("snap");
        setTimeout(() => onGestureChange("open"), 500);
      }
    }

    previousFingerDistance.current = distance;
  };

  const detectFist = (landmarks) => {
    const indexTip = landmarks[8];
    const indexPIP = landmarks[6];
    const middleTip = landmarks[12];
    const middlePIP = landmarks[10];
    const ringTip = landmarks[16];
    const ringPIP = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPIP = landmarks[18];

    return (
      indexTip.y > indexPIP.y &&
      middleTip.y > middlePIP.y &&
      ringTip.y > ringPIP.y &&
      pinkyTip.y > pinkyPIP.y
    );
  };

  const onResults = (results) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setIsHandActive(true);

      results.multiHandLandmarks.forEach((landmarks, i) => {
        const color =
          i === 0 ? "rgba(0, 255, 255, 0.8)" : "rgba(255, 0, 255, 0.8)";
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
          color,
          lineWidth: 3,
        });
        drawLandmarks(ctx, landmarks, {
          color: "#ffffff",
          lineWidth: 1,
          radius: 3,
        });

        // Detect snap
        detectSnap(landmarks);

        // Detect fist
        if (detectFist(landmarks)) {
          onGestureChange("fist");
        } else {
          onGestureChange("open");
        }
      });
    } else {
      setIsHandActive(false);
      onGestureChange("none");
      previousFingerDistance.current = null;
    }
  };

  return (
    <>
      <video
        ref={videoRef}
        style={{ display: "none" }}
        autoPlay
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        id="hand-canvas"
        className={isHandActive ? "active" : ""}
        width="200"
        height="150"
      />
    </>
  );
}

export default MediaPipeHands;
