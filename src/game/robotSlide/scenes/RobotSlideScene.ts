import Phaser from 'phaser'
/*
 * RobotSlideScene:
 * - 繝｡繧､繝ｳ縺ｮ繧ｲ繝ｼ繝 Scene縲・oardManager縲ゝurtleGrid縲ヾcoreManager縲、udioDirector 縺ｪ縺ｩ繧貞・譛溷喧縺励・ *   繧ｲ繝ｼ繝騾ｲ陦鯉ｼ医ち繧､繝槭・繝ｻ莠縺ｮ豁ｩ陦後・繧ｹ繝ｩ繧､繝牙・逅・ｼ峨→繧､繝吶Φ繝医・讖区ｸ｡縺励ｒ陦後≧縲・ * - UI 縺九ｉ縺ｯ tile 驕ｸ謚槭ｒ蜿励￠蜿悶ｊ BoardManager.moveTile 繧貞他縺ｳ蜃ｺ縺吶・ */
import type { BoardSnapshot } from '../models/BoardSnapshot.ts'
import type { BattleSnapshot } from '../models/BattleSnapshot.ts'
import type { Direction as DirectionValue } from '../models/Direction.ts'
import type { Position } from '../models/Position.ts'
import type { RouteRiskLevel } from '../models/RoutePreview.ts'
import { AudioDirector } from '../systems/AudioDirector.ts'
import { BattleManager } from '../systems/BattleManager.ts'
import { BoardManager } from '../systems/BoardManager.ts'
import { ScoreManager } from '../systems/ScoreManager.ts'
import { RobotGrid } from '../ui/RobotGrid.ts'
import { GameConfig } from '../utils/GameConfig.ts'

type RobotGameResult = {
    results: Array<{ player: number, score: number, missCount: number, travelCount: number }>
}

type RobotGameOptions = {
    settings?: {
        playerCount?: number
        hudTarget?: EventTarget
    }
    hudTarget?: EventTarget | null
    onFinish?: (result: RobotGameResult) => void
    currentPlayerIndex?: number
    scores?: number[]
    playerStats?: Array<{ score: number, missCount: number, travelCount: number }>
}

export class RobotSlideScene extends Phaser.Scene {
    options: RobotGameOptions
    hudTarget: EventTarget | null
    onFinish: ((result: RobotGameResult) => void) | null
    finishSubmitted: boolean
    boardManager!: BoardManager
    battleManager!: BattleManager
    scoreManager!: ScoreManager
    robotGrid!: RobotGrid
    audioDirector!: AudioDirector
    timerEvent: Phaser.Time.TimerEvent | null
    robotEvent: Phaser.Time.TimerEvent | null
    retryEvent: Phaser.Time.TimerEvent | null
    jewelExpireEvent: Phaser.Time.TimerEvent | null
    timeLeft: number
    sessionEnded: boolean
    roundLive: boolean
    busy: boolean
    retryPending: boolean
    boosting: boolean
    speedLevel: number
    queuedTilePositions: Position[]
    latestBattleSnapshot: BattleSnapshot | null
    battleAnnouncementSignature: string

    constructor() {
        super('RobotSlideScene')
        this.options = {}
        this.hudTarget = null
        this.onFinish = null
        this.finishSubmitted = false
        this.timerEvent = null
        this.robotEvent = null
        this.retryEvent = null
        this.jewelExpireEvent = null
        this.timeLeft = GameConfig.SESSION_SECONDS
        this.sessionEnded = false
        this.roundLive = false
        this.busy = false
        this.retryPending = false
        this.boosting = false
        this.speedLevel = 0
        this.queuedTilePositions = []
        this.latestBattleSnapshot = null
        this.battleAnnouncementSignature = ''
    }

    init(options: RobotGameOptions = {}): void {
        this.options = options
        this.hudTarget = options.hudTarget ?? options.settings?.hudTarget ?? null
        this.onFinish = options.onFinish ?? null
        this.finishSubmitted = false
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#071f29')
        this.boardManager = new BoardManager()
        this.battleManager = new BattleManager()
        this.scoreManager = new ScoreManager()
        this.robotGrid = new RobotGrid(this, this.boardManager.getSnapshot())
        this.audioDirector = new AudioDirector(this)
        this.connectEvents()
        this.events.once('shutdown', () => {
            this.jewelExpireEvent?.remove()
            this.jewelExpireEvent = null
            this.audioDirector.destroy()
        })
        this.startSession()
    }

    connectEvents(): void {
        this.scoreManager.onScoreUpdated((snapshot) => {
            this.applyBattleSnapshot(this.battleManager.syncPlayerScore(snapshot, this.timeLeft))
            this.robotGrid.updateScore(snapshot)
            this.refreshRobotSpeed(snapshot.speedLevel)
            this.emitHud(snapshot.score)
        })

        this.scoreManager.onComboChanged((snapshot) => {
            this.robotGrid.updateCombo(snapshot)
        })

        this.robotGrid.setBoostHandlers(
            () => {
                this.startBoost()
            },
            () => {
                this.endBoost()
            },
        )

        this.robotGrid.setTileSelectHandler((position) => {
            this.handleTileSelected(position)
        })

        this.robotGrid.setRestartHandler(() => {
            this.scene.restart(this.options)
        })
    }

    startSession(): void {
        this.timeLeft = GameConfig.SESSION_SECONDS
        this.sessionEnded = false
        this.roundLive = false
        this.busy = false
        this.retryPending = false
        this.boosting = false
        this.speedLevel = 0
        this.queuedTilePositions = []
        this.battleAnnouncementSignature = ''
        this.boardManager.resetBoard(0)
        this.latestBattleSnapshot = this.battleManager.reset()
        this.scoreManager.reset()
        this.robotGrid.hideResult()
        this.robotGrid.hideRetryNotice()
        this.robotGrid.setInteractionEnabled(false)
        this.robotGrid.setBoostActive(false)
        this.audioDirector.setAmbience(0)
        this.startJewelExpireTimer()

        const snapshot = this.boardManager.getSnapshot()
        this.applyBattleSnapshot(this.latestBattleSnapshot, true)
        this.robotGrid.sync(snapshot, this.timeLeft)
        this.emitHud()
        this.beginRoundIntro(snapshot)
    }

    startClockTimer(): void {
        if (this.timerEvent !== null) {
            this.timerEvent.remove()
        }

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.tickClock()
            },
        })
    }

    startRobotTimer(): void {
        if (this.robotEvent !== null) {
            this.robotEvent.remove()
        }

        this.robotEvent = this.time.addEvent({
            delay: this.getCurrentRobotDelay(this.speedLevel),
            loop: true,
            callback: () => {
                this.advanceRobot()
            },
        })
    }

    startJewelExpireTimer(): void {
        if (this.jewelExpireEvent !== null) {
            this.jewelExpireEvent.remove()
        }

        this.jewelExpireEvent = this.time.addEvent({
            delay: GameConfig.JEWEL_EXPIRE_SECONDS * 1000,
            loop: true,
            callback: () => {
                this.expireJewels()
            },
        })
    }

    expireJewels(): void {
        if (this.sessionEnded || this.retryPending || !this.roundLive) {
            return
        }

        const expiredJewels = this.boardManager.expireJewels(GameConfig.JEWEL_EXPIRE_COUNT)

        for (const jewel of expiredJewels) {
            this.robotGrid.emitJewelExpire(jewel.position, jewel.value)
        }

        if (expiredJewels.length > 0) {
            this.robotGrid.sync(this.boardManager.getSnapshot(), this.timeLeft)
        }
    }

    handleTileSelected(position: Position): void {
        if (this.sessionEnded || this.retryPending || !this.roundLive) {
            return
        }

        if (this.busy) {
            this.queuedTilePositions.push({
                row: position.row,
                col: position.col,
            })
            return
        }

        const beforeSnapshot = this.boardManager.getSnapshot()
        const moveResult = this.boardManager.moveTile(position)

        if (!moveResult.moved) {
            return
        }

        const afterSnapshot = this.boardManager.getSnapshot()
        const routeImproved = this.isRouteImproved(beforeSnapshot, afterSnapshot)
        const rescuedRoute = !this.isDangerRisk(afterSnapshot.routePreview.riskLevel)
            && this.isDangerRisk(beforeSnapshot.routePreview.riskLevel)
        const loopFormed = !beforeSnapshot.routePreview.loopDetected && afterSnapshot.routePreview.loopDetected

        this.busy = true
        this.scoreManager.registerSlide(
            beforeSnapshot.routePreview,
            afterSnapshot.routePreview,
            moveResult.carriedRobot,
            moveResult.movedTiles.length,
        )

        if (rescuedRoute) {
            this.applyBattleSnapshot(this.battleManager.registerBigPlay(this.timeLeft, 'rescue'))
        }

        if (loopFormed) {
            this.applyBattleSnapshot(this.battleManager.registerBigPlay(this.timeLeft, 'loop'))
        }

        this.audioDirector.playSlide(
            Math.max(
                Math.max(0, afterSnapshot.routePreview.safeStepCount - beforeSnapshot.routePreview.safeStepCount),
                moveResult.movedTiles.length,
            ),
            routeImproved,
        )

        if (routeImproved) {
            this.audioDirector.playRouteConnect()
        }

        this.robotGrid.renderSlide(afterSnapshot, moveResult, () => {
            if (routeImproved) {
                this.robotGrid.celebrateRouteConnect(afterSnapshot.routePreview.nextPosition ?? afterSnapshot.robotPosition)
                this.cameras.main.shake(70, 0.0012)
            }

            this.busy = false
            this.updateThreat(afterSnapshot)
            this.consumeQueuedTile()
        })
    }

    advanceRobot(): void {
        if (this.sessionEnded || this.busy || this.retryPending || !this.roundLive) {
            return
        }

        const stepResult = this.boardManager.stepRobot()

        if (!stepResult.moved) {
            this.handleCrash(stepResult.from, stepResult.blockedPosition, stepResult.direction)
            return
        }

        const afterSnapshot = this.boardManager.getSnapshot()
        this.busy = true
        this.scoreManager.registerRobotStep(afterSnapshot.routePreview, stepResult.triggeredCurrent)

        if (stepResult.triggeredCurrent) {
            this.audioDirector.playSpecial()
        }

        if (stepResult.collectedJewel) {
            this.scoreManager.registerJewelCollect(afterSnapshot.routePreview, stepResult.collectedJewelValue)
            this.audioDirector.playJewel(stepResult.collectedJewelValue)
            this.cameras.main.shake(80, 0.0015)
        }

        this.robotGrid.renderRobotStep(afterSnapshot, stepResult, () => {
            this.busy = false
            this.updateThreat(afterSnapshot)
            this.consumeQueuedTile()
        })
    }

    handleCrash(from: Position, blockedPosition: Position | null, direction: DirectionValue): void {
        if (this.sessionEnded || this.retryPending) {
            return
        }

        this.retryPending = true
        this.roundLive = false
        this.busy = false
        this.queuedTilePositions = []
        this.endBoost()
        this.boardManager.collapseRobot()
        this.scoreManager.registerCrash()
        this.timeLeft = Math.max(1, this.timeLeft - GameConfig.CRASH_TIME_PENALTY_SECONDS)
        this.applyBattleSnapshot(this.battleManager.registerCrash(this.timeLeft))
        this.robotGrid.setInteractionEnabled(false)
        this.robotGrid.showRouteClosure(from, blockedPosition, direction)
        this.robotGrid.sync(this.boardManager.getSnapshot(), this.timeLeft)
        this.robotGrid.showRetryNotice()
        this.audioDirector.playCrash()
        this.cameras.main.shake(150, 0.004)

        if (this.retryEvent !== null) {
            this.retryEvent.remove()
        }

        this.retryEvent = this.time.addEvent({
            delay: GameConfig.RETRY_DELAY_MS,
            callback: () => {
                this.restartBoardAfterCrash()
            },
        })
    }

    restartBoardAfterCrash(): void {
        this.retryEvent = null

        if (this.sessionEnded) {
            return
        }

        this.boardManager.resetBoard(this.getSessionProgress())
        this.retryPending = false
        this.roundLive = true
        this.busy = false
        this.queuedTilePositions = []
        this.endBoost()
        this.robotGrid.hideRetryNotice()
        this.robotGrid.setInteractionEnabled(true)
        const snapshot = this.boardManager.getSnapshot()
        this.robotGrid.sync(snapshot, this.timeLeft)
        this.startJewelExpireTimer()
        this.robotGrid.showCallout('RECOVER', 'KEEP SCORING', 0xffd8a1, 620)
        this.updateThreat(snapshot)
    }

    startBoost(): void {
        if (this.sessionEnded || this.retryPending || this.boosting || !this.roundLive) {
            return
        }

        this.boosting = true
        this.robotGrid.setBoostActive(true)
        this.restartRobotTimerIfRunning()
    }

    endBoost(): void {
        if (!this.boosting) {
            this.robotGrid.setBoostActive(false)
            return
        }

        this.boosting = false
        this.robotGrid.setBoostActive(false)
        this.restartRobotTimerIfRunning()
    }

    tickClock(): void {
        if (this.sessionEnded || !this.roundLive) {
            return
        }

        this.timeLeft -= 1
        const snapshot = this.boardManager.getSnapshot()
        this.applyBattleSnapshot(this.battleManager.advanceClock(this.timeLeft, this.scoreManager.getSnapshot()))
        this.robotGrid.sync(snapshot, this.timeLeft)
        this.emitHud()
        this.updateThreat(snapshot)

        if (this.timeLeft <= 0) {
            this.endSession()
        }
    }

    refreshRobotSpeed(nextSpeedLevel: number): void {
        if (this.speedLevel === nextSpeedLevel) {
            return
        }

        this.speedLevel = nextSpeedLevel
        this.restartRobotTimerIfRunning()
    }

    restartRobotTimerIfRunning(): void {
        if (this.sessionEnded || this.retryPending || this.robotEvent === null) {
            return
        }

        this.startRobotTimer()
    }

    getCurrentRobotDelay(speedLevel: number): number {
        const baseDelay = Math.max(
            GameConfig.MIN_ROBOT_STEP_MS,
            GameConfig.ROBOT_STEP_MS - speedLevel * GameConfig.ROBOT_STEP_ACCELERATION_MS,
        )

        if (!this.boosting) {
            return baseDelay
        }

        return Math.max(
            GameConfig.MIN_BOOST_ROBOT_STEP_MS,
            baseDelay - GameConfig.BOOST_ROBOT_STEP_REDUCTION_MS,
        )
    }

    endSession(): void {
        if (this.sessionEnded) {
            return
        }

        this.sessionEnded = true
        this.roundLive = false
        this.busy = false
        this.retryPending = false
        this.boosting = false
        this.queuedTilePositions = []
        this.robotGrid.hideRetryNotice()
        this.robotGrid.setInteractionEnabled(false)
        this.robotGrid.setBoostActive(false)
        this.audioDirector.setAmbience(0)

        if (this.timerEvent !== null) {
            this.timerEvent.remove()
            this.timerEvent = null
        }

        if (this.robotEvent !== null) {
            this.robotEvent.remove()
            this.robotEvent = null
        }

        if (this.retryEvent !== null) {
            this.retryEvent.remove()
            this.retryEvent = null
        }

        this.applyBattleSnapshot(this.battleManager.syncPlayerScore(this.scoreManager.getSnapshot(), this.timeLeft), true)

        if (this.latestBattleSnapshot !== null) {
            this.robotGrid.showResult(this.scoreManager.getSnapshot(), this.latestBattleSnapshot)
        }

        this.submitResult()
    }

    emitHud(score: number = this.scoreManager.getSnapshot().score): void {
        if (this.hudTarget === null) {
            return
        }

        const playerCount = this.getPlayerCount()
        const currentPlayerIndex = this.getCurrentPlayerIndex()
        const scores: Array<number | null> = Array(playerCount).fill(null)

        for (let index = 0; index < playerCount; index += 1) {
            scores[index] = this.options.scores?.[index] ?? null
        }

        scores[currentPlayerIndex] = score

        this.hudTarget.dispatchEvent(new CustomEvent('game-hud-update', {
            detail: {
                currentPlayerIndex,
                playerCount,
                scores,
                currentScore: score,
                timeLeft: this.timeLeft,
                ruleName: 'Robot Slide',
            },
        }))
    }

    getPlayerCount(): number {
        return Math.max(1, Math.trunc(this.options.settings?.playerCount ?? 1))
    }

    getCurrentPlayerIndex(): number {
        return Math.max(0, Math.min(this.getPlayerCount() - 1, Math.trunc(this.options.currentPlayerIndex ?? 0)))
    }

    submitResult(): void {
        if (this.finishSubmitted) {
            return
        }

        this.finishSubmitted = true
        const snapshot = this.scoreManager.getSnapshot()
        const score = snapshot.score
        const playerCount = this.getPlayerCount()
        const currentPlayerIndex = this.getCurrentPlayerIndex()
        const scores = Array.from({ length: playerCount }, (_, index) => this.options.scores?.[index] ?? 0)
        const playerStats = Array.from({ length: playerCount }, (_, index) => this.options.playerStats?.[index] ?? {
            score: this.options.scores?.[index] ?? 0,
            missCount: 0,
            travelCount: 0,
        })
        scores[currentPlayerIndex] = score
        playerStats[currentPlayerIndex] = {
            score,
            missCount: snapshot.crashCount,
            travelCount: snapshot.travelCount,
        }
        this.options.scores = scores
        this.options.playerStats = playerStats
        this.emitHud(score)

        if (currentPlayerIndex + 1 < playerCount) {
            this.options.currentPlayerIndex = currentPlayerIndex + 1
            this.time.delayedCall(2200, () => {
                this.scene.restart(this.options)
            })
            return
        }

        this.onFinish?.({
            results: playerStats.map((stats, index) => ({
                player: index + 1,
                score: stats.score,
                missCount: stats.missCount,
                travelCount: stats.travelCount,
            })),
        })
    }

    updateThreat(snapshot: BoardSnapshot): void {
        const dangerLevel = this.getDangerLevel(snapshot.routePreview.riskLevel, this.timeLeft, this.latestBattleSnapshot)
        this.audioDirector.setAmbience(dangerLevel)

        if (dangerLevel >= 2) {
            this.audioDirector.playWarning()
        }
    }

    getDangerLevel(riskLevel: RouteRiskLevel, timeLeft: number, battleSnapshot: BattleSnapshot | null): number {
        const routeLevel = riskLevel === 'critical'
            ? 3
            : riskLevel === 'danger'
                ? 2
                : riskLevel === 'warning'
                    ? 1
                    : 0
        const timeLevel = timeLeft <= GameConfig.TIME_DANGER_SECONDS
            ? 3
            : timeLeft <= GameConfig.TIME_WARNING_SECONDS
                ? 1
                : 0
        const battleLevel = battleSnapshot !== null && battleSnapshot.state === 'behind'
            ? timeLeft <= 12
                ? 2
                : timeLeft <= 22
                    ? 1
                    : 0
            : 0
        return Math.max(routeLevel, timeLevel, battleLevel)
    }

    isRouteImproved(beforeSnapshot: BoardSnapshot, afterSnapshot: BoardSnapshot): boolean {
        return afterSnapshot.routePreview.safeStepCount > beforeSnapshot.routePreview.safeStepCount
            || (!this.isDangerRisk(afterSnapshot.routePreview.riskLevel) && this.isDangerRisk(beforeSnapshot.routePreview.riskLevel))
            || (!beforeSnapshot.routePreview.loopDetected && afterSnapshot.routePreview.loopDetected)
    }

    isDangerRisk(riskLevel: RouteRiskLevel): boolean {
        return riskLevel === 'danger' || riskLevel === 'critical'
    }

    getSessionProgress(): number {
        return 1 - this.timeLeft / GameConfig.SESSION_SECONDS
    }

    beginRoundIntro(snapshot: BoardSnapshot): void {
        this.robotGrid.showCallout('ROUND START', 'COLLECT JEWELS', 0x8fe5eb, 640)
        this.time.delayedCall(760, () => {
            if (this.sessionEnded) {
                return
            }

            this.robotGrid.showCallout('DIVE', 'READ AHEAD', 0xf6e0a8, 520)
        })
        this.time.delayedCall(1320, () => {
            if (this.sessionEnded) {
                return
            }

            this.roundLive = true
            this.robotGrid.setInteractionEnabled(true)
            this.startClockTimer()
            this.startRobotTimer()
            this.updateThreat(snapshot)
        })
    }

    applyBattleSnapshot(snapshot: BattleSnapshot, silent: boolean = false): void {
        const previousSnapshot = this.latestBattleSnapshot
        this.latestBattleSnapshot = snapshot
        this.robotGrid.updateBattle(snapshot)

        if (silent || previousSnapshot === null) {
            return
        }

        this.maybeAnnounceBattleShift(previousSnapshot, snapshot)
    }

    maybeAnnounceBattleShift(previousSnapshot: BattleSnapshot, nextSnapshot: BattleSnapshot): void {
        let signature = ''
        let title = ''
        let body = ''
        let accentColor = 0x8fe5eb

        if (previousSnapshot.phase !== nextSnapshot.phase) {
            signature = `phase-${nextSnapshot.phase}`
            title = nextSnapshot.phase === 'middle' ? 'MID TIDE' : 'FINAL RUSH'
            body = nextSnapshot.phase === 'middle' ? 'READ THE BRANCHES' : 'LAST PUSH'
            accentColor = nextSnapshot.phase === 'middle' ? 0xbceeff : 0xffd48f
        } else if (previousSnapshot.state !== nextSnapshot.state) {
            signature = `state-${nextSnapshot.state}`

            if (nextSnapshot.state === 'ahead') {
                title = 'TARGET CLEAR'
                body = 'KEEP COLLECTING'
                accentColor = 0xbfeec6
            } else if (nextSnapshot.state === 'behind') {
                title = 'TARGET LEFT'
                body = 'COLLECT JEWELS'
                accentColor = 0xffc3b6
            } else {
                title = 'TARGET'
                body = 'ONE JEWEL CAN CLEAR'
                accentColor = 0xbceeff
            }
        } else if (this.timeLeft <= 10 && Math.abs(nextSnapshot.scoreDiff) <= 160) {
            signature = `photo-${this.timeLeft}`
            title = 'LAST CHANCE'
            body = 'ONE JEWEL CAN CLEAR'
            accentColor = 0xffe2a1
        }

        if (signature === '' || signature === this.battleAnnouncementSignature) {
            return
        }

        this.battleAnnouncementSignature = signature
        this.robotGrid.showCallout(title, body, accentColor, 760)
    }

    consumeQueuedTile(): void {
        if (this.busy || this.sessionEnded || this.retryPending || this.queuedTilePositions.length === 0) {
            return
        }

        const nextPosition = this.queuedTilePositions.shift()

        if (nextPosition === undefined) {
            return
        }

        this.time.delayedCall(0, () => {
            this.handleTileSelected(nextPosition)

            if (!this.busy && !this.sessionEnded && !this.retryPending && this.queuedTilePositions.length > 0) {
                this.consumeQueuedTile()
            }
        })
    }
}
