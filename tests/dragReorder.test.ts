import { describe, it, expect } from 'vitest';
import { moveArrayItem, computeTargetIndex } from '../src/utils/dragReorder';

describe('moveArrayItem', () => {
  it('moves an item downward without mutating the original array', () => {
    const original = ['A', 'B', 'C', 'D'];
    const result = moveArrayItem(original, 0, 2);
    expect(result).toEqual(['B', 'C', 'A', 'D']);
    expect(original).toEqual(['A', 'B', 'C', 'D']);
  });

  it('moves an item upward without mutating the original array', () => {
    const original = ['A', 'B', 'C', 'D'];
    const result = moveArrayItem(original, 3, 1);
    expect(result).toEqual(['A', 'D', 'B', 'C']);
    expect(original).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns the same reference when fromIndex equals toIndex', () => {
    const original = ['A', 'B', 'C'];
    expect(moveArrayItem(original, 1, 1)).toBe(original);
  });

  it('returns the same reference for out-of-bounds indices', () => {
    const original = ['A', 'B', 'C'];
    expect(moveArrayItem(original, -1, 1)).toBe(original);
    expect(moveArrayItem(original, 0, 5)).toBe(original);
    expect(moveArrayItem(original, 3, 0)).toBe(original);
    expect(moveArrayItem(original, 1, -2)).toBe(original);
  });
});

describe('computeTargetIndex', () => {
  it('stays at fromIndex when drag offset does not cross half a neighbor height', () => {
    const heights = [100, 100, 100];
    expect(computeTargetIndex(0, 40, heights, 0)).toBe(0);
    expect(computeTargetIndex(2, -49, heights, 0)).toBe(2);
  });

  it('swaps downward across one or multiple uniform-height rows', () => {
    const heights = [100, 100, 100, 100];
    // With gap=10, each slot is 110 -> half is 55
    expect(computeTargetIndex(0, 54, heights, 10)).toBe(0);
    expect(computeTargetIndex(0, 55, heights, 10)).toBe(1);
    expect(computeTargetIndex(0, 165, heights, 10)).toBe(2);
    expect(computeTargetIndex(0, 500, heights, 10)).toBe(3);
  });

  it('swaps upward across one or multiple rows', () => {
    const heights = [100, 100, 100, 100];
    expect(computeTargetIndex(3, -55, heights, 10)).toBe(2);
    expect(computeTargetIndex(3, -165, heights, 10)).toBe(1);
    expect(computeTargetIndex(3, -500, heights, 10)).toBe(0);
  });

  it('handles variable-height rows accurately', () => {
    // Row 0: 60px, Row 1: 200px, Row 2: 80px (no gap)
    const heights = [60, 200, 80];
    // Dragging row 0 down: needs >= 100px to cross row 1 (half of 200)
    expect(computeTargetIndex(0, 90, heights, 0)).toBe(0);
    expect(computeTargetIndex(0, 100, heights, 0)).toBe(1);
    // Crossing row 2 needs >= 200 + 40 = 240
    expect(computeTargetIndex(0, 239, heights, 0)).toBe(1);
    expect(computeTargetIndex(0, 240, heights, 0)).toBe(2);
  });

  it('uses fallbackHeight when measured heights are zero', () => {
    const heights = [0, 0, 0];
    // fallbackHeight = 80, gap = 0 -> threshold is 40
    expect(computeTargetIndex(0, 39, heights, 0, 80)).toBe(0);
    expect(computeTargetIndex(0, 40, heights, 0, 80)).toBe(1);
  });

  it('handles single-item or invalid indices safely', () => {
    expect(computeTargetIndex(0, 200, [100])).toBe(0);
    expect(computeTargetIndex(-1, 200, [100, 100])).toBe(-1);
    expect(computeTargetIndex(5, 200, [100, 100])).toBe(5);
  });
});
