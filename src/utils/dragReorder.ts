/**
 * Pure helper: moves an element from `fromIndex` to `toIndex` without mutating the input array.
 */
export function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Pure helper: computes the target index given a vertical drag offset `dy` and
 * the measured heights of all rows in the list.
 * Crossing half of a neighbor's height (+ gap) swaps past that neighbor, which
 * feels responsive even for variable-height cards.
 */
export function computeTargetIndex(
  fromIndex: number,
  dy: number,
  itemHeights: number[],
  gap: number = 0,
  fallbackHeight: number = 80
): number {
  const count = itemHeights.length;
  if (count <= 1 || fromIndex < 0 || fromIndex >= count) {
    return fromIndex;
  }

  let target = fromIndex;
  if (dy > 0) {
    let accumulated = 0;
    for (let i = fromIndex + 1; i < count; i++) {
      const h = (itemHeights[i] > 0 ? itemHeights[i] : fallbackHeight) + gap;
      if (dy >= accumulated + h * 0.5) {
        target = i;
        accumulated += h;
      } else {
        break;
      }
    }
  } else if (dy < 0) {
    const absDy = -dy;
    let accumulated = 0;
    for (let i = fromIndex - 1; i >= 0; i--) {
      const h = (itemHeights[i] > 0 ? itemHeights[i] : fallbackHeight) + gap;
      if (absDy >= accumulated + h * 0.5) {
        target = i;
        accumulated += h;
      } else {
        break;
      }
    }
  }
  return target;
}
