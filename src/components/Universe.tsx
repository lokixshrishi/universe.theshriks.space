import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";

export type StarRecord = {
  id: string;
  name: string;
  message: string;
  x: number;
  y: number;
  z: number;
  color: string;
  size: number;
  category?: string;
  created_at: string;
};

export type UniverseHandle = {
  flyToStar: (id: string, options?: { close?: boolean; pulse?: boolean }) => void;
  getStar: (id: string) => StarRecord | undefined;
  findByName: (q: string) => StarRecord | undefined;
};

type Props = {
  stars: StarRecord[];
  onHover?: (star: StarRecord | null, screen: { x: number; y: number } | null) => void;
  onClick?: (star: StarRecord) => void;
  initialFocusId?: string | null;
};

const STAR_VS = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vColor = aColor;
    float tw = 0.75 + 0.25 * sin(uTime * 0.6 + aSeed * 12.0);
    vTwinkle = tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(2.0, aSize * (400.0 / -mv.z)) * uPixelRatio * tw;
  }
`;

const STAR_FS = `
  precision highp float;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // soft core + halo
    float core = smoothstep(0.45, 0.0, d);
    float halo = smoothstep(0.5, 0.15, d) * 0.55;
    float a = core + halo;
    vec3 col = vColor * (1.4 * core + 0.7 * halo) * vTwinkle;
    gl_FragColor = vec4(col, a);
  }
`;

const NEBULA_VS = `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (500.0 / -mv.z) * uPixelRatio;
  }
`;

const NEBULA_FS = `
  precision highp float;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d) * 0.18;
    gl_FragColor = vec4(vColor, a);
  }
`;

const GALAXY_VS = `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    // Rotate slowly based on time and position
    float angle = uTime * 0.1 + length(position.xy) * 0.02;
    float c = cos(angle);
    float s = sin(angle);
    vec3 pos = vec3(position.x * c - position.y * s, position.x * s + position.y * c, position.z);
    
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (600.0 / -mv.z) * uPixelRatio;
  }
`;

const GALAXY_FS = `
  precision highp float;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    
    // Core glow + swirl effect
    float core = smoothstep(0.5, 0.0, d);
    float arms = smoothstep(0.4, 0.0, d) * (0.5 + 0.5 * sin(atan(c.y, c.x) * 4.0 - d * 10.0));
    
    float a = (core * 0.8 + arms * 0.4) * 0.4; // Stronger core, faint arms
    vec3 col = vColor + (vec3(1.0) * core * 0.4); // Brighten the core
    
    gl_FragColor = vec4(col, a);
  }
`;

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export const Universe = forwardRef<UniverseHandle, Props>(function Universe(
  { stars, onHover, onClick, initialFocusId },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    starsPoints?: THREE.Points;
    nebulaPoints?: THREE.Points;
    galaxyPoints?: THREE.Points;
    raycaster: THREE.Raycaster;
    pointer: THREE.Vector2;
    starsArr: StarRecord[];
    cameraTarget: THREE.Vector3;
    cameraDesired: THREE.Vector3;
    lookAt: THREE.Vector3;
    lookDesired: THREE.Vector3;
    autoDriftAngle: number;
    isDragging: boolean;
    lastPointer: { x: number; y: number };
    rotation: { x: number; y: number };
    dispose: () => void;
  } | null>(null);

  // Build/rebuild stars buffer when stars list changes
  useEffect(() => {
    if (!stateRef.current) return;
    const { scene, starsPoints, nebulaPoints } = stateRef.current;
    if (starsPoints) {
      scene.remove(starsPoints);
      starsPoints.geometry.dispose();
      (starsPoints.material as THREE.Material).dispose();
    }
    if (nebulaPoints) {
      scene.remove(nebulaPoints);
      nebulaPoints.geometry.dispose();
      (nebulaPoints.material as THREE.Material).dispose();
    }
    const { galaxyPoints } = stateRef.current;
    if (galaxyPoints) {
      scene.remove(galaxyPoints);
      galaxyPoints.geometry.dispose();
      (galaxyPoints.material as THREE.Material).dispose();
    }

    if (stars.length === 0) {
      stateRef.current.starsPoints = undefined;
      stateRef.current.nebulaPoints = undefined;
      stateRef.current.galaxyPoints = undefined;
      stateRef.current.starsArr = [];
      return;
    }

    // STARS
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    const sizes = new Float32Array(stars.length);
    const seeds = new Float32Array(stars.length);
    stars.forEach((s, i) => {
      positions[i * 3] = s.x;
      positions[i * 3 + 1] = s.y;
      positions[i * 3 + 2] = s.z;
      const [r, g, b] = hexToRGB(s.color);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
      sizes[i] = Math.max(0.6, s.size) * 2.2;
      seeds[i] = Math.random();
    });
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geom.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: STAR_VS,
      fragmentShader: STAR_FS,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, material);
    scene.add(points);
    stateRef.current.starsPoints = points;
    stateRef.current.starsArr = stars;

    // NEBULAE — cluster every 100 stars
    if (stars.length >= 100) {
      const sorted = [...stars].sort(
        (a, b) => a.x + a.y * 0.3 + a.z * 0.7 - (b.x + b.y * 0.3 + b.z * 0.7),
      );
      const groups: { cx: number; cy: number; cz: number; color: [number, number, number] }[] = [];
      const PALETTE: [number, number, number][] = [
        [0.55, 0.35, 0.85], // violet
        [0.3, 0.7, 0.85], // teal
        [0.95, 0.4, 0.75], // magenta
        [0.7, 0.45, 0.95], // lilac
      ];
      for (let i = 0; i + 100 <= sorted.length; i += 100) {
        const slice = sorted.slice(i, i + 100);
        const cx = slice.reduce((s, p) => s + p.x, 0) / slice.length;
        const cy = slice.reduce((s, p) => s + p.y, 0) / slice.length;
        const cz = slice.reduce((s, p) => s + p.z, 0) / slice.length;
        groups.push({ cx, cy, cz, color: PALETTE[groups.length % PALETTE.length] });
      }
      // Each nebula = many soft cloud sprites scattered around its center
      const PER = 80;
      const total = groups.length * PER;
      const nPos = new Float32Array(total * 3);
      const nCol = new Float32Array(total * 3);
      const nSize = new Float32Array(total);
      let k = 0;
      groups.forEach((g) => {
        for (let i = 0; i < PER; i++) {
          // gaussian-ish cluster
          const r = Math.pow(Math.random(), 0.6) * 65;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          nPos[k * 3] = g.cx + r * Math.sin(phi) * Math.cos(theta);
          nPos[k * 3 + 1] = g.cy + r * Math.sin(phi) * Math.sin(theta) * 0.7;
          nPos[k * 3 + 2] = g.cz + r * Math.cos(phi);
          // color jitter
          const j = 0.85 + Math.random() * 0.3;
          nCol[k * 3] = g.color[0] * j;
          nCol[k * 3 + 1] = g.color[1] * j;
          nCol[k * 3 + 2] = g.color[2] * j;
          nSize[k] = 30 + Math.random() * 50;
          k++;
        }
      });
      const ngeom = new THREE.BufferGeometry();
      ngeom.setAttribute("position", new THREE.BufferAttribute(nPos, 3));
      ngeom.setAttribute("aColor", new THREE.BufferAttribute(nCol, 3));
      ngeom.setAttribute("aSize", new THREE.BufferAttribute(nSize, 1));
      const nmat = new THREE.ShaderMaterial({
        vertexShader: NEBULA_VS,
        fragmentShader: NEBULA_FS,
        uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const npoints = new THREE.Points(ngeom, nmat);
      scene.add(npoints);
      stateRef.current.nebulaPoints = npoints;
    }

    // GALAXIES — cluster every 10,000 stars (100 nebulae)
    if (stars.length >= 10000) {
      const sorted = [...stars].sort(
        (a, b) => a.x + a.y * 0.3 + a.z * 0.7 - (b.x + b.y * 0.3 + b.z * 0.7),
      );
      const groups: { cx: number; cy: number; cz: number; color: [number, number, number] }[] = [];
      const PALETTE: [number, number, number][] = [
        [0.85, 0.45, 0.35], // warm amber
        [0.35, 0.55, 0.95], // deep blue
        [0.95, 0.25, 0.65], // bright pink
        [0.45, 0.85, 0.55], // pale green
      ];
      for (let i = 0; i + 10000 <= sorted.length; i += 10000) {
        const slice = sorted.slice(i, i + 10000);
        const cx = slice.reduce((s, p) => s + p.x, 0) / slice.length;
        const cy = slice.reduce((s, p) => s + p.y, 0) / slice.length;
        const cz = slice.reduce((s, p) => s + p.z, 0) / slice.length;
        groups.push({ cx, cy, cz, color: PALETTE[groups.length % PALETTE.length] });
      }

      const PER_GALAXY = 400; // lots of particles per galaxy
      const total = groups.length * PER_GALAXY;
      const gPos = new Float32Array(total * 3);
      const gCol = new Float32Array(total * 3);
      const gSize = new Float32Array(total);
      let k = 0;

      groups.forEach((g) => {
        for (let i = 0; i < PER_GALAXY; i++) {
          const u = Math.random();
          const theta = u * Math.PI * 8; // spiral arms
          const r = Math.pow(u, 0.5) * 350; // spread
          const phi = Math.acos(2 * Math.random() - 1);
          const jitter = 40 * Math.random();

          gPos[k * 3] = g.cx + r * Math.cos(theta) + jitter * Math.sin(phi) * Math.cos(theta);
          gPos[k * 3 + 1] = g.cy + r * 0.2 * Math.sin(theta) + jitter * Math.cos(phi);
          gPos[k * 3 + 2] = g.cz + r * Math.sin(theta) + jitter * Math.sin(phi) * Math.sin(theta);

          const j = 0.7 + Math.random() * 0.6;
          gCol[k * 3] = g.color[0] * j;
          gCol[k * 3 + 1] = g.color[1] * j;
          gCol[k * 3 + 2] = g.color[2] * j;
          gSize[k] = 50 + Math.random() * 100;
          k++;
        }
      });

      const ggeom = new THREE.BufferGeometry();
      ggeom.setAttribute("position", new THREE.BufferAttribute(gPos, 3));
      ggeom.setAttribute("aColor", new THREE.BufferAttribute(gCol, 3));
      ggeom.setAttribute("aSize", new THREE.BufferAttribute(gSize, 1));
      const gmat = new THREE.ShaderMaterial({
        vertexShader: GALAXY_VS,
        fragmentShader: GALAXY_FS,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const gpoints = new THREE.Points(ggeom, gmat);
      scene.add(gpoints);
      stateRef.current.galaxyPoints = gpoints;
    }
  }, [stars]);

  useImperativeHandle(
    ref,
    () => ({
      flyToStar: (id, options) => {
        const st = stateRef.current;
        if (!st) return;
        const s = st.starsArr.find((x) => x.id === id);
        if (!s) return;
        const target = new THREE.Vector3(s.x, s.y, s.z);
        const dir = target.clone().sub(st.camera.position).normalize();
        const dist = options?.close ? 12 : 28;
        st.cameraDesired.copy(target.clone().sub(dir.multiplyScalar(dist)));
        st.lookDesired.copy(target);
      },
      getStar: (id) => stateRef.current?.starsArr.find((s) => s.id === id),
      findByName: (q) => {
        const ql = q.toLowerCase().trim();
        if (!ql) return undefined;
        return stateRef.current?.starsArr.find((s) => s.name.toLowerCase().includes(ql));
      },
    }),
    [],
  );

  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(new THREE.Color(0x0a0815), 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0815, 0.0003);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      4000,
    );
    camera.position.set(0, 0, 360);

    // Ambient backdrop particles (the "void dust")
    const dustCount = 0;
    const dustGeom = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);
    const dustSeeds = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      const r = 200 + Math.random() * 1400;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      dustPos[i * 3] = r * Math.sin(p) * Math.cos(t);
      dustPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      dustPos[i * 3 + 2] = r * Math.cos(p);
      const tone = 0.6 + Math.random() * 0.4;
      dustColors[i * 3] = tone * 0.85;
      dustColors[i * 3 + 1] = tone * 0.88;
      dustColors[i * 3 + 2] = tone;
      dustSizes[i] = 0.4 + Math.random() * 0.8;
      dustSeeds[i] = Math.random();
    }
    dustGeom.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    dustGeom.setAttribute("aColor", new THREE.BufferAttribute(dustColors, 3));
    dustGeom.setAttribute("aSize", new THREE.BufferAttribute(dustSizes, 1));
    dustGeom.setAttribute("aSeed", new THREE.BufferAttribute(dustSeeds, 1));
    const dustMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VS,
      fragmentShader: STAR_FS,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeom, dustMat);
    scene.add(dust);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 4 };
    const pointer = new THREE.Vector2(-2, -2);

    const cameraTarget = camera.position.clone();
    const cameraDesired = camera.position.clone();
    const lookAt = new THREE.Vector3(0, 0, 0);
    const lookDesired = new THREE.Vector3(0, 0, 0);

    const state = {
      renderer,
      scene,
      camera,
      raycaster,
      pointer,
      starsArr: [] as StarRecord[],
      cameraTarget,
      cameraDesired,
      lookAt,
      lookDesired,
      autoDriftAngle: 0,
      isDragging: false,
      lastPointer: { x: 0, y: 0 },
      rotation: { x: 0, y: 0 },
      dispose: () => {},
    };
    stateRef.current = state as any;

    // === Interactions ===
    let userInteracting = false;
    let lastInteract = 0;

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      pointer.x = (x / rect.width) * 2 - 1;
      pointer.y = -(y / rect.height) * 2 + 1;

      if (state.isDragging) {
        const dx = e.clientX - state.lastPointer.x;
        const dy = e.clientY - state.lastPointer.y;
        state.rotation.y += dx * 0.0035;
        state.rotation.x += dy * 0.0025;
        state.rotation.x = Math.max(-1.2, Math.min(1.2, state.rotation.x));
        state.lastPointer = { x: e.clientX, y: e.clientY };
        userInteracting = true;
        lastInteract = performance.now();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      state.isDragging = true;
      state.lastPointer = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      state.isDragging = false;
    };
    const onClickEvt = (e: MouseEvent) => {
      // tiny click — not a drag
      if (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3) return;
      const st = stateRef.current!;
      if (!st.starsPoints) return;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(st.starsPoints, false);
      if (hits.length > 0) {
        const idx = hits[0].index!;
        const s = st.starsArr[idx];
        if (s) onClick?.(s);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = camera.position.clone().sub(lookDesired).normalize();
      const dist = camera.position.distanceTo(lookDesired);
      const newDist = Math.max(8, Math.min(900, dist + e.deltaY * 0.6));
      cameraDesired.copy(lookDesired.clone().add(dir.multiplyScalar(newDist)));
      userInteracting = true;
      lastInteract = performance.now();
    };

    // touch pinch
    const touches = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartCamDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      Array.from(e.touches).forEach((t) =>
        touches.set(t.identifier, { x: t.clientX, y: t.clientY }),
      );
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        pinchStartCamDist = camera.position.distanceTo(lookDesired);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = pinchStartDist / d;
        const dir = camera.position.clone().sub(lookDesired).normalize();
        const newDist = Math.max(8, Math.min(900, pinchStartCamDist * ratio));
        cameraDesired.copy(lookDesired.clone().add(dir.multiplyScalar(newDist)));
        userInteracting = true;
        lastInteract = performance.now();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      Array.from(e.changedTouches).forEach((t) => touches.delete(t.identifier));
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("click", onClickEvt);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);

    // ANIMATE
    const startTime = performance.now();
    let raf = 0;
    let lastHover: StarRecord | null = null;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = (performance.now() - startTime) / 1000;
      (dust.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      const sp = stateRef.current?.starsPoints;
      if (sp) (sp.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      const gp = stateRef.current?.galaxyPoints;
      if (gp) (gp.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

      // Slow autonomous drift when no interaction
      const now = performance.now();
      if (now - lastInteract > 3000) userInteracting = false;
      if (!userInteracting) {
        state.autoDriftAngle += 0.0006;
        state.rotation.y += 0.00025;
      }

      // Apply rotation to camera around lookDesired
      const radius = cameraDesired.distanceTo(lookDesired);
      const offset = new THREE.Vector3(
        Math.sin(state.rotation.y) * Math.cos(state.rotation.x) * radius,
        Math.sin(state.rotation.x) * radius,
        Math.cos(state.rotation.y) * Math.cos(state.rotation.x) * radius,
      );
      const desiredPos = lookDesired.clone().add(offset);

      camera.position.lerp(desiredPos, 0.035);
      lookAt.lerp(lookDesired, 0.04);
      camera.lookAt(lookAt);

      // raycast hover
      if (sp && !state.isDragging) {
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObject(sp, false);
        if (hits.length > 0) {
          const idx = hits[0].index!;
          const s = state.starsArr[idx];
          if (s && s !== lastHover) {
            lastHover = s;
            const projected = new THREE.Vector3(s.x, s.y, s.z).project(camera);
            const rect = renderer.domElement.getBoundingClientRect();
            onHover?.(s, {
              x: ((projected.x + 1) / 2) * rect.width,
              y: ((-projected.y + 1) / 2) * rect.height,
            });
          } else if (s) {
            const projected = new THREE.Vector3(s.x, s.y, s.z).project(camera);
            const rect = renderer.domElement.getBoundingClientRect();
            onHover?.(s, {
              x: ((projected.x + 1) / 2) * rect.width,
              y: ((-projected.y + 1) / 2) * rect.height,
            });
          }
        } else if (lastHover) {
          lastHover = null;
          onHover?.(null, null);
        }
      }

      renderer.render(scene, camera);
    };
    tick();

    state.dispose = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("click", onClickEvt);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      dustGeom.dispose();
      dustMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };

    return () => state.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initial focus when stars load
  useEffect(() => {
    if (!initialFocusId || !stateRef.current) return;
    if (stars.find((s) => s.id === initialFocusId)) {
      // delay to give scene a moment
      const t = setTimeout(() => {
        if ((stateRef.current as any)?.starsPoints) {
          (ref as any)?.current?.flyToStar?.(initialFocusId, { close: true });
        }
      }, 500);
      return () => clearTimeout(t);
    }
  }, [initialFocusId, stars, ref]);

  return <div ref={mountRef} className="absolute inset-0" />;
});
