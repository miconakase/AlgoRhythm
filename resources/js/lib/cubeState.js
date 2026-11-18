const FACES = {
    U: { axis: [0, 1, 0], right: [1, 0, 0], up: [0, 0, 1], color: '#ffffff' },
    D: { axis: [0, -1, 0], right: [1, 0, 0], up: [0, 0, -1], color: '#ffd500' },
    R: { axis: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0], color: '#c41e3a' },
    L: { axis: [-1, 0, 0], right: [0, 0, 1], up: [0, 1, 0], color: '#ff5800' },
    F: { axis: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0], color: '#009e60' },
    B: { axis: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0], color: '#0051ba' },
};

const BODY_COLOR = '#3d3d47';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const rotate = (v, axis, k) => {
    const kk = ((k % 4) + 4) % 4;

    if (kk === 0) {
        return v;
    }

    if (kk === 2) {
        const d = 2 * dot(v, axis);

        return [d * axis[0] - v[0], d * axis[1] - v[1], d * axis[2] - v[2]];
    }

    const s = kk === 1 ? 1 : -1;
    const cross = [
        s * (axis[1] * v[2] - axis[2] * v[1]),
        s * (axis[2] * v[0] - axis[0] * v[2]),
        s * (axis[0] * v[1] - axis[1] * v[0]),
    ];
    const d = dot(v, axis);

    return [cross[0] + d * axis[0], cross[1] + d * axis[1], cross[2] + d * axis[2]];
};

const posKey = (p) => p.map((v) => Math.round(v * 10) / 10).join(',');

export const createSolvedState = (size) => {
    const stickers = [];

    for (const name of Object.keys(FACES)) {
        const { axis, right, up, color } = FACES[name];

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const pos = add(
                    add(scale(axis, size / 2), scale(right, i - (size - 1) / 2)),
                    scale(up, j - (size - 1) / 2)
                );

                stickers.push({ pos, normal: axis, right, up, color });
            }
        }
    }

    return stickers;
};

export const applyMove = (state, move) => {
    const axis = FACES[move.axis].axis;
    const k = ((4 - move.turns) % 4 + 4) % 4;

    return state.map((s) => {
        if (!move.layers.some((l) => Math.abs(dot(s.pos, axis) - l) < 1e-9)) {
            return s;
        }

        return {
            pos: rotate(s.pos, axis, k),
            normal: rotate(s.normal, axis, k),
            right: rotate(s.right, axis, k),
            up: rotate(s.up, axis, k),
            color: s.color,
        };
    });
};

export const applyMoves = (size, moves) => moves.reduce((s, m) => applyMove(s, m), createSolvedState(size));

export const getCubieColors = (size, state) => {
    const byPos = new Map(state.map((s) => [posKey(s.pos), s.color]));
    const colors = new Map();
    const half = (size - 1) / 2;
    const dirs = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
    ];

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
                const c = [x - half, y - half, z - half];
                const faces = dirs.map((d) => byPos.get(posKey([c[0] + d[0] / 2, c[1] + d[1] / 2, c[2] + d[2] / 2])) ?? BODY_COLOR);

                colors.set(`${c[0]},${c[1]},${c[2]}`, faces);
            }
        }
    }

    return colors;
};
