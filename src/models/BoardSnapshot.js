import type { Direction } from './Direction.js'
import type { PathTileSnapshot } from './PathTileSnapshot.js'
import type { Position } from './Position.js'
import type { RoutePreview } from './RoutePreview.js'

/**
 * 盤面の描画に必要な最小状態だけを UI へ渡すための型で、BoardManager の内部状態を外部へ漏らさないために必要である。
 */
export interface BoardSnapshot {
    boardSize: number
    tileIds: number[][]
    tileCatalog: PathTileSnapshot[]
    blankPosition: Position
    movablePositions: Position[]
    turtlePosition: Position
    turtleDirection: Direction
    turtleAlive: boolean
    jewelTileIds: number[]
    nextStepSafe: boolean
    routePreview: RoutePreview
    difficultyLabel: string
}
