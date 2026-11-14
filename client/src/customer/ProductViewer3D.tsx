import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { resolveAssetUrl } from '../shared/lib/assetUrl';

type ProductViewerProps = {
  modelUrl?: string;
  productName: string;
  onError: () => void;
};

export function preloadProductModel(modelUrl: string) {
  useGLTF.preload(resolveAssetUrl(modelUrl), true, true);
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(preference.matches);
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

function ProductModel({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(resolveAssetUrl(modelUrl), true, true);
  const model = useMemo(() => {
    const object = scene.clone(true);
    object.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const longestSide = Math.max(size.x, size.y, size.z);
    const scale = Number.isFinite(longestSide) && longestSide > 0 ? 2 / longestSide : 1;

    return {
      object,
      position: center.multiplyScalar(-scale),
      scale,
    };
  }, [scene]);

  return (
    <group position={model.position} scale={model.scale}>
      <primitive object={model.object} dispose={null} />
    </group>
  );
}

function createShoeGeometry(drawShape: (shape: THREE.Shape) => void, depth: number) {
  const shape = new THREE.Shape();
  drawShape(shape);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
  });
}

function GenericShoeModel() {
  const shoe = useMemo(() => {
    const outsole = createShoeGeometry((shape) => {
      shape.moveTo(-1.03, -0.4);
      shape.quadraticCurveTo(-1.08, -0.34, -1.02, -0.29);
      shape.lineTo(0.78, -0.29);
      shape.quadraticCurveTo(0.98, -0.3, 1.08, -0.39);
      shape.quadraticCurveTo(1.12, -0.46, 1.02, -0.49);
      shape.lineTo(-0.91, -0.49);
      shape.quadraticCurveTo(-1.03, -0.48, -1.03, -0.4);
      shape.closePath();
    }, 0.48);
    const midsole = createShoeGeometry((shape) => {
      shape.moveTo(-0.98, -0.36);
      shape.lineTo(0.82, -0.36);
      shape.quadraticCurveTo(1.02, -0.36, 1.05, -0.31);
      shape.lineTo(-0.95, -0.3);
      shape.closePath();
    }, 0.44);
    const upper = createShoeGeometry((shape) => {
      shape.moveTo(-0.92, -0.29);
      shape.lineTo(-0.84, 0.02);
      shape.quadraticCurveTo(-0.8, 0.16, -0.63, 0.18);
      shape.lineTo(-0.34, 0.16);
      shape.quadraticCurveTo(-0.08, 0.14, 0.12, 0.08);
      shape.lineTo(0.7, -0.06);
      shape.quadraticCurveTo(0.93, -0.12, 1.02, -0.25);
      shape.lineTo(0.94, -0.32);
      shape.lineTo(-0.85, -0.32);
      shape.closePath();
    }, 0.4);
    const heelPanel = createShoeGeometry((shape) => {
      shape.moveTo(-0.84, 0.03);
      shape.quadraticCurveTo(-0.79, 0.16, -0.63, 0.18);
      shape.lineTo(-0.45, 0.17);
      shape.lineTo(-0.52, -0.24);
      shape.lineTo(-0.8, -0.25);
      shape.closePath();
    }, 0.018);
    const toePanel = createShoeGeometry((shape) => {
      shape.moveTo(0.56, 0.01);
      shape.quadraticCurveTo(0.8, -0.06, 0.98, -0.22);
      shape.lineTo(0.9, -0.28);
      shape.lineTo(0.52, -0.24);
      shape.closePath();
    }, 0.018);
    const tongue = createShoeGeometry((shape) => {
      shape.moveTo(-0.38, 0.13);
      shape.lineTo(-0.32, 0.34);
      shape.quadraticCurveTo(-0.16, 0.42, 0, 0.32);
      shape.lineTo(0.02, 0.13);
      shape.closePath();
    }, 0.04);
    const laces: THREE.TubeGeometry[] = [];
    const addLace = (start: THREE.Vector3, end: THREE.Vector3) => {
      const curve = new THREE.CatmullRomCurve3([start, end]);
      laces.push(new THREE.TubeGeometry(curve, 8, 0.012, 5, false));
    };
    for (let index = 0; index < 4; index += 1) {
      const x = -0.29 + index * 0.1;
      const y = 0.12 - index * 0.025;
      addLace(new THREE.Vector3(x, y, 0.222), new THREE.Vector3(x + 0.13, y + 0.055, 0.222));
      addLace(new THREE.Vector3(x, y + 0.055, 0.222), new THREE.Vector3(x + 0.13, y, 0.222));
    }

    return { outsole, midsole, upper, heelPanel, toePanel, tongue, laces };
  }, []);

  return (
    <group>
      <mesh geometry={shoe.outsole} position={[0, 0, -0.24]}>
        <meshStandardMaterial color="#465248" roughness={0.88} />
      </mesh>
      <mesh geometry={shoe.midsole} position={[0, 0, -0.22]}>
        <meshStandardMaterial color="#f4efe4" roughness={0.72} />
      </mesh>
      <mesh geometry={shoe.upper} position={[0, 0, -0.2]}>
        <meshStandardMaterial color="#d9c8a9" roughness={0.78} />
      </mesh>
      <mesh geometry={shoe.heelPanel} position={[0, 0, 0.2]}>
        <meshStandardMaterial color="#8c6948" roughness={0.8} />
      </mesh>
      <mesh geometry={shoe.toePanel} position={[0, 0, 0.2]}>
        <meshStandardMaterial color="#c0a57e" roughness={0.78} />
      </mesh>
      <mesh geometry={shoe.tongue} position={[0, 0, 0.18]}>
        <meshStandardMaterial color="#c9b58f" roughness={0.8} />
      </mesh>
      {shoe.laces.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color="#fff9ee" roughness={0.68} />
        </mesh>
      ))}
    </group>
  );
}

class ModelErrorBoundary extends Component<{
  children: ReactNode;
  onError: () => void;
}, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function CanvasFallback({ onError }: { onError: () => void }) {
  useEffect(() => onError(), [onError]);
  return <div className="product-detail__viewer-loading" role="status">3D preview unavailable. Showing photos instead.</div>;
}

export default function ProductViewer3D({ modelUrl, productName, onError }: ProductViewerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="product-detail__viewer" aria-label={`${productName} 3D model viewer`}>
      <Canvas
        camera={{ position: [0, 0, 4], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        fallback={<CanvasFallback onError={onError} />}
      >
        <color attach="background" args={['#f7f5ef']} />
        <ambientLight intensity={1.2} />
        <hemisphereLight args={['#fffdf7', '#d1d6cd', 1.1]} />
        <directionalLight position={[4, 5, 5]} intensity={2} />
        <directionalLight position={[-4, 3, -2]} intensity={0.7} />
        <ModelErrorBoundary onError={onError}>
          <Suspense fallback={<Html center><span className="product-detail__viewer-loading-label">Loading 3D preview…</span></Html>}>
            <Bounds fit clip observe margin={1.25}>
              {modelUrl ? <ProductModel modelUrl={modelUrl} /> : <GenericShoeModel />}
            </Bounds>
          </Suspense>
        </ModelErrorBoundary>
        <OrbitControls
          makeDefault
          enableDamping={!prefersReducedMotion}
          dampingFactor={0.08}
          enablePan={false}
          autoRotate={false}
          minDistance={2}
          maxDistance={8}
        />
      </Canvas>
    </div>
  );
}
