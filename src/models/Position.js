/**
 * 盤面座標を共通化する理由は、Manager と UI の受け渡し形式を固定して責務境界を明確にするためである。
 */
export interface Position {
    row: number
    col: number
}
