import type { Direction8 } from './types';

const INV_SQRT2 = Math.SQRT1_2;

export const DIRECTION_VECTORS: Record<Direction8, { x: number; y: number }> = {
  S: { x: 0, y: 1 },
  SE: { x: INV_SQRT2, y: INV_SQRT2 },
  E: { x: 1, y: 0 },
  NE: { x: INV_SQRT2, y: -INV_SQRT2 },
  N: { x: 0, y: -1 },
  NW: { x: -INV_SQRT2, y: -INV_SQRT2 },
  W: { x: -1, y: 0 },
  SW: { x: -INV_SQRT2, y: INV_SQRT2 }
};

export function vectorToDirection8(dx: number, dy: number, fallback: Direction8 = 'S'): Direction8 {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return fallback;
  }
  const angle = Math.atan2(dy, dx);
  const octant = Math.round((8 * angle) / (2 * Math.PI) + 8) % 8;
  const table: Direction8[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  return table[octant];
}

export function normalizeVector(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len < 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: dx / len, y: dy / len };
}

/**
 * Maps 8-way direction onto the 5-row sprite sheet layout:
 * Row 0: S, Row 1: SE/SW, Row 2: E/W, Row 3: NE/NW, Row 4: N
 */
export function directionToSheetRow(dir: Direction8): { row: number; flipX: boolean } {
  switch (dir) {
    case 'S':
      return { row: 0, flipX: false };
    case 'SE':
      return { row: 1, flipX: false };
    case 'SW':
      return { row: 1, flipX: true };
    case 'E':
      return { row: 2, flipX: false };
    case 'W':
      return { row: 2, flipX: true };
    case 'NE':
      return { row: 3, flipX: false };
    case 'NW':
      return { row: 3, flipX: true };
    case 'N':
      return { row: 4, flipX: false };
  }
}