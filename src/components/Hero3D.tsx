
"use client";
import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Float, OrbitControls, Sparkles as DreiSparkles } from "@react-three/drei";
import * as THREE from 'three';

function MemoryNodes() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
      groupRef.current.rotation.x = clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <DreiSparkles count={500} scale={20} size={2} speed={0.4} opacity={0.6} color="#4fd1c5" />
      <DreiSparkles count={300} scale={15} size={3} speed={0.2} opacity={0.4} color="#6366f1" />
      <DreiSparkles count={100} scale={25} size={4} speed={0.5} opacity={0.3} color="#f472b6" />
    </group>
  );
}

function UniverseScene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Stars radius={100} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />
      <MemoryNodes />
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh position={[0, 0, -5]}>
          <octahedronGeometry args={[1.5, 0]} />
          <meshStandardMaterial color="#6366f1" wireframe emissive="#3b82f6" emissiveIntensity={0.5} transparent opacity={0.2} />
        </mesh>
      </Float>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
    </>
  );
}

export default function Hero3D() {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
      <Suspense fallback={null}>
        <UniverseScene />
      </Suspense>
    </Canvas>
  );
}
