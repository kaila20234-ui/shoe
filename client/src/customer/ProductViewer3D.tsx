import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { resolveAssetUrl } from '../shared/lib/assetUrl';

type ProductViewerProps = {
  modelUrl: string;
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
              <ProductModel modelUrl={modelUrl} />
            </Bounds>
          </Suspense>
        </ModelErrorBoundary>
        <OrbitControls
          makeDefault
          enableDamping={!prefersReducedMotion}
          dampingFactor={0.08}
          enablePan={false}
          autoRotate={false}
          minDistance={2.5}
          maxDistance={6}
        />
      </Canvas>
    </div>
  );
}
