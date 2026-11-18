const SUFFIXES = ['', '2', "'"];
const TURNS = [1, 2, 3];
const OPPOSITE = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };

const SCRAMBLE_LENGTHS = { 2: 9, 3: 20, 4: 40 };

const LAYERS = {
    2: { outer: [1, 0.5] },
    3: { outer: [1.5, 1] },
    4: { outer: [2, 1.5], wide: [2, 1.5, 1, 0.5] },
};

// WCA-style 4x4 scrambles only widen U, R and F; Dw/Lw/Bw are the same
// piece permutation as Uw/Rw/Fw plus a whole-cube rotation.
const WIDE_AXES = ['U', 'R', 'F'];

const moveDefs = (size) => {
    const defs = [];

    for (const axis of ['U', 'D', 'L', 'R', 'F', 'B']) {
        defs.push({ name: axis, axis, layers: LAYERS[size].outer });

        if (size === 4 && WIDE_AXES.includes(axis)) {
            defs.push({ name: `${axis}w`, axis, layers: LAYERS[size].wide });
        }
    }

    return defs;
};

const PYRAMINX_AXES = ['U', 'L', 'R', 'B'];
const PYRAMINX_LENGTH = 11;

// WCA-style: layer turns first (never the same axis twice in a row), then
// each tip turned clockwise, counter-clockwise or left alone.
export const generatePyraminxScramble = () => {
    const moves = [];
    const pyraminxMove = (axis, layers, turns) => ({
        name: (layers === 'tip' ? axis.toLowerCase() : axis) + (turns === 2 ? "'" : ''),
        axis,
        layers,
        turns,
    });

    while (moves.length < PYRAMINX_LENGTH) {
        const options = PYRAMINX_AXES.filter((a) => a !== moves[moves.length - 1]?.axis);
        const axis = options[Math.floor(Math.random() * options.length)];

        moves.push(pyraminxMove(axis, 'layer', 1 + Math.floor(Math.random() * 2)));
    }

    for (const axis of PYRAMINX_AXES) {
        const turns = Math.floor(Math.random() * 3);

        if (turns > 0) {
            moves.push(pyraminxMove(axis, 'tip', turns));
        }
    }

    return moves;
};

export const generateScramble = (puzzle) => {
    const size = parseInt(puzzle, 10);

    if (Number.isNaN(size)) {
        return generatePyraminxScramble();
    }

    const defs = moveDefs(size);
    const length = SCRAMBLE_LENGTHS[size] ?? 20;
    const moves = [];

    for (let i = 0; i < length; i++) {
        let def;

        do {
            def = defs[Math.floor(Math.random() * defs.length)];
        } while (
            (i > 0 && def.axis === moves[i - 1].axis) ||
            (i > 1 && moves[i - 2].axis === def.axis && moves[i - 1].axis === OPPOSITE[def.axis])
        );

        const turns = TURNS[Math.floor(Math.random() * TURNS.length)];
        const suffix = SUFFIXES[turns - 1];

        moves.push({ name: def.name + suffix, axis: def.axis, layers: def.layers, turns });
    }

    return moves;
};
