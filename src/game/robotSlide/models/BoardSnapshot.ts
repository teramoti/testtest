import type { Direction } from './Direction.ts'
import type { PathTileSnapshot } from './PathTileSnapshot.ts'
import type { Position } from './Position.ts'
import type { RoutePreview } from './RoutePreview.ts'

/**
 * 逶､髱｢縺ｮ謠冗判縺ｫ蠢・ｦ√↑譛蟆冗憾諷九□縺代ｒ UI 縺ｸ貂｡縺吶◆繧√・蝙九〒縲。oardManager 縺ｮ蜀・Κ迥ｶ諷九ｒ螟夜Κ縺ｸ貍上ｉ縺輔↑縺・◆繧√↓蠢・ｦ√〒縺ゅｋ縲・ */
export interface BoardSnapshot {
    boardSize: number
    tileIds: number[][]
    tileCatalog: PathTileSnapshot[]
    blankPosition: Position
    blankPositions: Position[]
    movablePositions: Position[]
    robotPosition: Position
    robotDirection: Direction
    robotAlive: boolean
    jewelTileIds: number[]
    nextStepSafe: boolean
    routePreview: RoutePreview
    difficultyLabel: string
}
