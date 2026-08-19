"use client";

import { Grid, Line, OrbitControls, Sparkles, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrchestratorState } from "../../lib/trustfutures/orchestrator";

type Vec3 = [number, number, number];
type Props = { state: OrchestratorState };

const networks = {
  sepolia: { position: [-3.35, 0, 0] as Vec3, label: "SEPOLIA / 11155111", color: "#66f7a1" },
  attestcoin: { position: [0, 0.55, 0] as Vec3, label: "ATTESTCOIN / PROVER", color: "#38d9ff" },
  creditcoin: { position: [3.35, -0.1, 0] as Vec3, label: "CREDITCOIN / 102031", color: "#ffbf47" },
};

function activeRoute(state: OrchestratorState): [Vec3, Vec3] | null {
  if (["SEPOLIA_MANDATE_PENDING", "SEPOLIA_MANDATE_MINED", "AUCTION_ACTIVE"].includes(state)) return [networks.sepolia.position, networks.attestcoin.position];
  if (["QUOTE_SIGNED", "CREDITCOIN_POLICY_LOCKED"].includes(state)) return [networks.attestcoin.position, networks.creditcoin.position];
  if (state === "ATTESTCOIN_PROVING") return [networks.sepolia.position, networks.attestcoin.position];
  if (["SETTLED_SUCCESS", "SETTLED_SLASHED"].includes(state)) return [networks.attestcoin.position, networks.creditcoin.position];
  return null;
}

const NetworkLabel = memo(function NetworkLabel({ position, label, color }: { position: Vec3; label: string; color: string }) {
  return <Text position={[position[0], position[1] - 1.25, position[2]]} fontSize={0.22} color={color} anchorX="center" anchorY="middle">{label}</Text>;
});

const SepoliaNode = memo(function SepoliaNode() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (group.current) group.current.rotation.y = clock.getElapsedTime() * 0.35; });
  return <group ref={group} position={networks.sepolia.position}><mesh><octahedronGeometry args={[0.78, 0]} /><meshStandardMaterial color="#66f7a1" emissive="#2bd66e" emissiveIntensity={1.6} wireframe /></mesh><pointLight color="#66f7a1" intensity={8} distance={4} /></group>;
});

const AttestcoinNode = memo(function AttestcoinNode() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (group.current) group.current.rotation.y = -clock.getElapsedTime() * 0.25; });
  return <group ref={group} position={networks.attestcoin.position}><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.78, 0.78, 0.42, 6]} /><meshStandardMaterial color="#38d9ff" emissive="#139dbb" emissiveIntensity={1.3} wireframe /></mesh><pointLight color="#38d9ff" intensity={7} distance={4} /></group>;
});

const CreditcoinNode = memo(function CreditcoinNode() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (group.current) group.current.rotation.y = clock.getElapsedTime() * 0.2; });
  return <group ref={group} position={networks.creditcoin.position}>{[-0.18, 0, 0.18].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.72, 0.72, 0.14, 32]} /><meshStandardMaterial color="#ffbf47" emissive="#d27e09" emissiveIntensity={1.2} metalness={0.75} roughness={0.28} /></mesh>)}<pointLight color="#ffbf47" intensity={7} distance={4} /></group>;
});

function ParticleBeam({ route }: { route: [Vec3, Vec3] | null }) {
  const particle = useRef<THREE.Mesh>(null);
  const targetProgress = useRef(0);
  const velocity = useRef(new THREE.Vector3());
  const curve = useMemo(() => route ? new THREE.QuadraticBezierCurve3(new THREE.Vector3(...route[0]), new THREE.Vector3((route[0][0] + route[1][0]) / 2, 1.6, 0), new THREE.Vector3(...route[1])) : null, [route]);
  useEffect(() => {
    targetProgress.current = 0;
    velocity.current.set(0, 0, 0);
    if (curve && particle.current) particle.current.position.copy(curve.getPoint(0));
  }, [curve]);
  useFrame((_, delta) => {
    if (!curve || !particle.current) return;
    // Semi-implicit Euler integration gives the proof particle physical inertia.
    targetProgress.current = (targetProgress.current + delta * 0.32) % 1;
    const target = curve.getPoint(targetProgress.current);
    const acceleration = target.clone().sub(particle.current.position).multiplyScalar(28)
      .addScaledVector(velocity.current, -7.5);
    velocity.current.addScaledVector(acceleration, Math.min(delta, 1 / 30));
    particle.current.position.addScaledVector(velocity.current, Math.min(delta, 1 / 30));
  });
  if (!curve) return null;
  const points = curve.getPoints(42).map((point) => [point.x, point.y, point.z] as Vec3);
  return <><Line points={points} color="#38d9ff" transparent opacity={0.48} lineWidth={1.5} dashed dashScale={6} dashSize={.5} gapSize={.35} /><mesh ref={particle}><sphereGeometry args={[0.13, 18, 18]} /><meshBasicMaterial color="#dffaff" /><pointLight color="#38d9ff" intensity={5} distance={2} /></mesh></>;
}

const Scene = memo(function Scene({ state }: Props) {
  const route = activeRoute(state);
  return <><color attach="background" args={["#03070c"]} /><fog attach="fog" args={["#03070c", 8, 17]} /><ambientLight intensity={0.3} /><Grid position={[0,-1.42,0]} args={[14,8]} cellColor="#163247" sectionColor="#205d78" cellSize={.35} sectionSize={1.4} fadeDistance={10} fadeStrength={1.5} infiniteGrid /><Sparkles count={55} scale={[10,5,2]} size={1} speed={0.12} color="#53849d" /><SepoliaNode /><AttestcoinNode /><CreditcoinNode /><NetworkLabel {...networks.sepolia} /><NetworkLabel {...networks.attestcoin} /><NetworkLabel {...networks.creditcoin} /><ParticleBeam route={route} /><OrbitControls enablePan={false} minDistance={7} maxDistance={13} minPolarAngle={Math.PI/3.2} maxPolarAngle={Math.PI/1.8} /></>;
});

/** A WebGL DAG; state controls which inter-chain beam is physically in motion. */
export const CrossChainTopology = memo(function CrossChainTopology({ state }: Props) {
  return <div className="topology-canvas" role="img" aria-label={`Cross-chain topology. Current saga state: ${state}`}><Canvas camera={{ position: [0, 0.4, 9], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }}><Scene state={state} /></Canvas><span className="topology-state">SAGA / {state.replaceAll("_", " ")}</span></div>;
});
