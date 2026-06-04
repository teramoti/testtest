/**
 * 進行方向を定数化する理由は、BoardManager と UI で同じ向きを安全に共有するためである。
 */
export const Direction = {
    Up: 0,
    Right: 1,
    Down: 2,
    Left: 3,
} as const

/**
 * 方向型を共有する理由は、数値の意味を型で固定して誤用を減らすためである。
 */
export type Direction = (typeof Direction)[keyof typeof Direction]
