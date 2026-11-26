/**
 * japofc-qr - module shapes shared by the renderers
 *
 * The SVG, PNG and canvas renderers all accept the same four module shapes.
 * This module is the single source of truth for their names, for the finder
 * pattern exclusion and for the argument validation, so every renderer rejects
 * unknown shapes the same way.
 *
 * Copyright (c) 2026 @japofc
 * Released under the MIT License.
 * https://github.com/JAPofc/japqr
 *
 * @author @japofc
 */

import { InvalidArgumentError } from '../core/errors.js';

/** Shape of a single data module. Finder patterns always stay square. */
export type ModuleShape = 'square' | 'dot' | 'rounded' | 'diamond';

/** Every accepted module shape, in documentation order. */
export const MODULE_SHAPES: readonly ModuleShape[] = ['square', 'dot', 'rounded', 'diamond'];

/** Finder patterns occupy a 7x7 block in three corners. */
export const FINDER_SIZE = 7;

/** Normalises a shape argument, defaulting to `square` and rejecting unknowns. */
export function normalizeShape(value: string | undefined): ModuleShape {
  if (value === undefined) {
    return 'square';
  }
  if ((MODULE_SHAPES as readonly string[]).includes(value)) {
    return value as ModuleShape;
  }
  throw new InvalidArgumentError(
    `Unknown module shape ${JSON.stringify(value)}; use square, dot, rounded or diamond.`,
  );
}

/** True when (x, y) lies inside one of the three 7x7 finder pattern blocks. */
export function inFinder(x: number, y: number, size: number): boolean {
  return (
    (x < FINDER_SIZE && y < FINDER_SIZE) ||
    (x >= size - FINDER_SIZE && y < FINDER_SIZE) ||
    (x < FINDER_SIZE && y >= size - FINDER_SIZE)
  );
}
