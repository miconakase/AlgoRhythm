import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applyMoves, getCubieColors } from '../lib/cubeState';
import { applyPyraminxMoves, getPyraminxFaces, TETRA_VERTICES } from '../lib/pyraminxState';
import { generateScramble } from '../lib/scramble';

const CUBIE_FILL = 0.975;
const CUBIE_RADIUS_FRACTION = 0.08;
const CUBE_SCALE = 1.5;
const DEFAULT_VIEW = [2.3, 1.75, 2.3];
const TETRA_SCALE = 1.5;
const TETRA_STICKER_FILL = 0.86;
const TETRA_STICKER_LIFT = 0.012;
const TETRA_BODY_COLOR = '#16161b';
const TETRA_VIEW = [5.6, 2.9, 5.6];
const TETRA_LOGO_PIECE = 'c0';
const TETRA_LOGO_FACE = 3;
// Decal size relative to its sticker; the logo art fills ~70% of the image.
const TETRA_LOGO_SIZE = 0.6;

// Upright equilateral triangle in the XY plane, centred on its centroid,
// apex along +Y and front face along +Z.
const buildTriangleGeometry = (side) => {
    const r = side / Math.sqrt(3);
    const h = side / 2;
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([0, r, 0, -h, -r / 2, 0, h, -r / 2, 0]), 3)
    );
    geometry.computeVertexNormals();

    return geometry;
};

const buildTetraGeometry = (scale) => {
    const v = TETRA_VERTICES.map((p) => new THREE.Vector3(...p).multiplyScalar(scale));
    const positions = [];

    for (let i = 0; i < 4; i++) {
        let [a, b, c] = [0, 1, 2, 3].filter((k) => k !== i).map((k) => v[k]);
        const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));

        // Wind each face away from the vertex opposite it so it faces outward.
        if (normal.dot(v[i]) > 0) {
            [b, c] = [c, b];
        }

        positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.computeVertexNormals();

    return geometry;
};

// Turns the model into WCA scrambling orientation: U tip up, green F face
// (opposite the B tip) towards the viewer, yellow D face underneath.
const TETRA_ORIENTATION = (() => {
    const up = new THREE.Vector3(...TETRA_VERTICES[0]).normalize();
    const front = new THREE.Vector3(...TETRA_VERTICES[3]).negate().normalize();

    front.addScaledVector(up, -front.dot(up)).normalize();

    const right = new THREE.Vector3().crossVectors(up, front);

    return new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(right, up, front).transpose()
    );
})();

export default function Cube3D({ kind = 'cube', size, moves, running, anchorRef, placement = 'right', canvasClass, brightness, auto = false }) {
    const engineRef = useRef(null);

    useEffect(() => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        const canvas = renderer.domElement;

        canvas.className =
            canvasClass ?? 'fixed z-10 block aspect-square w-56 transition duration-300 sm:w-80';
        document.body.appendChild(canvas);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(canvas.clientWidth || 240, canvas.clientWidth || 240, true);
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15 * (brightness ?? 1);

        const positionCanvas = () => {
            const anchor = anchorRef?.current;

            if (!anchor) {
                return;
            }

            const rect = anchor.getBoundingClientRect();

            if (placement === 'center') {
                canvas.style.left = `${rect.left + rect.width / 2 - canvas.clientWidth / 2}px`;
                canvas.style.top = `${rect.top + rect.height / 2 - canvas.clientHeight / 2}px`;
            } else {
                canvas.style.left = `${rect.right + 120}px`;
                canvas.style.top = `${rect.top + rect.height / 2 - canvas.clientHeight / 2}px`;
            }
        };

        positionCanvas();
        window.addEventListener('resize', positionCanvas);
        const anchorObserver = anchorRef?.current ? new ResizeObserver(positionCanvas) : null;

        anchorObserver?.observe(anchorRef.current);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x9096a3, 1.5 * (brightness ?? 1)));

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.7 * (brightness ?? 1));

        keyLight.position.set(3.5, 5, 2.5);
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x8fa3ff, 0.5 * (brightness ?? 1));

        rimLight.position.set(-3, -1, -2.5);
        scene.add(rimLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.85 * (brightness ?? 1));

        fillLight.position.set(-0.8, -2.8, -0.8);
        scene.add(fillLight);

        const controls = new OrbitControls(camera, renderer.domElement);

        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.enableZoom = false;

        const cubeGroup = new THREE.Group();

        scene.add(cubeGroup);

        const resetView = () => {
            camera.position.set(...(kind === 'pyraminx' ? TETRA_VIEW : DEFAULT_VIEW));
            controls.target.set(0, 0, 0);
            controls.update();
        };

        resetView();

        const onDblClick = () => resetView();

        renderer.domElement.addEventListener('dblclick', onDblClick);

        let frame;

        const loop = () => {
            controls.update();
            renderer.render(scene, camera);
            frame = requestAnimationFrame(loop);
        };

        frame = requestAnimationFrame(loop);

        const resize = () => {
            const { clientWidth, clientHeight } = canvas;

            renderer.setSize(clientWidth, clientHeight, true);
            camera.aspect = clientWidth / clientHeight;
            camera.updateProjectionMatrix();
        };

        const observer = new ResizeObserver(resize);

        observer.observe(canvas);

        engineRef.current = {
            scene,
            camera,
            controls,
            renderer,
            cubeGroup,
            geometry: null,
            // Per-build geometries (logo plane, pyraminx body) freed on every rebuild.
            buildGeometries: [],
            materials: new Map(),
            cubies: new Map(),
        };

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            anchorObserver?.disconnect();
            window.removeEventListener('resize', positionCanvas);
            renderer.domElement.removeEventListener('dblclick', onDblClick);
            controls.dispose();
            engineRef.current.materials.forEach((material) => material.dispose());
            engineRef.current.logoTexture?.dispose();

            if (engineRef.current.geometry) {
                engineRef.current.geometry.dispose();
            }

            engineRef.current.buildGeometries.forEach((geometry) => geometry.dispose());

            renderer.dispose();
            canvas.remove();
            engineRef.current = null;
        };
    }, [kind, placement, canvasClass, brightness]);

    useEffect(() => {
        const canvas = engineRef.current?.renderer.domElement;

        if (!canvas) {
            return;
        }

        canvas.classList.toggle('scale-90', running);
        canvas.classList.toggle('opacity-40', running);
    }, [running]);

    useEffect(() => {
        const engine = engineRef.current;

        if (!engine) {
            return;
        }

        while (engine.cubeGroup.children.length) {
            engine.cubeGroup.remove(engine.cubeGroup.children[0]);
        }

        if (engine.geometry) {
            engine.geometry.dispose();
        }

        engine.buildGeometries.forEach((geometry) => geometry.dispose());
        engine.buildGeometries = [];
        engine.cubies = new Map();

        const materialFor = (color) => {
            if (!engine.materials.has(color)) {
                engine.materials.set(
                    color,
                    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 })
                );
            }

            return engine.materials.get(color);
        };

        // The AlgoRhythm logo (AlgoRhythm_Transparent.png) is rendered as a
        // transparent decal on top of a sticker, with its alpha boosted in a
        // small shader so the asset's translucent ink stays visible. Texture
        // and material are built once per engine and reused across scrambles,
        // and kept in engine.materials so cleanup disposes them.
        const logoMaterial = () => {
            if (!engine.logoTexture) {
                engine.logoTexture = new THREE.TextureLoader().load('/AlgoRhythm_Transparent.png');
                engine.logoTexture.colorSpace = THREE.SRGBColorSpace;
            }

            const decalMaterial = engine.materials.get('logo') ?? new THREE.ShaderMaterial({
                uniforms: { uTex: { value: engine.logoTexture } },
                vertexShader: `
                    varying vec2 vUv;

                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D uTex;
                    varying vec2 vUv;

                    vec3 srgbToLinear(vec3 c) {
                        return c * c * (vec3(0.305306011) + c * (vec3(0.682171111) + c * vec3(0.012522878)));
                    }

                    vec3 acesTonemap(vec3 x) {
                        return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
                    }

                    vec3 linearToSrgb(vec3 c) {
                        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
                    }

                    void main() {
                        vec4 c = texture2D(uTex, vUv);
                        c.rgb = srgbToLinear(c.rgb);
                        c.rgb = acesTonemap(c.rgb * 1.15);
                        gl_FragColor = vec4(linearToSrgb(c.rgb), clamp(c.a * 1.6, 0.0, 1.0));
                    }
                `,
                transparent: true,
                alphaTest: 0.05,
                depthWrite: false,
            });

            engine.materials.set('logo', decalMaterial);

            return decalMaterial;
        };

        if (kind === 'pyraminx') {
            const side = (Math.sqrt(8) / 3) * TETRA_SCALE;
            const body = buildTetraGeometry(TETRA_SCALE);
            const matrix = new THREE.Matrix4();
            const right = new THREE.Vector3();
            const normal = new THREE.Vector3();
            const up = new THREE.Vector3();

            engine.geometry = buildTriangleGeometry(side * TETRA_STICKER_FILL);
            engine.buildGeometries.push(body);
            engine.cubeGroup.quaternion.copy(TETRA_ORIENTATION);
            engine.cubeGroup.add(new THREE.Mesh(body, materialFor(TETRA_BODY_COLOR)));

            // The logo rides the U axial piece's sticker that starts on the
            // green F face. Axial pieces only spin in place, so the logo always
            // stays beside the U tip, like the cube's logo on its fixed centre.
            // Centre stickers point away from U (▼), so the decal is turned to
            // point at U and nudged towards the sticker's wide edge to fit.
            const addTetraLogo = (stickerPos, stickerNormal, stickerUp) => {
                const stickerSide = side * TETRA_STICKER_FILL;
                const logoGeometry = new THREE.PlaneGeometry(
                    stickerSide * TETRA_LOGO_SIZE,
                    stickerSide * TETRA_LOGO_SIZE
                );
                const logo = new THREE.Mesh(logoGeometry, logoMaterial());
                const logoUp = stickerUp.clone().negate();
                const logoRight = new THREE.Vector3().crossVectors(logoUp, stickerNormal);

                engine.buildGeometries.push(logoGeometry);
                logo.quaternion.setFromRotationMatrix(
                    new THREE.Matrix4().makeBasis(logoRight, logoUp, stickerNormal)
                );
                logo.position
                    .copy(stickerPos)
                    .addScaledVector(stickerNormal, 0.004)
                    .addScaledVector(logoUp, stickerSide * 0.04);
                engine.cubeGroup.add(logo);
            };

            // One flat sticker per facelet, lifted just off the dark body.
            getPyraminxFaces(applyPyraminxMoves(moves)).forEach((s) => {
                const mesh = new THREE.Mesh(engine.geometry, materialFor(s.color));

                normal.set(...s.normal);
                up.set(...s.up);
                right.crossVectors(up, normal).normalize();
                matrix.makeBasis(right, up, normal);
                mesh.quaternion.setFromRotationMatrix(matrix);
                mesh.position
                    .set(...s.pos)
                    .multiplyScalar(TETRA_SCALE)
                    .addScaledVector(normal, TETRA_STICKER_LIFT);
                engine.cubeGroup.add(mesh);

                if (s.piece === TETRA_LOGO_PIECE && s.face === TETRA_LOGO_FACE) {
                    addTetraLogo(mesh.position, normal, up);
                }
            });

            return;
        }

        const scale = CUBE_SCALE / size;
        const cubieSize = CUBIE_FILL * scale;

        engine.geometry = new RoundedBoxGeometry(cubieSize, cubieSize, cubieSize, 4, CUBIE_RADIUS_FRACTION * scale);

        const state = applyMoves(size, moves);

        // ── Logo brand sticker ──────────────────────────────────────────────
        // The logo rides a white sticker so it always sits on a genuinely
        // white face. On even sizes without a true center piece (2x2) it
        // rides the unique white-red-green corner cubie. On odd sizes the
        // exact center cubie (0, half, 0) is a fixed white center. On other
        // even sizes (4x4/6x6) it rides the center-block sticker nearest the
        // default badge spot (inner top-front-right). The sticker's own
        // frame orients the decal.
        const WHITE = '#ffffff';
        const RED = '#c41e3a';
        const GREEN = '#009e60';
        const half = (size - 1) / 2;

        const findStickerAt = (x, y, z) =>
            state.find(
                (st) =>
                    st.color === WHITE &&
                    Math.abs(st.pos[0] - x) < 1e-6 &&
                    Math.abs(st.pos[1] - y) < 1e-6 &&
                    Math.abs(st.pos[2] - z) < 1e-6
            );

        let logoSticker = null;

        if (size === 2) {
            const dirs = [
                [1, 0, 0],
                [-1, 0, 0],
                [0, 1, 0],
                [0, -1, 0],
                [0, 0, 1],
                [0, 0, -1],
            ];

            getCubieColors(size, state).forEach((faces, position) => {
                const colors = new Set(faces);

                if (!(colors.has(WHITE) && colors.has(RED) && colors.has(GREEN))) {
                    return;
                }

                const [x, y, z] = position.split(',').map(Number);
                const idx = faces.indexOf(WHITE);

                logoSticker = findStickerAt(x + dirs[idx][0] / 2, y + dirs[idx][1] / 2, z + dirs[idx][2] / 2);
            });
        } else if (size % 2 === 1) {
            logoSticker = findStickerAt(0, half + 1 / 2, 0);
        } else {
            let bestDist = Infinity;

            state.forEach((s) => {
                if (s.color !== WHITE) {
                    return;
                }

                const d =
                    (s.pos[0] - 0.5) ** 2 + (s.pos[1] - half) ** 2 + (s.pos[2] - 0.5) ** 2;

                if (d < bestDist) {
                    bestDist = d;
                    logoSticker = s;
                }
            });
        }

        const decalMaterial = logoMaterial();
        // ───────────────────────────────────────────────────────────────────

        getCubieColors(size, state).forEach((faces, position) => {
            const [x, y, z] = position.split(',').map(Number);

            const mesh = new THREE.Mesh(engine.geometry, faces.map((col) => materialFor(col)));

            mesh.position.set(x * scale, y * scale, z * scale);
            engine.cubeGroup.add(mesh);

            if (auto) {
                engine.cubies.set(`${x},${y},${z}`, mesh);
                mesh.userData.cell = [x, y, z];
            }
        });

        if (logoSticker) {
            const normal = new THREE.Vector3(...logoSticker.normal);
            const up = new THREE.Vector3(...logoSticker.up);
            const right = new THREE.Vector3();
            const matrix = new THREE.Matrix4();
            const quaternion = new THREE.Quaternion();

            const logoGeometry = new THREE.PlaneGeometry(cubieSize, cubieSize);
            const logoDecal = new THREE.Mesh(logoGeometry, decalMaterial);

            engine.buildGeometries.push(logoGeometry);

            right.crossVectors(up, normal).normalize();
            matrix.makeBasis(right, up, normal);
            quaternion.setFromRotationMatrix(matrix);
            logoDecal.quaternion.copy(quaternion);

            if (auto) {
                const parentInt = logoSticker.pos.map(
                    (p, i) => Math.round(p - logoSticker.normal[i] / 2)
                );
                const parentMesh = engine.cubies.get(parentInt.join(','));

                if (parentMesh) {
                    logoDecal.position.set(
                        (logoSticker.pos[0] - parentInt[0]) * scale + normal.x * 0.003,
                        (logoSticker.pos[1] - parentInt[1]) * scale + normal.y * 0.003,
                        (logoSticker.pos[2] - parentInt[2]) * scale + normal.z * 0.003
                    );
                    parentMesh.add(logoDecal);
                    return;
                }
            }

            logoDecal.position.set(
                logoSticker.pos[0] * scale + normal.x * 0.003,
                logoSticker.pos[1] * scale + normal.y * 0.003,
                logoSticker.pos[2] * scale + normal.z * 0.003
            );
            engine.cubeGroup.add(logoDecal);
        }
    }, [kind, size, moves, auto]);

    useEffect(() => {
        const engine = engineRef.current;

        if (!auto || !engine?.cubies) {
            return;
        }

        const AXIS_VEC = {
            U: [0, 1, 0],
            D: [0, -1, 0],
            L: [-1, 0, 0],
            R: [1, 0, 0],
            F: [0, 0, 1],
            B: [0, 0, -1],
        };

        const TURN_MS = 320;
        const PAUSE_MS = 200;
        const HOLD_MS = 1400;
        const REST_MS = 1000;
        const START_MS = 1000;
        const SPIN_MS = 35000;

        const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

        let frame;
        let state = 'start';
        let stateUntil = performance.now() + START_MS;
        let queue = [];
        let phaseIndex = 0;
        let turn = null;
        let lastNow = performance.now();
        let spinPausedUntil = 0;

        const layerCubies = (move) => {
            const [ax, ay, az] = AXIS_VEC[move.axis];
            const out = [];

            engine.cubies.forEach((mesh) => {
                const [x, y, z] = mesh.userData.cell;
                const d = x * ax + y * ay + z * az;

                if (move.layers.some((l) => Math.abs(d - l) < 1e-9)) {
                    out.push(mesh);
                }
            });

            return out;
        };

        const startTurn = () => {
            const move = queue[phaseIndex];
            const pivot = new THREE.Object3D();

            turn = {
                pivot,
                cubies: layerCubies(move),
                axis: new THREE.Vector3(...AXIS_VEC[move.axis]),
                target: (-move.turns * Math.PI) / 2,
                start: performance.now(),
            };

            engine.cubeGroup.add(pivot);
            engine.cubeGroup.updateMatrixWorld(true);
            turn.cubies.forEach((m) => pivot.attach(m));
            pivot.updateMatrixWorld(true);
        };

        const finishTurn = () => {
            const scale = CUBE_SCALE / size;

            engine.cubeGroup.updateMatrixWorld(true);
            turn.cubies.forEach((m) => {
                engine.cubeGroup.attach(m);
                m.userData.cell = [
                    Math.round(m.position.x / scale),
                    Math.round(m.position.y / scale),
                    Math.round(m.position.z / scale),
                ];
            });
            engine.cubeGroup.remove(turn.pivot);
            turn = null;
            phaseIndex += 1;

            if (phaseIndex >= queue.length) {
                if (state === 'scramble') {
                    state = 'hold';
                    stateUntil = performance.now() + HOLD_MS;
                } else {
                    state = 'start';
                    stateUntil = performance.now() + REST_MS;
                }
            } else {
                state = 'pause';
                stateUntil = performance.now() + PAUSE_MS;
            }
        };

        const tick = (now) => {
            frame = requestAnimationFrame(tick);

            if (!document.hidden) {
                const dt = Math.min(now - lastNow, 64);

                if (now > spinPausedUntil) {
                    engine.cubeGroup.rotation.y += ((Math.PI * 2) / SPIN_MS) * dt;
                }

                if (state === 'turning') {
                    const p = Math.min((now - turn.start) / TURN_MS, 1);

                    turn.pivot.setRotationFromAxisAngle(turn.axis, turn.target * easeInOut(p));

                    if (p >= 1) {
                        finishTurn();
                    }
                } else if (now >= stateUntil) {
                    if (state === 'start') {
                        queue = generateScramble('3');
                        phaseIndex = 0;
                        state = 'pause';
                        stateUntil = now + PAUSE_MS;
                    } else if (state === 'pause') {
                        state = 'turning';
                        startTurn();
                    } else if (state === 'hold') {
                        queue = queue
                            .slice()
                            .reverse()
                            .map((m) => ({ ...m, turns: 4 - m.turns }));
                        phaseIndex = 0;
                        state = 'pause';
                        stateUntil = now + PAUSE_MS;
                    }
                }
            }

            lastNow = now;
        };

        const onStart = () => {
            spinPausedUntil = performance.now() + 2000;
        };

        engine.controls.addEventListener('start', onStart);
        frame = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(frame);
            engine.controls.removeEventListener('start', onStart);
        };
        // Restart on every rebuild so the animation never drives stale cubies.
    }, [auto, kind, size, moves]);

    return null;
}
