/**
 * @cte/shared — shared library for admin / mail / tempmail packages.
 *
 * NOTE: top-level barrel exports are intentionally narrow.
 * Prefer importing from subpaths (e.g. '@cte/shared/theme') for tree-shaking.
 */
export * from './theme'
export * from './i18n'
