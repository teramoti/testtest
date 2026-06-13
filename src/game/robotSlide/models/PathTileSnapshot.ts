/**
 * 繧ｿ繧､繝ｫ蠖｢迥ｶ繧貞崋螳壹☆繧狗炊逕ｱ縺ｯ縲・夊ｷｯ蛻､螳壹→謠冗判陦ｨ迴ｾ繧貞酔縺伜腰菴阪〒蜈ｱ譛峨☆繧九◆繧√〒縺ゅｋ縲・ */
export type PathTileKind = 'straight' | 'corner' | 'cross' | 'tee' | 'branch'

/**
 * 霑ｽ蜉蜉ｹ譫懊ｒ蠖｢迥ｶ縺九ｉ蛻・ｊ髮｢縺咏炊逕ｱ縺ｯ縲∝ｰ・擂縺ｮ迚ｹ谿雁ｺ翫ｄ繝ｯ繝ｼ繝励ｒ蜷後§讒矩縺ｸ霈峨○繧九◆繧√〒縺ゅｋ縲・ */
export type TileFeature = 'none' | 'current'

/**
 * 繧ｿ繧､繝ｫ迚ｹ諤ｧ繧貞・謖吝梛縺ｧ謖√▽逅・罰縺ｯ縲∝崋螳壼ｺ翫ｄ蟠ｩ螢雁ｺ翫・繧医≧縺ｪ蟆・擂隕∫ｴ繧定ｿｽ蜉縺励ｄ縺吶￥縺吶ｋ縺溘ａ縺ｧ縺ゅｋ縲・ */
export type TileTrait = 'fixed' | 'rotating' | 'fragile' | 'warp'

/**
 * 蛻・ｲ舌ち繧､繝ｫ縺ｮ蜆ｪ蜈亥髄縺阪ｒ蛻･螳夂ｾｩ縺ｫ縺吶ｋ逅・罰縺ｯ縲∝酔縺俶磁邯壽焚縺ｧ繧よ嫌蜍募ｷｮ繧呈戟縺溘○繧九◆繧√〒縺ゅｋ縲・ */
export type BranchBias = 'left' | 'right'

/**
 * 繧ｿ繧､繝ｫ螳夂ｾｩ繧剃ｽ咲ｽｮ諠・ｱ縺九ｉ蛻・屬縺吶ｋ逅・罰縺ｯ縲ゞI 縺悟酔縺俶緒逕ｻ繧ｪ繝悶ず繧ｧ繧ｯ繝医ｒ蜀榊茜逕ｨ縺励ｄ縺吶￥縺吶ｋ縺溘ａ縺ｧ縺ゅｋ縲・ */
export interface PathTileSnapshot {
    id: number
    kind: PathTileKind
    rotation: number
    feature: TileFeature
    branchBias: BranchBias
    traits: TileTrait[]
}
