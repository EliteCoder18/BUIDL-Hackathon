"use client";

import { Line, OrbitControls, Sparkles, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrchestratorState } from "../../lib/trustfutures/orchestrator";

type Vec3 = [number, number, number];
type TopologyEvidence = {
  sepoliaTxHash?: string;
  creditcoinTxHash?: string;
  proofId?: string;
};
type Props = { state: OrchestratorState; evidence?: TopologyEvidence };

const networks = {
  sepolia: { position: [-2.82, -0.12, 0.25] as Vec3, label: "SEPOLIA / 11155111", color: "#c8ff5a" },
  attestcoin: { position: [0, 0.9, 0.6] as Vec3, label: "ATTESTCOIN / PROVER", color: "#a996ff" },
  creditcoin: { position: [2.82, -0.28, 0.15] as Vec3, label: "CREDITCOIN / 102031", color: "#ffb45d" },
};

type Route = { from: Vec3; to: Vec3; color: string };

function activeRoute(state: OrchestratorState): Route | null {
  if (["SEPOLIA_MANDATE_PENDING", "SEPOLIA_MANDATE_MINED", "AUCTION_ACTIVE"].includes(state)) {
    return { from: networks.sepolia.position, to: networks.attestcoin.position, color: networks.sepolia.color };
  }
  if (["QUOTE_SIGNED", "CREDITCOIN_POLICY_LOCKED"].includes(state)) {
    return { from: networks.attestcoin.position, to: networks.creditcoin.position, color: networks.creditcoin.color };
  }
  if (state === "ATTESTCOIN_PROVING") {
    return { from: networks.sepolia.position, to: networks.attestcoin.position, color: "#ff5e66" };
  }
  if (["SETTLED_SUCCESS", "SETTLED_SLASHED"].includes(state)) {
    return { from: networks.attestcoin.position, to: networks.creditcoin.position, color: state === "SETTLED_SUCCESS" ? "#c8ff5a" : "#ff5e66" };
  }
  return null;
}

function routeCurve(from: Vec3, to: Vec3, lift = 1.55) {
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(...from),
    new THREE.Vector3((from[0] + to[0]) / 2, Math.max(from[1], to[1]) + lift, -0.35),
    new THREE.Vector3(...to),
  );
}

const NetworkLabel = memo(function NetworkLabel({ position, label, color }: { position: Vec3; label: string; color: string }) {
  return (
    <group position={[position[0], position[1] - 1.22, position[2]]}>
      <Text fontSize={0.18} letterSpacing={0.11} color={color} anchorX="center" anchorY="middle">
        {label}
      </Text>
      <mesh position={[0, -0.22, 0]}><planeGeometry args={[1.25, 0.012]} /><meshBasicMaterial color={color} transparent opacity={0.35} /></mesh>
    </group>
  );
});

const EclipseBody = memo(function EclipseBody() {
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (halo.current) halo.current.rotation.z = clock.getElapsedTime() * 0.025;
  });
  return (
    <group position={[0, 0.1, -3.1]}>
      <mesh><sphereGeometry args={[2.75, 64, 64]} /><meshPhysicalMaterial color="#0b0711" roughness={0.88} metalness={0.08} /></mesh>
      <mesh ref={halo} scale={1.06}><torusGeometry args={[2.7, 0.025, 10, 160]} /><meshBasicMaterial color="#ff5e66" transparent opacity={0.5} /></mesh>
      <pointLight position={[-2.5, 1.8, 2.4]} color="#ff5e66" intensity={10} distance={8} />
      <pointLight position={[2.4, -1.1, 2]} color="#a996ff" intensity={8} distance={7} />
    </group>
  );
});

const OrbitRings = memo(function OrbitRings() {
  const group = useRef<THREE.Group>(null);
  const rings = useMemo(() => [
    { radiusX: 5.25, radiusY: 2.1, rotation: 0.06, color: "#a996ff" },
    { radiusX: 4.65, radiusY: 2.72, rotation: -0.22, color: "#ff5e66" },
    { radiusX: 3.72, radiusY: 3.25, rotation: 0.31, color: "#c8ff5a" },
  ].map((ring) => ({
    ...ring,
    points: new THREE.EllipseCurve(0, 0, ring.radiusX, ring.radiusY).getPoints(120).map((point) => [point.x, point.y, 0] as Vec3),
  })), []);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.z += Math.min(delta, 1 / 30) * 0.016;
  });
  return (
    <group ref={group} position={[0, 0.1, -1.8]}>
      {rings.map((ring, index) => (
        <group key={ring.color} rotation={[Math.PI / 2.25, ring.rotation, ring.rotation]}>
          <Line points={ring.points} color={ring.color} transparent opacity={index === 0 ? 0.19 : 0.11} lineWidth={0.75} />
        </group>
      ))}
    </group>
  );
});

const SepoliaCrystal = memo(function SepoliaCrystal() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = clock.getElapsedTime() * 0.27;
      group.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.6) * 0.08;
    }
  });
  return (
    <group ref={group} position={networks.sepolia.position}>
      <mesh scale={[0.72, 1.08, 0.72]}><octahedronGeometry args={[0.78, 0]} /><meshPhysicalMaterial color="#c8ff5a" emissive="#75b827" emissiveIntensity={1.6} transparent opacity={0.88} wireframe /></mesh>
      <mesh scale={[0.35, 0.62, 0.35]}><octahedronGeometry args={[0.78, 0]} /><meshStandardMaterial color="#eaffba" emissive="#c8ff5a" emissiveIntensity={2.3} /></mesh>
      <pointLight color="#c8ff5a" intensity={8} distance={4.5} />
    </group>
  );
});

const VerifierAperture = memo(function VerifierAperture() {
  const outer = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (outer.current) outer.current.rotation.z = -clock.getElapsedTime() * 0.22;
    if (core.current) core.current.scale.setScalar(0.9 + Math.sin(clock.getElapsedTime() * 2) * 0.08);
  });
  return (
    <group position={networks.attestcoin.position}>
      <group ref={outer} rotation={[Math.PI / 2, 0, 0]}>
        <mesh><torusGeometry args={[0.76, 0.08, 8, 6]} /><meshStandardMaterial color="#a996ff" emissive="#7560dd" emissiveIntensity={2} wireframe /></mesh>
        <mesh rotation={[0, 0, Math.PI / 6]}><torusGeometry args={[0.54, 0.025, 6, 6]} /><meshBasicMaterial color="#d4cbff" /></mesh>
      </group>
      <mesh ref={core}><icosahedronGeometry args={[0.25, 1]} /><meshStandardMaterial color="#f1edff" emissive="#a996ff" emissiveIntensity={2.8} /></mesh>
      <pointLight color="#a996ff" intensity={9} distance={4.5} />
    </group>
  );
});

const CapitalGyroscope = memo(function CapitalGyroscope() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = clock.getElapsedTime() * 0.24;
      group.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.4) * 0.12;
    }
  });
  return (
    <group ref={group} position={networks.creditcoin.position}>
      {[-0.18, 0, 0.18].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.48, 0.48, 0.12, 32]} />
          <meshStandardMaterial color="#ffb45d" emissive="#b8641e" emissiveIntensity={1.25} metalness={0.8} roughness={0.23} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0.4, 0]}><torusGeometry args={[0.82, 0.025, 8, 72]} /><meshBasicMaterial color="#ffd3a0" transparent opacity={0.85} /></mesh>
      <mesh rotation={[0.35, Math.PI / 2, 0]}><torusGeometry args={[0.72, 0.025, 8, 72]} /><meshBasicMaterial color="#ffb45d" transparent opacity={0.6} /></mesh>
      <pointLight color="#ffb45d" intensity={9} distance={4.5} />
    </group>
  );
});

function RestingRoute({ from, to, color }: Route) {
  const points = useMemo(() => routeCurve(from, to, 1.25).getPoints(48).map((point) => [point.x, point.y, point.z] as Vec3), [from, to]);
  return <Line points={points} color={color} transparent opacity={0.14} lineWidth={0.85} dashed dashScale={5} dashSize={0.35} gapSize={0.55} />;
}

function ParticleBeam({ route }: { route: Route | null }) {
  const particle = useRef<THREE.Mesh>(null);
  const targetProgress = useRef(0);
  const velocity = useRef(new THREE.Vector3());
  const curve = useMemo(() => route ? routeCurve(route.from, route.to) : null, [route]);

  useEffect(() => {
    targetProgress.current = 0;
    velocity.current.set(0, 0, 0);
    if (curve && particle.current) particle.current.position.copy(curve.getPoint(0));
  }, [curve]);

  useFrame((_, delta) => {
    if (!curve || !particle.current) return;
    // Semi-implicit Euler integration gives the proof particle physical inertia.
    targetProgress.current = (targetProgress.current + delta * 0.28) % 1;
    const target = curve.getPoint(targetProgress.current);
    const acceleration = target.clone().sub(particle.current.position).multiplyScalar(30).addScaledVector(velocity.current, -7.75);
    const boundedDelta = Math.min(delta, 1 / 30);
    velocity.current.addScaledVector(acceleration, boundedDelta);
    particle.current.position.addScaledVector(velocity.current, boundedDelta);
  });

  if (!curve || !route) return null;
  const points = curve.getPoints(56).map((point) => [point.x, point.y, point.z] as Vec3);
  return (
    <>
      <Line points={points} color={route.color} transparent opacity={0.72} lineWidth={1.8} />
      <mesh ref={particle}><sphereGeometry args={[0.105, 18, 18]} /><meshBasicMaterial color="#fffaf2" /><pointLight color={route.color} intensity={6} distance={2.5} /></mesh>
    </>
  );
}

const Scene = memo(function Scene({ state }: Pick<Props, "state">) {
  const route = activeRoute(state);
  return (
    <>
      <color attach="background" args={["#07050d"]} />
      <fog attach="fog" args={["#07050d", 8, 17]} />
      <ambientLight intensity={0.24} />
      <EclipseBody />
      <OrbitRings />
      <Sparkles count={86} scale={[12, 7, 4]} size={1.35} speed={0.1} color="#c7b9ff" />
      <RestingRoute from={networks.sepolia.position} to={networks.attestcoin.position} color={networks.sepolia.color} />
      <RestingRoute from={networks.attestcoin.position} to={networks.creditcoin.position} color={networks.creditcoin.color} />
      <SepoliaCrystal />
      <VerifierAperture />
      <CapitalGyroscope />
      <NetworkLabel {...networks.sepolia} />
      <NetworkLabel {...networks.attestcoin} />
      <NetworkLabel {...networks.creditcoin} />
      <ParticleBeam route={route} />
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.06} minDistance={7.4} maxDistance={11.5} minPolarAngle={Math.PI / 3.25} maxPolarAngle={Math.PI / 1.78} minAzimuthAngle={-0.28} maxAzimuthAngle={0.28} />
    </>
  );
});

/** A WebGL DAG; state controls which inter-chain beam is physically in motion. */
function shortReference(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export const CrossChainTopology = memo(function CrossChainTopology({ state, evidence }: Props) {
  const references = [
    evidence?.sepoliaTxHash && { network: "SEPOLIA", value: evidence.sepoliaTxHash },
    evidence?.proofId && { network: "ATTESTCOIN", value: evidence.proofId },
    evidence?.creditcoinTxHash && { network: "CREDITCOIN", value: evidence.creditcoinTxHash },
  ].filter((reference): reference is { network: string; value: string } => Boolean(reference));

  return (
    <div className="topology-canvas topology-canvas--eclipse" role="img" aria-label={`Cross-chain topology. Current saga state: ${state}`}>
      <Canvas camera={{ position: [0, 0.55, 9.6], fov: 41 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
        <Scene state={state} />
      </Canvas>
      <span className="topology-state"><i /> SAGA / {state.replaceAll("_", " ")}</span>
      {references.length > 0 && (
        <div className="topology-evidence" aria-label="Confirmed transaction evidence">
          {references.map((reference) => <span key={reference.network}><b>{reference.network}</b><code title={reference.value}>{shortReference(reference.value)}</code></span>)}
        </div>
      )}
      <span className="topology-instruction">DRAG TO ORBIT · SCROLL TO MAGNIFY</span>
    </div>
  );
});
