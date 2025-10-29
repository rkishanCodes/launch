import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import StellarFlare from "./components/StellarFlare";
import HandTracking from "./components/HandTracking";
import UIOverlay from "./components/UIOverlay";
import AdminDashboard from "./components/AdminDashboard";
import "./App.css";

function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 120], fov: 75, near: 0.1, far: 2000 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <StellarFlare />
        </Suspense>
      </Canvas>
      <HandTracking />
      <UIOverlay />
      <AdminDashboard />
    </div>
  );
}

export default App;
