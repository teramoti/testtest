/**
 * 騾ｲ陦梧婿蜷代ｒ螳壽焚蛹悶☆繧狗炊逕ｱ縺ｯ縲。oardManager 縺ｨ UI 縺ｧ蜷後§蜷代″繧貞ｮ牙・縺ｫ蜈ｱ譛峨☆繧九◆繧√〒縺ゅｋ縲・ */
export const Direction = {
    Up: 0,
    Right: 1,
    Down: 2,
    Left: 3,
} as const

/**
 * 譁ｹ蜷大梛繧貞・譛峨☆繧狗炊逕ｱ縺ｯ縲∵焚蛟､縺ｮ諢丞袖繧貞梛縺ｧ蝗ｺ螳壹＠縺ｦ隱､逕ｨ繧呈ｸ帙ｉ縺吶◆繧√〒縺ゅｋ縲・ */
export type Direction = (typeof Direction)[keyof typeof Direction]
