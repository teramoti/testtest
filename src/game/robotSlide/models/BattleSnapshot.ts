/**
 * 繝舌ヨ繝ｫ縺ｮ蜆ｪ蜍｢荳榊茜繧貞崋螳壼錐縺ｧ謇ｱ縺・炊逕ｱ縺ｯ縲ゞI 縺ｨ貍泌・縺ｧ蜷後§迥ｶ諷句錐繧貞・譛峨☆繧九◆繧√〒縺ゅｋ縲・ */
export type BattleState = 'ahead' | 'behind' | 'tied'

/**
 * 蟇ｾ謌ｦ繝輔ぉ繝ｼ繧ｺ繧貞崋螳壼錐縺ｧ謇ｱ縺・炊逕ｱ縺ｯ縲√Α繝九ご繝ｼ繝縺ｨ縺励※縺ｮ螻髱｢螟牙喧繧・UI 縺ｫ譏守､ｺ縺吶ｋ縺溘ａ縺ｧ縺ゅｋ縲・ */
export type BattlePhase = 'opening' | 'middle' | 'finale'

/**
 * 繝昴う繝ｳ繝医ヰ繝医Ν陦ｨ遉ｺ縺ｫ蠢・ｦ√↑蛟､縺縺代ｒ縺ｾ縺ｨ繧√ｋ逅・罰縺ｯ縲∝ｯｾ謌ｦ邂｡逅・・蜀・Κ迥ｶ諷九ｒ Scene 繧・UI 縺ｫ貍上ｉ縺輔↑縺・◆繧√〒縺ゅｋ縲・ */
export interface BattleSnapshot {
    playerScore: number
    rivalScore: number
    scoreDiff: number
    state: BattleState
    phase: BattlePhase
    phaseLabel: string
    message: string
    playerGaugeRatio: number
    rivalGaugeRatio: number
    momentum: number
    result: 'win' | 'lose' | 'draw'
}
