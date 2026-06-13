import type { Direction } from './Direction.ts'
import type { TileFeature } from './PathTileSnapshot.ts'
import type { Position } from './Position.ts'

/**
 * 蜊ｱ髯ｺ蠎ｦ繧呈枚蟄怜・縺ｧ蝗ｺ螳壹☆繧狗炊逕ｱ縺ｯ縲ゞI 縺ｨ繧ｹ繧ｳ繧｢縺ｮ荳｡譁ｹ縺ｧ蜷後§谿ｵ髫主錐繧貞・譛峨☆繧九◆繧√〒縺ゅｋ縲・ */
export type RouteRiskLevel = 'safe' | 'warning' | 'danger' | 'critical' | 'loop'

/**
 * 莠域ｸｬ邨瑚ｷｯ縺ｮ 1 蛹ｺ髢薙ｒ蛻・屬縺吶ｋ逅・罰縺ｯ縲∵緒逕ｻ縺ｨ隧穂ｾ｡縺ｧ蜷後§譛ｪ譚･諠・ｱ繧貞・蛻ｩ逕ｨ縺吶ｋ縺溘ａ縺ｧ縺ゅｋ縲・ */
export interface RoutePreviewSegment {
    tileId: number
    position: Position
    entryDirection: Direction
    exitDirection: Direction
    distance: number
    feature: TileFeature
}

/**
 * 譛ｪ譚･邨瑚ｷｯ縺ｮ隕∫ｴ・ｒ縺ｲ縺ｨ縺ｾ縺ｨ繧√↓縺吶ｋ逅・罰縺ｯ縲∝・隱ｭ縺ｿ UI 縺ｨ蜊ｱ髯ｺ貍泌・繧堤乢髱｢繝ｭ繧ｸ繝・け縺九ｉ逶ｴ謗･蠕励ｋ縺溘ａ縺ｧ縺ゅｋ縲・ */
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
