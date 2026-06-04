/**
 * スコア表示に必要な値だけをまとめるための型で、UI が ScoreManager の内部状態へ直接依存しないために必要である。
 */
export interface ScoreSnapshot {
    score: number
    slideCount: number
    travelCount: number
    jewelCount: number
    comboCount: number
    comboActive: boolean
    speedLevel: number
    crashCount: number
    noMissMultiplier: number
    connectionMultiplier: number
    longestSafeRoute: number
    rescueCount: number
    loopCount: number
    lastAward: number
    lastEventLabel: string
    lastAwardDetail: string
    efficiency: number
}
