/**
 * バトルの優勢不利を固定名で扱う理由は、UI と演出で同じ状態名を共有するためである。
 */
export type BattleState = 'ahead' | 'behind' | 'tied'

/**
 * 対戦フェーズを固定名で扱う理由は、ミニゲームとしての局面変化を UI に明示するためである。
 */
export type BattlePhase = 'opening' | 'middle' | 'finale'

/**
 * ポイントバトル表示に必要な値だけをまとめる理由は、対戦管理の内部状態を Scene や UI に漏らさないためである。
 */
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
