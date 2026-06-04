/**
 * 乱数処理を分離する理由は、盤面生成の補助処理を他責務から切り離すためである。
 */
export class Random {
    /**
     * 候補から 1 件選ぶ理由は、可解盤面の崩し方を最小限の処理で実現するためである。
     */
    static pick<T>(items: T[]): T {
        const index = Math.floor(Math.random() * items.length)
        return items[index]
    }

    /**
     * 複製配列を並べ替える理由は、元データの順序を壊さず配置候補だけを散らすためである。
     */
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
     * 重み付き候補から 1 件選ぶ理由は、難易度ごとのタイル分布を単純な定義で切り替えるためである。
     */
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
