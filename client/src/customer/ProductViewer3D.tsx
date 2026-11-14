import { Component, Suspense, useEffect, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Html, OrbitControls, useGLTF } from '@react-three/drei';

type ProductViewerProps = {
  modelUrl: string;
  productName: string;
  onError: () => void;
};

function ProductModel({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  return <primitive object={scene} dispose={null} />;
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
          <Suspense fallback={<Html center><span className="product-detail__viewer-loading-label">Loading 3D model…</span></Html>}>
            <Bounds fit clip observe margin={1.25}>
              <ProductModel modelUrl={modelUrl} />
            </Bounds>
          </Suspense>
        </ModelErrorBoundary>
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={2}
          maxDistance={8}
        />
      </Canvas>
    </div>
  );
}
