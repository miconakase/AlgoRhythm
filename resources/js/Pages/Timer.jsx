import { Head } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import TopNav from '../Components/TopNav';
import Cube3D from '../Components/Cube3D';
import { generateScramble } from '../lib/scramble';

const HOLD_MS = 300;

const PUZZLES = [
    { label: '2x2x2', n: 2 },
    { label: '3x3x3', n: 3 },
    { label: '4x4x4', n: 4 },
    // { label: 'Pyraminx' },
];

const formatTime = (centiseconds) => {
    const minutes = Math.floor(centiseconds / 6000);
    const seconds = Math.floor((centiseconds % 6000) / 100);
    const cs = centiseconds % 100;

    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};

const COS30 = Math.sqrt(3) / 2;
const SIN30 = 0.5;

const TETRA_PROJ = {
    U: [0, 0],
    R: [Math.sqrt(3), 1],
    L: [-Math.sqrt(3), 1],
    B: [0, -2],
};

const PyramidIcon = () => {
    const S = 5.2;
    const P = (name) => {
        const [x, y] = TETRA_PROJ[name];
        const cy = TETRA_PROJ.U[1] + TETRA_PROJ.B[1] + TETRA_PROJ.R[1] + TETRA_PROJ.L[1];

        return [12 + x * S, 12 + (y - cy / 4) * S];
    };

    const faces = [
        ['U', 'R', 'B'],
        ['U', 'B', 'L'],
        ['U', 'L', 'R'],
    ];

    const subdivide = (a, b, c) => {
        const lines = [];
        const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

        for (const [from, to] of [
            [a, b],
            [b, c],
            [c, a],
        ]) {
            lines.push([lerp(from, to, 1 / 3), lerp(from, to, 2 / 3)]);
        }

        return lines;
    };

    return (
        <svg viewBox="0 0 24 24" className="h-7 w-7">
            {faces.map(([a, b, c], i) => (
                <g key={i}>
                    <polygon
                        points={[P(a), P(b), P(c)].map((p) => p.join(',')).join(' ')}
                        fill="currentColor"
                        fillOpacity={i === 0 ? 0.05 : 0.08}
                        stroke="currentColor"
                        strokeOpacity={0.5}
                        strokeWidth={0.5}
                    />
                    {subdivide(P(a), P(b), P(c)).map((line, j) => (
                        <line
                            key={j}
                            x1={line[0][0]}
                            y1={line[0][1]}
                            x2={line[1][0]}
                            y2={line[1][1]}
                            stroke="currentColor"
                            strokeOpacity={0.5}
                            strokeWidth={0.4}
                        />
                    ))}
                </g>
            ))}
        </svg>
    );
};

const PuzzleIcon = ({ n }) => {
    if (n === undefined) {
        return <PyramidIcon />;
    }

    const S = 10;
    const P = (x, y, z) => [12 + (x - y) * COS30 * S, 12 + (x + y) * SIN30 * S - z * S];
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const poly = (pts) => pts.map((p) => p.join(',')).join(' ');

    const top = [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)];
    const left = [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)];
    const right = [P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)];

    const grid = (face) => {
        const lines = [];

        for (let i = 1; i < n; i++) {
            const t = i / n;

            lines.push([lerp(face[0], face[1], t), lerp(face[3], face[2], t)]);
            lines.push([lerp(face[0], face[3], t), lerp(face[1], face[2], t)]);
        }

        return lines;
    };

    return (
        <svg viewBox="0 0 24 24" className="h-7 w-7">
            {[top, left, right].map((face, i) => (
                <polygon
                    key={i}
                    points={poly(face)}
                    fill="currentColor"
                    fillOpacity={i === 0 ? 0.05 : 0.08}
                    stroke="currentColor"
                    strokeOpacity={0.5}
                    strokeWidth={0.5}
                />
            ))}
            {[top, left, right]
                .flatMap((face) => grid(face))
                .map((line, i) => (
                    <line
                        key={i}
                        x1={line[0][0]}
                        y1={line[0][1]}
                        x2={line[1][0]}
                        y2={line[1][1]}
                        stroke="currentColor"
                        strokeOpacity={0.5}
                        strokeWidth={0.4}
                    />
                ))}
        </svg>
    );
};

export default function Timer() {
    const [elapsed, setElapsed] = useState(0);
    const [puzzle, setPuzzle] = useState('3x3x3');
    const [moves, setMoves] = useState(() => generateScramble('3x3x3'));
    const [running, setRunning] = useState(false);
    const [holding, setHolding] = useState(false);
    const [armed, setArmed] = useState(false);
    const startRef = useRef(0);
    const holdTimerRef = useRef(null);
    const phaseRef = useRef('idle');
    const timerRef = useRef(null);

    const clearHoldTimer = useCallback(() => {
        if (holdTimerRef.current !== null) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }, []);

    const changePuzzle = useCallback((label) => {
        setPuzzle(label);
        setMoves(generateScramble(label));
    }, []);

    const reset = useCallback(() => {
        clearHoldTimer();
        phaseRef.current = 'idle';
        setRunning(false);
        setHolding(false);
        setArmed(false);
        setElapsed(0);
        setMoves(generateScramble(puzzle));
    }, [clearHoldTimer, puzzle]);

    const start = useCallback(() => {
        clearHoldTimer();
        phaseRef.current = 'running';
        setHolding(false);
        setArmed(false);
        setElapsed(0);
        startRef.current = performance.now();
        setRunning(true);
    }, [clearHoldTimer]);

    const stop = useCallback(() => {
        const end = performance.now();

        clearHoldTimer();
        phaseRef.current = 'stopped';
        setElapsed(Math.floor((end - startRef.current) / 10));
        setRunning(false);
        setHolding(false);
        setArmed(false);
        setMoves(generateScramble(puzzle));
    }, [clearHoldTimer, puzzle]);

    const press = useCallback(() => {
        if (phaseRef.current === 'running') {
            stop();

            return;
        }

        phaseRef.current = 'holding';
        setHolding(true);
        setArmed(false);
        holdTimerRef.current = setTimeout(() => {
            setArmed(true);
        }, HOLD_MS);
    }, [stop]);

    const release = useCallback(() => {
        if (phaseRef.current !== 'holding') {
            return;
        }

        clearHoldTimer();

        if (armed) {
            start();
        } else {
            phaseRef.current = 'stopped';
            setHolding(false);
            setArmed(false);
        }
    }, [armed, clearHoldTimer, start]);

    useEffect(() => {
        if (!running) {
            return;
        }

        let frame;

        const tick = () => {
            if (phaseRef.current !== 'running') {
                return;
            }

            const centiseconds = Math.floor((performance.now() - startRef.current) / 10);
            setElapsed(centiseconds);
            frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame);
    }, [running]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.code === 'Space') {
                event.preventDefault();

                if (!event.repeat) {
                    press();
                }
            } else if (event.code === 'KeyR') {
                reset();
            }
        };

        const onKeyUp = (event) => {
            if (event.code === 'Space') {
                release();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [press, release, reset]);

    useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

    // Pointer events cover mouse, touch and pen in one stream, so a touch no
    // longer fires a second, emulated mousedown that would stop the timer the
    // moment it starts. Capturing the pointer keeps the release on this element
    // even when it happens outside the digits.
    const onPointerDown = (event) => {
        if (event.button !== 0) {
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        press();
    };

    const onPointerCancel = () => {
        if (phaseRef.current !== 'holding') {
            return;
        }

        clearHoldTimer();
        phaseRef.current = 'stopped';
        setHolding(false);
        setArmed(false);
    };

    return (
        <>
            <Head title="Timer" />

            <TopNav />

            <div className="relative flex min-h-screen select-none flex-col overflow-hidden bg-[#0a0a0c]">
                <div className="mx-auto w-full max-w-[90vw] px-4 pt-20">
                    <div className="mb-4 flex items-center justify-center gap-2">
                        {PUZZLES.map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={() => changePuzzle(p.label)}
                                className={`flex flex-col items-center rounded-lg px-4 py-1.5 transition ${
                                    puzzle === p.label
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/40 hover:text-white/70'
                                }`}
                            >
                                <PuzzleIcon n={p.n} />
                                <span className="mt-1 font-mono text-sm">{p.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="text-center font-mono text-base leading-relaxed text-white/40 sm:text-lg lg:text-xl">
                        {moves.map((m) => m.name).join(' ')}
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div
                        ref={timerRef}
                        className={`mb-96 touch-none font-mono text-[6rem] font-light tabular-nums leading-none sm:text-[8rem] lg:text-[10rem] ${
                            running || armed ? 'text-green-500' : 'text-white'
                        }`}
                        onPointerDown={onPointerDown}
                        onPointerUp={release}
                        onPointerCancel={onPointerCancel}
                        onContextMenu={(event) => event.preventDefault()}
                    >
                        {formatTime(elapsed)}
                    </div>
                </div>
            </div>

            <Cube3D
                kind={PUZZLES.find((p) => p.label === puzzle).n === undefined ? 'pyraminx' : 'cube'}
                size={PUZZLES.find((p) => p.label === puzzle).n ?? 3}
                moves={moves}
                running={running}
                anchorRef={timerRef}
            />
        </>
    );
}
