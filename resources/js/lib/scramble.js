const SUFFIXES = ['', '2', "'"];
const TURNS = [1, 2, 3];
const OPPOSITE = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };

const SCRAMBLE_LENGTHS = { 2: 9, 3: 20, 4: 40 };

const LAYERS = {
    2: { outer: [1, 0.5] },
    3: { outer: [1.5, 1] },
    4: { outer: [2, 1.5], wide: [2, 1.5, 1, 0.5], inner: [0.5, -0.5] },
};

const moveDefs = (size) => {
    const defs = [];

    for (const axis of ['U', 'D', 'L', 'R', 'F', 'B']) {
        defs.push({ name: axis, axis, layers: LAYERS[size].outer });

        if (size === 4) {
            defs.push({ name: `${axis}w`, axis, layers: LAYERS[size].wide });
            defs.push({ name: axis.toLowerCase(), axis, layers: LAYERS[size].inner });
        }
    }

    return defs;
};

const PYRAMINX_AXES = ['U', 'R', 'L', 'B'];
const PYRAMINX_TIPS = ['u', 'r', 'l', 'b'];

export const generatePyraminxScramble = () => {
    const length = 10 + Math.floor(Math.random() * 3);
    const tipCount = Math.floor(Math.random() * 5);
    const tipPositions = new Set();

    while (tipPositions.size < tipCount) {
        tipPositions.add(Math.floor(Math.random() * length));
    }

    const moves = [];
    const pick = (options, i) => {
        const available = options.filter((a) => a.toUpperCase() !== moves[i - 1]?.axis.toUpperCase());

        return available[Math.floor(Math.random() * available.length)];
    };

    for (let i = 0; i < length; i++) {
        const axis = pick(tipPositions.has(i) ? PYRAMINX_TIPS : PYRAMINX_AXES, i);
        const isTip = axis === axis.toLowerCase();
        const turns = 1 + Math.floor(Math.random() * 2);

        moves.push({
            name: axis + (turns === 2 ? "'" : ''),
            axis: axis.toUpperCase(),
            layers: isTip ? 'tip' : 'layer',
            turns,
        });
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
