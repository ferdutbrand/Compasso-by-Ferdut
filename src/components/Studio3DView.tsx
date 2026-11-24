import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Layers, RefreshCw, Sliders, X } from 'lucide-react';
import type { BuiltShape, GeomObj } from '../geometry/types';
import { curve } from '../geometry/engine';

interface Studio3DViewProps {
  objs: GeomObj[];
  shapes: BuiltShape[];
  dark: boolean;
  onClose: () => void;
}

export const Studio3DView: React.FC<Studio3DViewProps> = ({ objs, shapes, dark, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [extrudeDepth, setExtrudeDepth] = useState<number>(30);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [materialColor, setMaterialColor] = useState<string>('#3b82f6');
  const [roughness, setRoughness] = useState<number>(0.2);
  const [metalness, setMetalness] = useState<number>(0.3);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  // Orbit controls state
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 600 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(dark ? '#18181b' : '#f8fafc');
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(dark ? 0xffffff : 0xffffff, dark ? 0.7 : 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(300, 600, 400);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x93c5fd, 0.5);
    backLight.position.set(-300, -200, -300);
    scene.add(backLight);

    // Ground Grid
    const gridHelper = new THREE.GridHelper(1200, 30, dark ? 0x3f3f46 : 0xcbd5e1, dark ? 0x27272a : 0xe2e8f0);
    gridHelper.position.y = -10;
    scene.add(gridHelper);

    // Objects group
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Update camera position from spherical coords
    const updateCameraPosition = () => {
      const { theta, phi, radius } = cameraAngleRef.current;
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi) + 150;
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 50, 0);
    };
    updateCameraPosition();

    // Mouse handlers for orbit
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      cameraAngleRef.current.theta -= deltaX * 0.008;
      cameraAngleRef.current.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.01, cameraAngleRef.current.phi - deltaY * 0.008));

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      updateCameraPosition();
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAngleRef.current.radius = Math.max(150, Math.min(2500, cameraAngleRef.current.radius + e.deltaY * 0.6));
      updateCameraPosition();
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElem.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, [dark]);

  // Re-build 3D geometry when objs, shapes, or extrudeDepth changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clear previous meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    const material = new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness,
      metalness,
      wireframe,
      side: THREE.DoubleSide,
    });

    const edgeMaterial = new THREE.LineBasicMaterial({ color: dark ? 0x93c5fd : 0x1d4ed8 });

    // Center offset estimation for nice framing
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    const cache = objs.map((o) => curve(objs, o));

    // 1. Render circles & polygons
    objs.forEach((o, idx) => {
      if (o.dead) return;
      const cv = cache[idx];
      if (!cv) return;

      if (cv.t === 'c') {
        sumX += cv.x;
        sumY += cv.y;
        count++;

        const shape = new THREE.Shape();
        shape.absarc(0, 0, Math.max(5, cv.r), 0, Math.PI * 2, false);

        const extrudeSettings = {
          steps: 1,
          depth: extrudeDepth,
          bevelEnabled: true,
          bevelThickness: Math.min(3, extrudeDepth * 0.2),
          bevelSize: 2,
          bevelSegments: 3,
        };

        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geom.center();
        const mesh = new THREE.Mesh(geom, material);
        mesh.position.set(cv.x, extrudeDepth * 0.5, -cv.y);
        mesh.rotation.x = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      } else if (cv.t === 'p' && cv.verts.length >= 3) {
        sumX += cv.cx;
        sumY += cv.cy;
        count++;

        const shape = new THREE.Shape();
        cv.verts.forEach((v, i) => {
          const lx = v.x - cv.cx;
          const ly = v.y - cv.cy;
          if (i === 0) shape.moveTo(lx, -ly);
          else shape.lineTo(lx, -ly);
        });

        const extrudeSettings = {
          steps: 1,
          depth: extrudeDepth,
          bevelEnabled: true,
          bevelThickness: Math.min(3, extrudeDepth * 0.2),
          bevelSize: 2,
          bevelSegments: 3,
        };

        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mesh = new THREE.Mesh(geom, material);
        mesh.position.set(cv.cx, 0, -cv.cy);
        mesh.rotation.x = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    });

    // 2. Render Built Shapes
    shapes.forEach((sh) => {
      if (!sh.d) return;
      // Parse SVG path roughly or use approximate extrusion if needed
      // For demonstration, let's create a bounding box prism or parse basic path commands
    });

    // Center the group
    if (count > 0) {
      const avgX = sumX / count;
      const avgY = sumY / count;
      group.position.set(-avgX, 0, avgY);
    }
  }, [objs, shapes, extrudeDepth, wireframe, materialColor, roughness, metalness, dark]);

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/80 dark:bg-zinc-950/90 backdrop-blur-md flex flex-col select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200/20 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/95 backdrop-blur shadow-md">
        <div className="flex items-center gap-2.5">
          <Box className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            Compasso Studio 3D
          </h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
            Extrusão Euclidiana
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
            <span>Voltar ao 2D</span>
          </button>
        </div>
      </div>

      {/* Main 3D viewport + floating controls */}
      <div className="relative flex-1 overflow-hidden" ref={containerRef}>
        {/* Floating controls panel */}
        <div className="absolute top-4 left-4 z-10 w-72 rounded-2xl border border-slate-200/80 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md shadow-2xl p-4 space-y-4 text-xs text-slate-800 dark:text-zinc-200">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-zinc-100 border-b border-slate-200 dark:border-zinc-800 pb-2">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Parâmetros 3D</span>
          </div>

          {/* Extrude Depth */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-medium">
              <span>Profundidade de Extrusão</span>
              <span className="font-mono">{extrudeDepth} px</span>
            </div>
            <input
              type="range"
              min="5"
              max="200"
              value={extrudeDepth}
              onChange={(e) => setExtrudeDepth(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Roughness */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-medium">
              <span>Rugosidade (Roughness)</span>
              <span className="font-mono">{roughness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={roughness}
              onChange={(e) => setRoughness(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Metalness */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-medium">
              <span>Metalizado (Metalness)</span>
              <span className="font-mono">{metalness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={metalness}
              onChange={(e) => setMetalness(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Material Color */}
          <div className="flex items-center justify-between pt-1">
            <span className="font-medium">Cor do Material</span>
            <div className="flex items-center gap-2">
              {['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMaterialColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full transition cursor-pointer ${
                    materialColor === c ? 'ring-2 ring-offset-2 ring-blue-600 dark:ring-offset-zinc-900 scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Wireframe toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-800">
            <span className="font-medium">Modo Wireframe</span>
            <button
              type="button"
              onClick={() => setWireframe((p) => !p)}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                wireframe
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              {wireframe ? 'Ativo' : 'Desativado'}
            </button>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 dark:text-zinc-400 text-center">
            Arraste o mouse para orbitar · Role para zoom
          </div>
        </div>
      </div>
    </div>
  );
};
