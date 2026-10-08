"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface Point {
  x: number;
  y: number;
}

interface PortraitConfig {
  leftEye: Point;
  rightEye: Point;
  mouthCentre: Point;
  mouthWidth: number;
  jawLineY: number;
}

export interface PortraitAvatarProps {
  idleMotion: boolean;
}

const PORTRAIT_URL = "/avatar/speaker.jpg";

const DEFAULT_CONFIG: PortraitConfig = {
  leftEye: { x: 0.405, y: 0.405 },
  rightEye: { x: 0.595, y: 0.405 },
  mouthCentre: { x: 0.5, y: 0.62 },
  mouthWidth: 0.18,
  jawLineY: 0.82,
};

function usePortraitConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [calibrating] = useState(
    () =>
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "development" &&
      new URLSearchParams(window.location.search).get("calibrate") === "1",
  );

  useEffect(() => {
    let active = true;
    fetch("/avatar/portrait.config.json")
      .then(response => (response.ok ? response.json() : null))
      .then(value => {
        if (active && value && typeof value === "object") {
          setConfig({ ...DEFAULT_CONFIG, ...value });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return { config, calibrating };
}

function PortraitPlane({ idleMotion }: { idleMotion: boolean }) {
  const texture = useTexture("/avatar/speaker.jpg");
  const group = useRef<THREE.Group>(null);

  const configuredTexture = useMemo(() => {
    const next = texture.clone();
    next.colorSpace = THREE.SRGBColorSpace;
    next.anisotropy = 2;
    next.needsUpdate = true;
    return next;
  }, [texture]);

  useFrame(() => {
    const target = group.current;
    if (!target) return;
    const t = performance.now() / 1000;
    const motion = idleMotion ? 1 : 0;
    target.position.y = Math.sin(t * 0.9) * 0.006 * motion;
    target.rotation.y = THREE.MathUtils.lerp(target.rotation.y, Math.sin(t * 0.32) * 0.05 * motion, 0.05);
    target.rotation.x = THREE.MathUtils.lerp(target.rotation.x, Math.sin(t * 0.21) * 0.018 * motion, 0.05);
  });

  const image = configuredTexture.image as { width: number; height: number };
  const aspect = image.width / image.height;

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[aspect, 1, 64, 64]} />
        <meshBasicMaterial map={configuredTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CalibrationOverlay({ config }: { config: PortraitConfig }) {
  const points = [
    ["left eye", config.leftEye],
    ["right eye", config.rightEye],
    ["mouth", config.mouthCentre],
  ] as const;

  return (
    <div
      aria-hidden
      style={{ position: "absolute", inset: 0, pointerEvents: "none", font: "10px monospace", color: "#fff" }}
    >
      {points.map(([label, point]) => (
        <span
          key={label}
          style={{
            position: "absolute",
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            width: 8,
            height: 8,
            transform: "translate(-50%, -50%)",
            border: "1px solid #ffdb70",
            borderRadius: "50%",
            boxShadow: "0 0 0 1px #111",
          }}
        >
          <span style={{ position: "absolute", left: 10, top: -5, whiteSpace: "nowrap" }}>{label}</span>
        </span>
      ))}
      <span
        style={{
          position: "absolute",
          left: `${(0.5 - config.mouthWidth / 2) * 100}%`,
          top: `${config.mouthCentre.y * 100}%`,
          width: `${config.mouthWidth * 100}%`,
          borderTop: "1px solid #ffdb70",
        }}
      />
      <span
        style={{ position: "absolute", insetInline: 0, top: `${config.jawLineY * 100}%`, borderTop: "1px dashed #ffdb70" }}
      />
    </div>
  );
}

export default function PortraitAvatar({ idleMotion }: PortraitAvatarProps) {
  const { config, calibrating } = usePortraitConfig();
  const [assetState, setAssetState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const image = new Image();
    image.onload = () => setAssetState("ready");
    image.onerror = () => setAssetState("error");
    image.src = PORTRAIT_URL;
  }, []);

  if (assetState === "error") {
    return (
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: "1rem",
          textAlign: "center",
          color: "var(--p-text-4)",
          fontSize: "0.72rem",
        }}
      >
        Portrait unavailable. Captions remain available.
      </div>
    );
  }

  return (
    <>
      {assetState === "ready" ? (
        <Canvas
          dpr={[1, 1.5]}
          camera={{ fov: 32, position: [0, 0, 2.35] }}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          style={{ display: "block" }}
        >
          <PortraitPlane idleMotion={idleMotion} />
        </Canvas>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span style={{ color: "var(--p-text-4)", fontSize: "0.72rem" }}>Loading portrait…</span>
        </div>
      )}
      {calibrating && <CalibrationOverlay config={config} />}
    </>
  );
}
