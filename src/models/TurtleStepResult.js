import type { Direction } from './Direction.js'
import type { Position } from './Position.js'

/**
 * 亀の前進結果だけを UI へ伝えるための型で、アニメーションに必要な差分を Scene が再計算しないために必要である。
 */
export interface TurtleStepResult {
    moved: boolean
    from: Position
    to: Position | null
    direction: Direction
    alive: boolean
    collectedJewel: boolean
    triggeredCurrent: boolean
    loopDetected: boolean
    blockedPosition: Position | null
}
