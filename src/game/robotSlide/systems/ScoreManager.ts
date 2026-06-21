/*
 * ScoreManager:
 * - 繧ｹ繧ｳ繧｢縲√さ繝ｳ繝懊∝ｮ晉浹蜿門ｾ励√せ繝ｩ繧､繝峨↓繧医ｋ蠕礼せ蜃ｦ逅・ｒ邂｡逅・☆繧九け繝ｩ繧ｹ縲・ * - 譖ｴ譁ｰ譎ゅ↓ Snapshot 繧堤匱陦後＠縲∫匳骭ｲ縺輔ｌ縺溘Μ繧ｹ繝翫・縺ｸ騾夂衍縺吶ｋ縲・ */
import type { RoutePreview } from '../models/RoutePreview.ts'
import type { ScoreSnapshot } from '../models/ScoreSnapshot.ts'
import { GameConfig } from '../utils/GameConfig.ts'

type ScoreUpdatedListener = (snapshot: ScoreSnapshot) => void
type ComboChangedListener = (snapshot: ScoreSnapshot) => void

export class ScoreManager {
    score: number
    slideCount: number
    travelCount: number
    jewelCount: number
    comboCount: number
    comboActive: boolean
    comboRemainingMs: number
    crashCount: number
    longestSafeRoute: number
    rescueCount: number
    loopCount: number
    lastAward: number
    lastEventLabel: string
    lastAwardDetail: string
    connectionChain: number
    jewelsSinceCrash: number
    slidesSinceLastJewel: number
    efficientCollectTotal: number
    scoreUpdatedListeners: Set<ScoreUpdatedListener>
    comboChangedListeners: Set<ComboChangedListener>

    constructor() {
        this.score = 0
        this.slideCount = 0
        this.travelCount = 0
        this.jewelCount = 0
        this.comboCount = 0
        this.comboActive = false
        this.comboRemainingMs = 0
        this.crashCount = 0
        this.longestSafeRoute = 0
        this.rescueCount = 0
        this.loopCount = 0
        this.lastAward = 0
        this.lastEventLabel = 'READY'
        this.lastAwardDetail = ''
        this.connectionChain = 0
        this.jewelsSinceCrash = 0
        this.slidesSinceLastJewel = 0
        this.efficientCollectTotal = 0
        this.scoreUpdatedListeners = new Set()
        this.comboChangedListeners = new Set()
    }

    /**
     * reset: 繧ｹ繧ｳ繧｢蜻ｨ繧翫・迥ｶ諷九ｒ縺吶∋縺ｦ蛻晄悄蛹悶＠縲√Μ繧ｹ繝翫・縺ｸ騾夂衍縺吶ｋ縲・     */
    reset(): void {
        this.score = 0
        this.slideCount = 0
        this.travelCount = 0
        this.jewelCount = 0
        this.comboCount = 0
        this.comboActive = false
        this.comboRemainingMs = 0
        this.crashCount = 0
        this.longestSafeRoute = 0
        this.rescueCount = 0
        this.loopCount = 0
        this.lastAward = 0
        this.lastEventLabel = 'READY'
        this.lastAwardDetail = ''
        this.connectionChain = 0
        this.jewelsSinceCrash = 0
        this.slidesSinceLastJewel = 0
        this.efficientCollectTotal = 0
        this.notifyScoreUpdated()
        this.notifyComboChanged()
    }

    /**
     * registerSlide: 繝励Ξ繧､繝､繝ｼ縺ｮ繧ｹ繝ｩ繧､繝画桃菴懊↓繧医ｋ蠕礼せ險育ｮ励→迥ｶ諷区峩譁ｰ繧定｡後≧縲・     * - beforePreview/afterPreview 繧呈ｯ碑ｼ・＠縺ｦ繝ｫ繝ｼ繝域・髟ｷ縲∵舞蜃ｺ縲√Ν繝ｼ繝怜ｽ｢謌舌ｒ蛻､螳壹＠蠕礼せ繧堤ｮ怜・縺吶ｋ縲・     * - carriedRobot 縺・true 縺ｮ蝣ｴ蜷医・驕区成繝懊・繝翫せ繧定・・縺吶ｋ縲・     */
    registerSlide(
        beforePreview: RoutePreview,
        afterPreview: RoutePreview,
        carriedRobot: boolean,
        movedTileCount: number = 1,
    ): ScoreSnapshot {
        const slideTileCount = Math.max(1, movedTileCount)
        this.slideCount += 1
        this.slidesSinceLastJewel += 1
        const rescued = this.isDangerRisk(beforePreview) && !this.isDangerRisk(afterPreview)
        const formedLoop = !beforePreview.loopDetected && afterPreview.loopDetected

        if (rescued) {
            this.rescueCount += 1
        }

        if (formedLoop) {
            this.loopCount += 1
        }

        if (GameConfig.SLIDE_SCORE_PENALTY > 0) {
            this.score = Math.max(0, this.score - slideTileCount * GameConfig.SLIDE_SCORE_PENALTY)
        }

        this.longestSafeRoute = Math.max(this.longestSafeRoute, afterPreview.safeStepCount)
        this.setLastEvent(
            carriedRobot ? 'ROBOT SLIDE' : 'SLIDE',
            0,
            `${slideTileCount} TILE${slideTileCount === 1 ? '' : 'S'}`,
        )
        this.notifyScoreUpdated()
        return this.getSnapshot()
    }

    /**
     * registerRobotStep: 莠縺ｮ豁ｩ陦後↓繧医ｋ蠕礼せ繧定ｨ育ｮ励＠縺ｦ譖ｴ譁ｰ縺吶ｋ縲・     * - afterPreview 縺ｫ蝓ｺ縺･縺肴磁邯壹メ繧ｧ繝ｼ繝ｳ繧・Ν繝ｼ繝医・繧､繝ｳ繝医ｒ蜿肴丐縺吶ｋ縲・     */
    registerRobotStep(afterPreview: RoutePreview, triggeredCurrent: boolean): ScoreSnapshot {
        this.travelCount += 1
        this.longestSafeRoute = Math.max(this.longestSafeRoute, afterPreview.safeStepCount)

        if (afterPreview.safeStepCount > 0 || afterPreview.loopDetected) {
            this.connectionChain += 1
        } else {
            this.connectionChain = 0
        }

        this.setLastEvent(triggeredCurrent ? 'CURRENT STEP' : 'STEP', 0)

        this.notifyScoreUpdated()
        return this.getSnapshot()
    }

    /**
     * registerJewelCollect: 螳晉浹蝗槫庶譎ゅ・蠕礼せ縺ｨ繧ｳ繝ｳ繝懃憾諷九ｒ譖ｴ譁ｰ縺吶ｋ縲・     * - 繧ｳ繝ｳ繝懊ｄ蛟咲紫繧定ｨ育ｮ励＠縲√せ繧ｳ繧｢縺ｸ蜿肴丐縺吶ｋ縲・     */

    registerJewelCollect(_routePreview: RoutePreview, jewelValue: number = 1): ScoreSnapshot {
        void _routePreview
        this.jewelCount += 1
        this.jewelsSinceCrash += 1
        this.comboCount = this.jewelsSinceCrash
        this.comboActive = this.comboCount >= 3
        this.comboRemainingMs = 0

        const award = Math.max(1, Math.trunc(jewelValue)) * GameConfig.JEWEL_SCORE

        // CHAIN / EFF は参考情報。スコア計算には使わない。
        this.efficientCollectTotal += Math.max(0, 100 - this.slidesSinceLastJewel)
        this.slidesSinceLastJewel = 0
        this.score += award
        this.setLastEvent(
            this.comboActive ? 'CHAIN' : 'JEWEL',
            award,
            `${this.comboCount} CHAIN / SCORE = JEWEL VALUE`,
        )
        this.notifyScoreUpdated()
        this.notifyComboChanged()
        return this.getSnapshot()
    }


    registerBonus(label: string, award: number, detail: string = ''): ScoreSnapshot {
        const safeAward = Math.max(0, Math.trunc(award))

        if (safeAward > 0) {
            this.score += safeAward
        }

        this.setLastEvent(label, safeAward, detail)
        this.notifyScoreUpdated()
        return this.getSnapshot()
    }

    /**
     * registerCrash: 繧ｯ繝ｩ繝・す繝･逋ｺ逕滓凾縺ｮ迥ｶ諷区峩譁ｰ・医さ繝ｳ繝懆ｧ｣髯､縲√き繧ｦ繝ｳ繝亥｢怜刈遲会ｼ峨ｒ陦後≧縲・     */
    registerCrash(): ScoreSnapshot {
        this.crashCount += 1
        this.connectionChain = 0
        this.jewelsSinceCrash = 0
        this.slidesSinceLastJewel = 0
        this.clearCombo()
        this.setLastEvent('CRASH', 0, 'LOSS 0')
        this.notifyScoreUpdated()
        this.notifyComboChanged()
        return this.getSnapshot()
    }

    /**
     * getSnapshot: UI/螟夜Κ縺ｸ貂｡縺吶◆繧√・迴ｾ蝨ｨ繧ｹ繧ｳ繧｢迥ｶ諷九・繧ｹ繝翫ャ繝励す繝ｧ繝・ヨ繧堤函謌舌☆繧九・     */
    getSnapshot(): ScoreSnapshot {
        return {
            score: this.score,
            slideCount: this.slideCount,
            travelCount: this.travelCount,
            jewelCount: this.jewelCount,
            comboCount: this.comboCount,
            comboActive: this.comboActive,
            speedLevel: Math.floor(this.score / GameConfig.SPEED_SCORE_STEP),
            crashCount: this.crashCount,
            noMissMultiplier: this.getNoMissMultiplier(),
            connectionMultiplier: this.getConnectionMultiplier(),
            longestSafeRoute: this.longestSafeRoute,
            rescueCount: this.rescueCount,
            loopCount: this.loopCount,
            lastAward: this.lastAward,
            lastEventLabel: this.lastEventLabel,
            lastAwardDetail: this.lastAwardDetail,
            efficiency: this.jewelCount === 0
                ? 100
                : Math.max(40, Math.min(100, Math.round(this.efficientCollectTotal / this.jewelCount))),
        }
    }

    onScoreUpdated(listener: ScoreUpdatedListener): void {
        this.scoreUpdatedListeners.add(listener)
    }

    offScoreUpdated(listener: ScoreUpdatedListener): void {
        this.scoreUpdatedListeners.delete(listener)
    }

    onComboChanged(listener: ComboChangedListener): void {
        this.comboChangedListeners.add(listener)
    }

    offComboChanged(listener: ComboChangedListener): void {
        this.comboChangedListeners.delete(listener)
    }

    /**
     * getShorterRouteBonus: 螳晉浹縺ｸ縺ｮ霍晞屬縺檎洒縺上↑縺｣縺溷ｴ蜷医・繝懊・繝翫せ繧定ｨ育ｮ励☆繧九Θ繝ｼ繝・ぅ繝ｪ繝・ぅ縲・     */
    getShorterRouteBonus(beforePreview: RoutePreview, afterPreview: RoutePreview): number {
        if (beforePreview.nextJewelDistance === null || afterPreview.nextJewelDistance === null) {
            return 0
        }

        const distanceGain = beforePreview.nextJewelDistance - afterPreview.nextJewelDistance
        return Math.max(0, distanceGain) * 18
    }

        /**
     * getEfficiencyAward: 繝ｫ繝ｼ繝医・蜉ｹ邇・ｧ縺ｫ蠢懊§縺溯ｿｽ蜉雉槭ｒ險育ｮ励☆繧九・     * - 萓・ 繝ｫ繝ｼ繝医・遏ｭ縺輔ｄ辟｡鬧・・蟆代↑縺輔ｒ隧穂ｾ｡縺励※繝懊・繝翫せ轤ｹ繧定ｿ斐☆縲・     */
    getEfficiencyAward(): number {
        if (this.slidesSinceLastJewel <= 1) {
            return 44
        }

        if (this.slidesSinceLastJewel <= 3) {
            return 34
        }

        if (this.slidesSinceLastJewel <= 5) {
            return 24
        }

        return 14
    }

        /**
     * getNoMissMultiplier: 逶ｴ霑代・繧ｯ繝ｩ繝・す繝･縺後↑縺・悄髢薙↓蠢懊§縺溽┌螟ｱ轤ｹ繝懊・繝翫せ蛟咲紫繧定ｿ斐☆縲・     */
    getNoMissMultiplier(): number {
        return 1 + Math.min(0.72, Math.floor(this.jewelsSinceCrash / 2) * 0.12)
    }

        /**
     * getConnectionMultiplier: 騾｣邯壽磁邯夲ｼ・onnectionChain・峨↓蝓ｺ縺･縺剰ｿｽ蜉蛟咲紫繧定ｿ斐☆繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ縲・     * - 髟ｷ縺・｣邯壽磁邯壹⊇縺ｩ蛟咲紫縺碁ｫ倥∪繧九′荳企剞縺後≠繧九・     */
    getConnectionMultiplier(): number {
        return 1 + Math.min(0.8, Math.floor(this.connectionChain / 4) * 0.16)
    }

        /**
     * isDangerRisk: RoutePreview 縺ｮ繝ｪ繧ｹ繧ｯ繝ｬ繝吶Ν縺悟些髯ｺ鬆伜沺縺九←縺・°繧貞愛螳壹☆繧九・繝ｫ繝代・縲・     * - 'danger' 縺ｾ縺溘・ 'critical' 繧貞些髯ｺ縺ｨ縺ｿ縺ｪ縺吶・     */
    isDangerRisk(preview: RoutePreview): boolean {
        return preview.riskLevel === 'danger' || preview.riskLevel === 'critical'
    }

        /**
     * clearCombo: 繧ｳ繝ｳ繝懃憾諷九ｒ螳悟・縺ｫ繝ｪ繧ｻ繝・ヨ縺吶ｋ・・I/迥ｶ諷九Μ繧ｻ繝・ヨ縺ｫ菴ｿ逕ｨ・峨・     */
    clearCombo(): void {
        this.comboActive = false
        this.comboCount = 0
        this.comboRemainingMs = 0
    }

        /**
     * setLastEvent: 譛蠕後↓逋ｺ逕溘＠縺溘う繝吶Φ繝茨ｼ医Λ繝吶Ν繝ｻ蠕礼せ繝ｻ隧ｳ邏ｰ・峨・險倬鹸繧定｡後≧縲・     * - UI 陦ｨ遉ｺ逕ｨ縺ｫ lastEventLabel/lastAward/lastAwardDetail 繧呈峩譁ｰ縺吶ｋ縲・     */
    setLastEvent(label: string, award: number, detail: string = ''): void {
        this.lastEventLabel = label
        this.lastAward = award
        this.lastAwardDetail = detail
    }

        /**
     * notifyScoreUpdated: 逋ｻ骭ｲ縺輔ｌ縺溘Μ繧ｹ繝翫・縺ｸ譛譁ｰ縺ｮ繧ｹ繧ｳ繧｢繧ｹ繝翫ャ繝励す繝ｧ繝・ヨ繧帝夂衍縺吶ｋ縲・     */
    notifyScoreUpdated(): void {
        const snapshot = this.getSnapshot()

        for (const listener of this.scoreUpdatedListeners) {
            listener(snapshot)
        }
    }

        /**
     * notifyComboChanged: 繧ｳ繝ｳ繝懃憾諷九′螟牙喧縺励◆縺ｨ縺阪↓逋ｻ骭ｲ繝ｪ繧ｹ繝翫・縺ｸ繧ｹ繝翫ャ繝励す繝ｧ繝・ヨ繧帝夂衍縺吶ｋ縲・     */
    notifyComboChanged(): void {
        const snapshot = this.getSnapshot()

        for (const listener of this.comboChangedListeners) {
            listener(snapshot)
        }
    }
}
