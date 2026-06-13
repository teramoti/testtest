import type { Direction } from './Direction.ts'
import type { Position } from './Position.ts'

/**
 * 莠縺ｮ蜑埼ｲ邨先棡縺縺代ｒ UI 縺ｸ莨昴∴繧九◆繧√・蝙九〒縲√い繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺ｫ蠢・ｦ√↑蟾ｮ蛻・ｒ Scene 縺悟・險育ｮ励＠縺ｪ縺・◆繧√↓蠢・ｦ√〒縺ゅｋ縲・ */
export interface RobotStepResult {
    moved: boolean
    from: Position
    to: Position | null
    direction: Direction
    alive: boolean
    collectedJewel: boolean
    collectedJewelValue: number
    triggeredCurrent: boolean
    loopDetected: boolean
    blockedPosition: Position | null
}
