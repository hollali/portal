"use client";

/**
 * The guide's 3D scene, in a chunk of its own.
 *
 * Split out of `AvatarStage` for one reason: three.js is several hundred
 * kilobytes, and a visitor whose browser has no WebGL — or who is on mobile
 * data — must not download a renderer they can never use. The label, the
 * captions and the voice are all in the light component; only the figure is
 * here, and this file is only fetched once a WebGL context has been obtained.
 *
 * Nothing in here decides anything about what the guide says. It poses a head
 * and moves a jaw; the words come from `AvatarStage`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { GuideState } from "@/lib/avatarState";

export interface GuideSceneProps {
  /** The approved `.glb`. Omit it and the placeholder head is used instead. */
  modelUrl?: string | null;
  state: GuideState;
  /**
   * Mouth openness, shared by reference with the component that owns the
   * captions. It changes several times a second for as long as the guide talks,
   * and routing it through state would re-render this tree per syllable to move
   * one blendshape.
   */
  mouthRef: React.MutableRefObject<number>;
  idleMotion: boolean;
}

/**
 * Blink timing: random in [2, 6] seconds, so the eyes never fall into a loop a
 * visitor can count. Blinking on a fixed 2-second cycle reads as a machine by
 * the third pass, which is the opposite of what this is for.
 */
function useBlink(active: boolean): number {
  const [blink, setBlink] = useState(0);
  useEffect(() => {
    if (!active) return;
    let next: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      next = setTimeout(() => {
        setBlink(1);
        next = setTimeout(() => {
          setBlink(0);
          schedule();
        }, 130);
      }, 2000 + Math.random() * 4000);
    };
    schedule();
    return () => {
      if (next) clearTimeout(next);
    };
  }, [active]);
  // An idle guide holds its eyes open rather than being frozen mid-blink. The
  // timer is torn down instead, so nothing fires while the tab is hidden.
  return active ? blink : 0;
}

/** Sets a named blendshape anywhere under `root`, ignoring the ones it lacks. */
function applyMorph(root: THREE.Object3D | null, names: string[], value: number) {
  if (!root) return;
  root.traverse(node => {
    const mesh = node as THREE.Mesh;
    const dict = mesh.morphTargetDictionary as Record<string, number> | undefined;
    const influences = mesh.morphTargetInfluences;
    if (!dict || !influences) return;
    for (const name of names) {
      const i = dict[name];
      if (i !== undefined) influences[i] = value;
    }
  });
}

const MOUTH_SHAPES = ["jawOpen", "mouthOpen", "viseme_aa"];
const EYES_SHUT = ["eyeBlinkLeft", "eyeBlinkRight"];

/** Where the head points in each state, in radians. */
const POSE: Record<GuideState, { y: number; x: number }> = {
  // A slow gaze drift, supplied separately when idle motion is allowed.
  idle: { y: 0, x: 0 },
  // Attentive: square to the visitor, because they are the one typing.
  listening: { y: 0, x: -0.02 },
  // Head tilt and gaze up, the convention for working something out.
  thinking: { y: 0.16, x: 0.1 },
  // Level. Reading a quotation is not a performance, and a nod every few words
  // reads as emphasis the Speaker never intended.
  speaking: { y: 0, x: 0 },
  // Down a little, and still. Nothing about an empty result is apologetic enough
  // to be worth an expression, but the gaze drop is not neutral either.
  'no-result': { y: 0, x: 0.08 },
  // Dead still: a real recording is playing and nothing here should compete.
  media: { y: 0, x: 0 },
}

/**
 * The approved likeness, once one exists.
 *
 * Its own component because `useGLTF` is a hook and therefore cannot be called
 * conditionally: this is only ever mounted once there is a URL to load, which is
 * what lets the placeholder work with no asset at all.
 */
function ApprovedModel({
  url,
  mouthRef,
  blink,
  idleMotion,
}: {
  url: string;
  mouthRef: React.MutableRefObject<number>;
  blink: number;
  idleMotion: boolean;
}) {
  const gltf = useGLTF(url);
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    root.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = true;
    });
  }, [root]);

  useFrame((_, delta) => {
    applyMorph(root, MOUTH_SHAPES, Math.min(1, mouthRef.current));
    applyMorph(root, EYES_SHUT, blink);
    const g = group.current;
    if (!g || !idleMotion) return;
    const t = performance.now() / 1000;
    // Breathing and drift, both small. The shape of the face carries the
    // resemblance; large motions only invite scrutiny of it.
    g.position.y = Math.sin(t * 0.9) * 0.006;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.sin(t * 0.32) * 0.07, 0.05);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, Math.sin(t * 0.21) * 0.02, 0.05);
    void delta;
  });

  return (
    <group ref={group}>
      <primitive object={root} />
    </group>
  );
}

/**
 * The placeholder, used until an approved model reaches `public/avatar/`.
 *
 * Built from primitives so the page can be developed and reviewed before anyone
 * has been commissioned for a likeness, and so what ships first is unmistakably
 * not footage of a person. It is also what lets the feature exist at all before
 * the Speaker's office has signed anything off.
 */
function PlaceholderHead({
  mouthRef,
  blink,
  idleMotion,
  state,
}: {
  mouthRef: React.MutableRefObject<number>;
  blink: number;
  idleMotion: boolean;
  state: GuideState;
}) {
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  const skin = "#3b3227";

  useFrame((_, delta) => {
    const t = performance.now() / 1000;
    const pose = POSE[state];
    const drift = idleMotion ? 1 : 0;

    const h = head.current;
    if (h) {
      h.rotation.y = THREE.MathUtils.lerp(h.rotation.y, pose.y + Math.sin(t * 0.4) * 0.06 * drift, 0.07);
      h.rotation.x = THREE.MathUtils.lerp(h.rotation.x, pose.x + Math.sin(t * 0.6) * 0.02 * drift, 0.07);
      h.position.y = Math.sin(t * 0.9) * 0.008 * drift;
    }

    const j = jaw.current;
    if (j) j.scale.y = THREE.MathUtils.lerp(j.scale.y, 1 + Math.min(1, mouthRef.current) * 0.5, 0.35);

    const e = eyes.current;
    if (e) e.scale.y = THREE.MathUtils.lerp(e.scale.y, Math.max(0.06, 1 - blink * 0.94), 0.4);

    // A closed mouth takes a moment to settle after the last syllable, so the
    // jaw does not snap shut between words.
    if (mouthRef.current > 0) mouthRef.current = Math.max(0, mouthRef.current - delta * 2.4);
    void delta;
  });

  return (
    <group ref={head} position={[0, 0.06, 0]}>
      <mesh castShadow position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.62, 40, 28]} />
        <meshStandardMaterial color={skin} roughness={0.82} metalness={0.02} />
      </mesh>
      {/* A separate jaw, so it can open. A sphere with a scaled mouth on it reads
          as a mask; an actual jaw reads as a face. */}
      <mesh ref={jaw} castShadow position={[0, -0.34, 0.05]}>
        <sphereGeometry args={[0.42, 32, 20]} />
        <meshStandardMaterial color={skin} roughness={0.82} metalness={0.02} />
      </mesh>
      <group ref={eyes}>
        <mesh position={[-0.21, 0.2, 0.53]}>
          <sphereGeometry args={[0.075, 20, 14]} />
          <meshStandardMaterial color="#f6f1e6" roughness={0.35} />
        </mesh>
        <mesh position={[0.21, 0.2, 0.53]}>
          <sphereGeometry args={[0.075, 20, 14]} />
          <meshStandardMaterial color="#f6f1e6" roughness={0.35} />
        </mesh>
        <mesh position={[-0.21, 0.2, 0.58]}>
          <sphereGeometry args={[0.036, 16, 12]} />
          <meshStandardMaterial color="#16130f" roughness={0.2} />
        </mesh>
        <mesh position={[0.21, 0.2, 0.58]}>
          <sphereGeometry args={[0.036, 16, 12]} />
          <meshStandardMaterial color="#16130f" roughness={0.2} />
        </mesh>
      </group>
      {/* Brows. Barely legible at this scale, and their absence is the whole
          difference between a head and a face. */}
      <mesh position={[-0.21, 0.33, 0.55]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.2, 0.035, 0.03]} />
        <meshStandardMaterial color="#241d16" roughness={0.9} />
      </mesh>
      <mesh position={[0.21, 0.33, 0.55]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.2, 0.035, 0.03]} />
        <meshStandardMaterial color="#241d16" roughness={0.9} />
      </mesh>
      {/* Shoulders, and nothing below them: the frame stays on the face. */}
      <mesh castShadow position={[0, -1.02, 0]}>
        <capsuleGeometry args={[0.86, 0.42, 6, 24]} />
        <meshStandardMaterial color="#1b1f2b" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Points the camera at the face rather than the shoulders. */
function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.34, 2.35);
    camera.lookAt(0, 0.06, 0);
  }, [camera]);
  return null;
}

function Scene({
  modelUrl,
  state,
  mouthRef,
  idleMotion,
}: {
  modelUrl: string | null;
  state: GuideState;
  mouthRef: React.MutableRefObject<number>;
  idleMotion: boolean;
}) {
  const blink = useBlink(idleMotion);
  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.85} />
      <directionalLight position={[1.6, 2.6, 2.4]} intensity={1.5} color="#fff6e6" />
      <directionalLight position={[-2, 1.2, -1.6]} intensity={0.5} color="#8fa6c8" />
      {modelUrl ? (
        <ApprovedModel url={modelUrl} mouthRef={mouthRef} blink={blink} idleMotion={idleMotion} />
      ) : (
        <PlaceholderHead mouthRef={mouthRef} blink={blink} idleMotion={idleMotion} state={state} />
      )}
    </>
  );
}

export default function GuideScene({ modelUrl = null, state, mouthRef, idleMotion }: GuideSceneProps) {
  return (
    <Canvas
      // Capped, so a high-DPI phone is not asked to shade three megapixels a
      // frame of a face nobody is here to admire.
      dpr={[1, 1.5]}
      camera={{ fov: 32, position: [0, 0.34, 2.35] }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ display: "block" }}
    >
      <Scene modelUrl={modelUrl} state={state} mouthRef={mouthRef} idleMotion={idleMotion} />
    </Canvas>
  );
}
