// Random-move 3x3 scramble generator.

const FACES = ['U', 'D', 'L', 'R', 'F', 'B'];
const AXIS = { U: 0, D: 0, L: 1, R: 1, F: 2, B: 2 };
const SUFFIXES = ['', "'", '2'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generate a scramble that never repeats a face and never does
 * three moves on the same axis in a row (e.g. R L R).
 */
export function generateScramble(length = 20) {
  const moves = [];
  while (moves.length < length) {
    const face = pick(FACES);
    const prev = moves[moves.length - 1];
    const prev2 = moves[moves.length - 2];
    if (prev && prev.face === face) continue;
    if (prev && prev2 && AXIS[prev.face] === AXIS[face] && AXIS[prev2.face] === AXIS[face]) continue;
    moves.push({ face, suffix: pick(SUFFIXES) });
  }
  return moves.map((m) => m.face + m.suffix).join(' ');
}
