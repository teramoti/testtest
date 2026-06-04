import type { Direction } from './Direction.js'
import type { TileFeature } from './PathTileSnapshot.js'
import type { Position } from './Position.js'

/**
 * 危険度を文字列で固定する理由は、UI とスコアの両方で同じ段階名を共有するためである。
 */
export type RouteRiskLevel = 'safe' | 'warning' | 'danger' | 'critical' | 'loop'

/**
 * 予測経路の 1 区間を分離する理由は、描画と評価で同じ未来情報を再利用するためである。
 */
export interface RoutePreviewSegment {
    tileId: number
    position: Position
    entryDirection: Direction
    exitDirection: Direction
    distance: number
    feature: TileFeature
}

/**
 * 未来経路の要約をひとまとめにする理由は、先読み UI と危険演出を盤面ロジックから直接得るためである。
 */
export interface RoutePreview {
    safeStepCount: number
    nextPosition: Position | null
    nextDirection: Direction | null
    nextJewelDistance: number | null
    blockedPosition: Position | null
    riskLevel: RouteRiskLevel
    loopDetected: boolean
    connectedTileIds: number[]
    dangerTileIds: number[]
    segments: RoutePreviewSegment[]
}
