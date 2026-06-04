export class Random {
    static pick(items) {
        const index = Math.floor(Math.random() * items.length);
        return items[index];
    }
    static shuffle(items) {
        const shuffled = [
            ...items
        ];
        for(let index = shuffled.length - 1; index > 0; index -= 1){
            const swapIndex = Math.floor(Math.random() * (index + 1));
            const current = shuffled[index];
            shuffled[index] = shuffled[swapIndex];
            shuffled[swapIndex] = current;
        }
        return shuffled;
    }
    static weightedPick(items) {
        const totalWeight = items.reduce((sum, entry)=>sum + entry.weight, 0);
        let threshold = Math.random() * totalWeight;
        for (const entry of items){
            threshold -= entry.weight;
            if (threshold <= 0) {
                return entry.item;
            }
        }
        return items[items.length - 1].item;
    }
}
