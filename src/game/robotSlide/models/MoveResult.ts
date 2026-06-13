/*
 * MoveResult:
 * - 繧ｿ繧､繝ｫ繧ｹ繝ｩ繧､繝峨・邨先棡繧定｡ｨ縺吝梛螳夂ｾｩ縲・ * - movedTiles 縺ｯ UI 縺悟句挨繧ｿ繧､繝ｫ縺ｮ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ繧定｡後≧縺溘ａ縺ｮ from/to 諠・ｱ繧貞性繧驟榊・縲・ */
import type { Position } from './Position.ts'

export interface TileSlideMove {
    tileId: number
    from: Position
    to: Position
    carriedRobot: boolean
}

export interface MoveResult {
    moved: boolean
    tileId: number
    from: Position | null
    to: Position | null
    carriedRobot: boolean
    movedTiles: TileSlideMove[]
}
