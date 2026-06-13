/**
 * 荵ｱ謨ｰ蜃ｦ逅・ｒ蛻・屬縺吶ｋ逅・罰縺ｯ縲∫乢髱｢逕滓・縺ｮ陬懷勧蜃ｦ逅・ｒ莉冶ｲｬ蜍吶°繧牙・繧企屬縺吶◆繧√〒縺ゅｋ縲・ */
export class Random {
    /**
     * 蛟呵｣懊°繧・1 莉ｶ驕ｸ縺ｶ逅・罰縺ｯ縲∝庄隗｣逶､髱｢縺ｮ蟠ｩ縺玲婿繧呈怙蟆城剞縺ｮ蜃ｦ逅・〒螳溽樟縺吶ｋ縺溘ａ縺ｧ縺ゅｋ縲・     */
    static pick<T>(items: T[]): T {
        const index = Math.floor(Math.random() * items.length)
        return items[index]
    }

    /**
     * 隍・｣ｽ驟榊・繧剃ｸｦ縺ｹ譖ｿ縺医ｋ逅・罰縺ｯ縲∝・繝・・繧ｿ縺ｮ鬆・ｺ上ｒ螢翫＆縺夐・鄂ｮ蛟呵｣懊□縺代ｒ謨｣繧峨☆縺溘ａ縺ｧ縺ゅｋ縲・     */
    static shuffle<T>(items: T[]): T[] {
        const shuffled = [...items]

        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1))
            const current = shuffled[index]
            shuffled[index] = shuffled[swapIndex]
            shuffled[swapIndex] = current
        }

        return shuffled
    }

    /**
     * 驥阪∩莉倥″蛟呵｣懊°繧・1 莉ｶ驕ｸ縺ｶ逅・罰縺ｯ縲・屮譏灘ｺｦ縺斐→縺ｮ繧ｿ繧､繝ｫ蛻・ｸ・ｒ蜊倡ｴ斐↑螳夂ｾｩ縺ｧ蛻・ｊ譖ｿ縺医ｋ縺溘ａ縺ｧ縺ゅｋ縲・     */
    static weightedPick<T>(items: { item: T, weight: number }[]): T {
        const totalWeight = items.reduce((sum, entry) => sum + entry.weight, 0)
        let threshold = Math.random() * totalWeight

        for (const entry of items) {
            threshold -= entry.weight

            if (threshold <= 0) {
                return entry.item
            }
        }

        return items[items.length - 1].item
    }
}
