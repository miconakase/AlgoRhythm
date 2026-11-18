// Ordered so that, seen from outside the F face (U, L, R), U → L → R runs
// counter-clockwise like a real puzzle: L on the left, R on the right.
const VERTICES = [
    [1, 1, 1], // U tip
    [-1, 1, -1], // R tip
    [1, -1, -1], // L tip
    [-1, -1, 1], // B tip
];

export const TETRA_VERTICES = VERTICES;

const TIPS = { U: 0, R: 1, L: 2, B: 3 };

// WCA colour scheme.
const FACE_COLORS = {
    0: '#ffd500', // D face (opposite U tip) - yellow
    1: '#c41e3a', // L face (opposite R tip) - red
    2: '#0051ba', // R face (opposite L tip) - blue
    3: '#009e60', // F face (opposite B tip) - green
};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a) => {
    const m = Math.hypot(a[0], a[1], a[2]);

    return mul(a, 1 / m);
};

const rotateVec = (p, axis, turns) => {
    const [a, b, c] = axis;
    const px = a * p[0];
    const py = b * p[1];
    const pz = c * p[2];
    const q = turns === 1 ? [py, pz, px] : [pz, px, py];

    return [a * q[0], b * q[1], c * q[2]];
};

const other = (i) => [0, 1, 2, 3].filter((j) => j !== i);

const baryPos = (b, verts) => [
    b[0] * verts[0][0] + b[1] * verts[1][0] + b[2] * verts[2][0],
    b[0] * verts[0][1] + b[1] * verts[1][1] + b[2] * verts[2][1],
    b[0] * verts[0][2] + b[1] * verts[1][2] + b[2] * verts[2][2],
];

const FACE_SLOTS = (i) => {
    const [a, b, c] = other(i);

    return [
        { bary: [7 / 9, 1 / 9, 1 / 9], piece: `t${a}` },
        { bary: [1 / 9, 7 / 9, 1 / 9], piece: `t${b}` },
        { bary: [1 / 9, 1 / 9, 7 / 9], piece: `t${c}` },
        { bary: [4 / 9, 4 / 9, 1 / 9], piece: `e${Math.min(a, b)}-${Math.max(a, b)}` },
        { bary: [1 / 9, 4 / 9, 4 / 9], piece: `e${Math.min(b, c)}-${Math.max(b, c)}` },
        { bary: [4 / 9, 1 / 9, 4 / 9], piece: `e${Math.min(a, c)}-${Math.max(a, c)}` },
        // Each centre sticker belongs to the axial piece of the corner it
        // sits next to; that piece shows one sticker on each of its 3 faces.
        { bary: [5 / 9, 2 / 9, 2 / 9], piece: `c${a}` },
        { bary: [2 / 9, 5 / 9, 2 / 9], piece: `c${b}` },
        { bary: [2 / 9, 2 / 9, 5 / 9], piece: `c${c}` },
    ];
};

const faceCentroid = (i) => {
    const [a, b, c] = other(i);

    return mul(add(add(VERTICES[a], VERTICES[b]), VERTICES[c]), 1 / 3);
};

const rotationMatrix = (axis, turns) => {
    const c0 = rotateVec([1, 0, 0], axis, turns);
    const c1 = rotateVec([0, 1, 0], axis, turns);
    const c2 = rotateVec([0, 0, 1], axis, turns);

    return [
        [c0[0], c1[0], c2[0]],
        [c0[1], c1[1], c2[1]],
        [c0[2], c1[2], c2[2]],
    ];
};

const matVec = (m, v) => [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

const matMul = (a, b) => {
    const c = [];

    for (let i = 0; i < 3; i++) {
        c.push([
            a[i][0] * b[0][0] + a[i][1] * b[1][0] + a[i][2] * b[2][0],
            a[i][0] * b[0][1] + a[i][1] * b[1][1] + a[i][2] * b[2][1],
            a[i][0] * b[0][2] + a[i][1] * b[1][2] + a[i][2] * b[2][2],
        ]);
    }

    return c;
};

const IDENTITY = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
];

export const createPyraminxState = () => {
    const byPiece = new Map();

    for (let i = 0; i < 4; i++) {
        const verts = other(i).map((j) => VERTICES[j]);
        const centroid = faceCentroid(i);
        const normal = normalize(mul(VERTICES[i], -1));
        // Real Pyraminx faces tile as ▲ / ▲▼▲ / ▲▼▲▼▲ with the tip rows at
        // the faces' apex corner: tips and edges all point toward that apex,
        // centers point the opposite way. This beats the old radial rule that
        // aimed each sticker at its own corner/ridge.
        const apexTangent = normalize(sub(verts[0], centroid));

        for (const { bary, piece } of FACE_SLOTS(i)) {
            const pos = baryPos(bary, verts);
            const up = mul(apexTangent, piece.startsWith('c') ? -1 : 1);

            if (!byPiece.has(piece)) {
                byPiece.set(piece, []);
            }

            byPiece.get(piece).push({ pos, normal, up, color: FACE_COLORS[i], face: i });
        }
    }

    return [...byPiece].map(([piece, stickers]) => {
        const type = piece[0];
        let origin;

        if (type === 't') {
            origin = VERTICES[Number(piece.slice(1))];
        } else if (type === 'e') {
            const [a, b] = piece.slice(1).split('-').map(Number);

            origin = mul(add(VERTICES[a], VERTICES[b]), 0.5);
        } else {
            origin = mul(VERTICES[Number(piece.slice(1))], 1 / 3);
        }

        return {
            piece,
            origin,
            rot: IDENTITY,
            stickers: stickers.map((s) => ({
                pos: sub(s.pos, origin),
                normal: s.normal,
                up: s.up,
                color: s.color,
                face: s.face,
            })),
        };
    });
};

const inMovingLayer = (origin, tipIdx, layers) => {
    const v = VERTICES[tipIdx];

    if (layers === 'tip') {
        return Math.abs(dot(origin, v) - dot(v, v)) < 1e-9;
    }

    return dot(origin, v) > 0;
};

export const applyPyraminxMove = (state, move) => {
    const tipIdx = TIPS[move.axis];
    const axis = VERTICES[tipIdx];
    const R = rotationMatrix(axis, move.turns);

    return state.map((p) =>
        inMovingLayer(p.origin, tipIdx, move.layers)
            ? { ...p, origin: matVec(R, p.origin), rot: matMul(R, p.rot) }
            : p
    );
};

export const applyPyraminxMoves = (moves) =>
    moves.reduce((s, m) => applyPyraminxMove(s, m), createPyraminxState());

export const getPyraminxFaces = (state) =>
    state.flatMap((p) =>
        p.stickers.map((s) => ({
            pos: add(matVec(p.rot, s.pos), p.origin),
            normal: matVec(p.rot, s.normal),
            up: matVec(p.rot, s.up),
            color: s.color,
            // Identity of the sticker in the solved puzzle: its piece and the
            // face (index of the opposite tip) it started on.
            piece: p.piece,
            face: s.face,
        }))
    );
