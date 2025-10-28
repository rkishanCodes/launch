import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass";

const palette = {
  color1: new THREE.Color(0x21094e),
  color2: new THREE.Color(0xf9009a),
  line: new THREE.Color(0x00f5ff),
  core: new THREE.Color(0xffffff),
};

const noiseFunction = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 );
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }
`;

function Nebula() {
  const meshRef = useRef();
  const materialRef = useRef();

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: palette.color1 },
        color2: { value: palette.color2 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color1;
        uniform vec3 color2;
        uniform float time;
        varying vec3 vWorldPosition;
        ${noiseFunction}
        void main() {
          float f = 0.0;
          vec3 p = vWorldPosition * 0.01;
          f += 0.50 * snoise(p + time * 0.1);
          f += 0.25 * snoise(p * 2.0 + time * 0.2);
          f += 0.125 * snoise(p * 5.0 + time * 0.4);
          f = pow(f, 2.0);
          vec3 color = mix(color1, color2, smoothstep(0.0, 1.0, f));
          gl_FragColor = vec4(color, f * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1000, 64, 64]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}

function StarCore({ pulse }) {
  const groupRef = useRef();
  const coreRef = useRef();
  const materialRef = useRef();

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 25;
    const innerRadius = 12;
    const numPoints = 5;
    const angle = (Math.PI * 2) / (numPoints * 2);

    shape.moveTo(outerRadius, 0);
    for (let i = 1; i < numPoints * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle * i) * r;
      const y = Math.sin(angle * i) * r;
      shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }, []);

  const geometry = useMemo(() => {
    const extrudeSettings = {
      depth: 8,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 2,
      bevelSize: 1,
      bevelThickness: 1,
    };
    const geo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
    geo.center();
    return geo;
  }, [starShape]);

  const coreMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pulse: { value: 0 },
        color: { value: palette.core },
      },
      vertexShader: `
        uniform float time;
        uniform float pulse;
        varying float vNoise;
        ${noiseFunction}
        void main() {
          float displacement = snoise(position * 0.1 + time * 0.5) * 3.0;
          displacement += snoise(position * 0.5 + time) * 1.5;
          vNoise = snoise(position * 2.0 + time * 2.0);
          vec3 newPosition = position + normal * (displacement + vNoise * (2.0 + pulse * 8.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform float pulse;
        uniform vec3 color;
        varying float vNoise;
        void main() {
          float intensity = pow(0.6 - abs(vNoise), 2.0);
          gl_FragColor = vec4(color, 1.0) * intensity + vec4(1.0, 1.0, 1.0, 1.0) * pulse * intensity * 2.0;
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.pulse.value = pulse.strength;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={coreRef} geometry={geometry}>
        <primitive object={coreMaterial} ref={materialRef} attach="material" />
      </mesh>
      <mesh geometry={geometry} scale={[1.2, 1.2, 1.2]}>
        <meshBasicMaterial
          color={palette.line}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function FlareLines({ pulse, starGroupRef }) {
  const linesRef = useRef([]);

  const flareData = useMemo(() => {
    const NUM_ENDPOINTS = 18;
    const endpoints = [];
    const curves = [];

    for (let i = 0; i < NUM_ENDPOINTS; i++) {
      const phi = Math.acos(-1 + (2 * i) / NUM_ENDPOINTS);
      const theta = Math.sqrt(NUM_ENDPOINTS * Math.PI) * phi;
      const r = 65 + Math.random() * 45;
      const endPoint = new THREE.Vector3(
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi)
      );
      endpoints.push(endPoint);

      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3()
          .lerpVectors(new THREE.Vector3(0, 0, 0), endPoint, 0.5)
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 40,
              (Math.random() - 0.5) * 40,
              (Math.random() - 0.5) * 40
            )
          ),
        endPoint
      );
      curves.push(curve);
    }

    return { endpoints, curves };
  }, []);

  const lineMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        pulse: { value: 0 },
        color: { value: palette.line },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float pulse;
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
          float intensity1 = pow(1.0 - abs(vUv.x - pulse), 30.0);
          float intensity2 = pow(1.0 - abs(vUv.x - pulse * 1.3), 20.0) * 0.4;
          float totalIntensity = intensity1 + intensity2;
          vec3 fireColor = mix(color, vec3(1.0, 1.0, 1.0), intensity1 * 1.5);
          gl_FragColor = vec4(fireColor, totalIntensity * 3.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame(() => {
    linesRef.current.forEach((line) => {
      if (line) {
        line.visible = pulse.active;
        if (line.visible && line.material.uniforms) {
          line.material.uniforms.pulse.value = pulse.progress;
        }
      }
    });
  });

  return (
    <group>
      {flareData.curves.map((curve, index) => {
        const geometry = new THREE.TubeGeometry(curve, 32, 0.15, 8, false);
        const mat = lineMaterial.clone();

        return (
          <mesh
            key={index}
            ref={(el) => (linesRef.current[index] = el)}
            geometry={geometry}
            visible={false}
          >
            <primitive object={mat} attach="material" />
          </mesh>
        );
      })}
    </group>
  );
}

function StellarDust({ starGroupRef }) {
  const pointsRef = useRef();
  const positionsRef = useRef();

  const particleCount = 1200;
  const outerBoundary = 250;
  const innerBoundary = 30;

  const positions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      )
        .normalize()
        .multiplyScalar(
          innerBoundary + Math.random() * (outerBoundary - innerBoundary)
        );

      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    return arr;
  }, []);

  useEffect(() => {
    positionsRef.current = new Float32Array(positions);
  }, [positions]);

  useFrame(() => {
    if (!pointsRef.current || !positionsRef.current) return;

    const corePos = starGroupRef.current
      ? starGroupRef.current.position
      : new THREE.Vector3();
    const positions = pointsRef.current.geometry.attributes.position;

    for (let i = 0; i < particleCount; i++) {
      const p = new THREE.Vector3(
        positions.array[i * 3],
        positions.array[i * 3 + 1],
        positions.array[i * 3 + 2]
      );

      const direction = p.clone().sub(corePos).normalize();
      p.add(direction.multiplyScalar(0.1 + Math.random() * 0.2));

      if (p.distanceTo(corePos) > outerBoundary) {
        const resetVector = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        )
          .normalize()
          .multiplyScalar(innerBoundary + Math.random() * 10);
        p.copy(corePos).add(resetVector);
      }

      positions.array[i * 3] = p.x;
      positions.array[i * 3 + 1] = p.y;
      positions.array[i * 3 + 2] = p.z;
    }
    positions.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.6}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
        color={0x00ffaa}
      />
    </points>
  );
}

function PostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      1.6,
      0.7,
      0.1
    );
    composer.addPass(bloomPass);

    const afterimagePass = new AfterimagePass(0.92);
    composer.addPass(afterimagePass);

    composer.setSize(size.width, size.height);
    composerRef.current = composer;
  }, [gl, scene, camera, size]);

  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
  }, 1);

  return null;
}

export default function StellarFlare() {
  const starGroupRef = useRef();
  const pulseRef = useRef({ active: false, progress: 1.0, strength: 0 });

  useFrame(() => {
    const pulse = pulseRef.current;
    if (pulse.active) {
      pulse.progress += 0.02;
      if (pulse.progress >= 1.0) {
        pulse.active = false;
        pulse.progress = 1.0;
      }
      pulse.strength = Math.sin(pulse.progress * Math.PI);
    }
  });

  useEffect(() => {
    window.triggerPulse = () => {
      if (!pulseRef.current.active) {
        pulseRef.current.active = true;
        pulseRef.current.progress = 0;
      }
    };

    window.setStarPosition = (x, y) => {
      if (starGroupRef.current) {
        starGroupRef.current.position.x = x;
        starGroupRef.current.position.y = y;
      }
    };

    return () => {
      delete window.triggerPulse;
      delete window.setStarPosition;
    };
  }, []);

  return (
    <>
      <color attach="background" args={["#010002"]} />
      <Nebula />
      <group ref={starGroupRef}>
        <StarCore pulse={pulseRef.current} />
        <FlareLines pulse={pulseRef.current} starGroupRef={starGroupRef} />
      </group>
      <StellarDust starGroupRef={starGroupRef} />
      <PostProcessing />
    </>
  );
}
