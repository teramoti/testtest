import type { Position } from './Position.js'

export interface TileSlideMove {
    tileId: number
    from: Position
    to: Position
    carriedTurtle: boolean
}

export interface MoveResult {
    moved: boolean
    tileId: number
    from: Position | null
    to: Position | null
    carriedTurtle: boolean
    movedTiles: TileSlideMove[]
}
