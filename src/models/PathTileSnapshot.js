/**
 * タイル形状を固定する理由は、通路判定と描画表現を同じ単位で共有するためである。
 */
export type PathTileKind = 'straight' | 'corner' | 'cross' | 'tee' | 'branch'

/**
 * 追加効果を形状から切り離す理由は、将来の特殊床やワープを同じ構造へ載せるためである。
 */
export type TileFeature = 'none' | 'current'

/**
 * タイル特性を列挙型で持つ理由は、固定床や崩壊床のような将来要素を追加しやすくするためである。
 */
export type TileTrait = 'fixed' | 'rotating' | 'fragile' | 'warp'

/**
 * 分岐タイルの優先向きを別定義にする理由は、同じ接続数でも挙動差を持たせるためである。
 */
export type BranchBias = 'left' | 'right'

/**
 * タイル定義を位置情報から分離する理由は、UI が同じ描画オブジェクトを再利用しやすくするためである。
 */
export interface PathTileSnapshot {
    id: number
    kind: PathTileKind
    rotation: number
    feature: TileFeature
    branchBias: BranchBias
    traits: TileTrait[]
}
