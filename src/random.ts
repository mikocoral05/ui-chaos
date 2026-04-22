export interface RandomSource {
  next(): number;
}

export function createRandomSource(seed?: number): RandomSource {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return {
      next: () => Math.random()
    };
  }

  let state = normalizeSeed(seed);

  return {
    next: () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
  };
}

function normalizeSeed(seed: number): number {
  const normalized = Math.floor(seed) >>> 0;
  return normalized === 0 ? 1 : normalized;
}
