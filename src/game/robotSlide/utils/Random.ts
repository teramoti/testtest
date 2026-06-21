/**
 * Random utility.
 * - setSeed() を使うと、同じ設定で同じ初期盤面を再現できます。
 * - seed が null の場合は Math.random() を使います。
 */
export class Random {
    static seed: number | null = null

    static setSeed(seed: number | null): void {
        if (seed === null) {
            Random.seed = null
            return
        }

        Random.seed = seed >>> 0
    }

    static next(): number {
        if (Random.seed === null) {
            return Math.random()
        }

        Random.seed = (1664525 * Random.seed + 1013904223) >>> 0
        return Random.seed / 0x100000000
    }

    static pick<T>(items: T[]): T {
        const index = Math.floor(Random.next() * items.length)
        return items[index]
    }

    static shuffle<T>(items: T[]): T[] {
        const shuffled = [...items]

        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Random.next() * (index + 1))
            const current = shuffled[index]
            shuffled[index] = shuffled[swapIndex]
            shuffled[swapIndex] = current
        }

        return shuffled
    }

    static weightedPick<T>(items: { item: T, weight: number }[]): T {
        const totalWeight = items.reduce((sum, entry) => sum + entry.weight, 0)
        let threshold = Random.next() * totalWeight

        for (const entry of items) {
            threshold -= entry.weight

            if (threshold <= 0) {
                return entry.item
            }
        }

        return items[items.length - 1].item
    }
}
