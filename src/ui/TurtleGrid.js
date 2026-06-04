import type { BoardSnapshot } from '../models/BoardSnapshot.js'
import type { BattleSnapshot } from '../models/BattleSnapshot.js'
import { Direction, type Direction as DirectionValue } from '../models/Direction.js'
import type { MoveResult, TileSlideMove } from '../models/MoveResult.js'
import type { PathTileSnapshot } from '../models/PathTileSnapshot.js'
import type { Position } from '../models/Position.js'
import type { RouteRiskLevel } from '../models/RoutePreview.js'
import type { ScoreSnapshot } from '../models/ScoreSnapshot.js'
import type { TurtleStepResult } from '../models/TurtleStepResult.js'
import { GameConfig } from '../utils/GameConfig.js'

interface TileView {
    position: Position
    tile: PathTileSnapshot
    container: Phaser.GameObjects.Container
    plate: Phaser.GameObjects.Graphics
    tileSprite: Phaser.GameObjects.Image
    pathGlow: Phaser.GameObjects.Graphics
    pathBase: Phaser.GameObjects.Graphics
    specialAura: Phaser.GameObjects.Graphics
    nextRing: Phaser.GameObjects.Graphics
    dangerGlow: Phaser.GameObjects.Graphics
    jewel: Phaser.GameObjects.Container
    slideFx: Phaser.GameObjects.Sprite
    dangerTween: Phaser.Tweens.Tween | null
    currentTween: Phaser.Tweens.Tween | null
    nextTween: Phaser.Tweens.Tween | null
}

interface TurtleView {
    container: Phaser.GameObjects.Container
    shadow: Phaser.GameObjects.Ellipse
    sprite: Phaser.GameObjects.Sprite
}

interface ResultPanelView {
    panel: Phaser.GameObjects.Container
    scoreText: Phaser.GameObjects.Text
    statsText: Phaser.GameObjects.Text
    detailText: Phaser.GameObjects.Text
}

interface RetryNoticeView {
    panel: Phaser.GameObjects.Container
    titleText: Phaser.GameObjects.Text
    bodyText: Phaser.GameObjects.Text
}

interface BoostButtonView {
    container: Phaser.GameObjects.Container
    background: Phaser.GameObjects.Graphics
    label: Phaser.GameObjects.Text
}

interface WarningBannerView {
    container: Phaser.GameObjects.Container
    background: Phaser.GameObjects.Graphics
    label: Phaser.GameObjects.Text
}

interface CalloutView {
    container: Phaser.GameObjects.Container
    background: Phaser.GameObjects.Graphics
    titleText: Phaser.GameObjects.Text
    bodyText: Phaser.GameObjects.Text
}

type TileSelectHandler = (position: Position) => void
type RestartHandler = () => void
type BoostHandler = () => void

const UI_FONT = '"Trebuchet MS", "Yu Gothic UI", sans-serif'

export class TurtleGrid {
    scene: Phaser.Scene
    tileViews: Map<number, TileView>
    boardRouteGlow: Phaser.GameObjects.Graphics
    boardRouteLine: Phaser.GameObjects.Graphics
    routeImpact: Phaser.GameObjects.Graphics
    boardThreatFrame: Phaser.GameObjects.Graphics
    boardPulseTween: Phaser.Tweens.Tween
    blankMarker: Phaser.GameObjects.Container
    turtleView: TurtleView
    scoreValueText: Phaser.GameObjects.Text
    rivalScoreText: Phaser.GameObjects.Text
    battleLeadText: Phaser.GameObjects.Text
    battleStateText: Phaser.GameObjects.Text
    battleGaugePlayer: Phaser.GameObjects.Graphics
    battleGaugeRival: Phaser.GameObjects.Graphics
    awardText: Phaser.GameObjects.Text
    comboText: Phaser.GameObjects.Text
    routeText: Phaser.GameObjects.Text
    routeDetailText: Phaser.GameObjects.Text
    timerText: Phaser.GameObjects.Text
    phaseText: Phaser.GameObjects.Text
    timerFill: Phaser.GameObjects.Graphics
    footerText: Phaser.GameObjects.Text
    multiplierText: Phaser.GameObjects.Text
    resultPanel: ResultPanelView
    retryNotice: RetryNoticeView
    boostButton: BoostButtonView
    warningBanner: WarningBannerView
    callout: CalloutView
    tileSelectHandler: TileSelectHandler | null
    restartHandler: RestartHandler | null
    boostStartHandler: BoostHandler | null
    boostEndHandler: BoostHandler | null
    latestSnapshot: BoardSnapshot
    latestTimeLeft: number
    latestBattleSnapshot: BattleSnapshot | null
    awardSignature: string
    battleSignature: string
    calloutSerial: number
    interactionEnabled: boolean

    constructor(scene: Phaser.Scene, snapshot: BoardSnapshot) {
        this.scene = scene
        this.tileViews = new Map<number, TileView>()
        this.tileSelectHandler = null
        this.restartHandler = null
        this.boostStartHandler = null
        this.boostEndHandler = null
        this.latestSnapshot = snapshot
        this.latestTimeLeft = GameConfig.SESSION_SECONDS
        this.latestBattleSnapshot = null
        this.awardSignature = ''
        this.battleSignature = ''
        this.calloutSerial = 0
        this.interactionEnabled = true

        this.createBackdrop()
        this.createHud()
        this.createBoardBase()
        this.boardThreatFrame = this.scene.add.graphics()
        this.boardRouteGlow = this.scene.add.graphics()
        this.boardRouteLine = this.scene.add.graphics()
        this.routeImpact = this.scene.add.graphics()
        this.blankMarker = this.createBlankMarker()
        this.createTileViews(snapshot)
        this.turtleView = this.createTurtleView()
        this.resultPanel = this.createResultPanel()
        this.retryNotice = this.createRetryNotice()
        this.boostButton = this.createBoostButton()
        this.warningBanner = this.createWarningBanner()
        this.callout = this.createCallout()
        this.boardPulseTween = this.scene.tweens.add({
            targets: this.boardThreatFrame,
            alpha: 0.95,
            duration: 520,
            yoyo: true,
            repeat: -1,
            paused: true,
        })

        this.sync(snapshot, this.latestTimeLeft)
    }

    setTileSelectHandler(handler: TileSelectHandler | null): void {
        this.tileSelectHandler = handler
    }

    setRestartHandler(handler: RestartHandler | null): void {
        this.restartHandler = handler
    }

    setBoostHandlers(startHandler: BoostHandler | null, endHandler: BoostHandler | null): void {
        this.boostStartHandler = startHandler
        this.boostEndHandler = endHandler
    }

    setInteractionEnabled(enabled: boolean): void {
        this.interactionEnabled = enabled
    }

    setBoostActive(active: boolean): void {
        this.drawRoundedPanel(
            this.boostButton.background,
            -86,
            -28,
            172,
            56,
            18,
            active ? 0xf29d38 : 0x0f4251,
            1,
            active ? 0xffd79c : 0x79d3df,
            2,
        )
        this.boostButton.label.setText(active ? 'BOOST ON' : 'BOOST')
        this.boostButton.label.setColor(active ? '#072d38' : '#dff9ff')
    }

    sync(snapshot: BoardSnapshot, timeLeft: number = this.latestTimeLeft): void {
        this.latestSnapshot = snapshot
        this.latestTimeLeft = timeLeft

        const tileCatalog = new Map<number, PathTileSnapshot>(snapshot.tileCatalog.map((tile) => [tile.id, tile]))

        for (let row = 0; row < snapshot.boardSize; row += 1) {
            for (let col = 0; col < snapshot.boardSize; col += 1) {
                const tileId = snapshot.tileIds[row][col]

                if (tileId === 0) {
                    continue
                }

                const tileView = this.tileViews.get(tileId)
                const tile = tileCatalog.get(tileId)

                if (tileView === undefined || tile === undefined) {
                    continue
                }

                tileView.position = { row, col }
                tileView.tile = tile
                tileView.tileSprite.setTexture(this.getTileTexture(tile))
                tileView.tileSprite.setAngle(tile.rotation * 90)
                const center = this.getCellCenter(tileView.position)
                tileView.container.x = center.x
                tileView.container.y = center.y
                tileView.container.angle = 0
                tileView.container.scale = 1
            }
        }

        this.syncBlankMarker(snapshot.blankPosition)
        this.refreshTileStates(snapshot)
        this.syncTurtle(snapshot.turtlePosition, snapshot.turtleDirection)
        this.refreshRouteLine(snapshot)
        this.refreshThreatFrame(snapshot)
        this.refreshRouteHud(snapshot)
        this.refreshWarningBanner(snapshot)
        this.updateTimer(timeLeft)
    }

    renderSlide(snapshot: BoardSnapshot, moveResult: MoveResult, onComplete: () => void): void {
        const movedTiles = moveResult.movedTiles.length > 0
            ? moveResult.movedTiles
            : moveResult.moved && moveResult.from !== null && moveResult.to !== null
                ? [{
                    tileId: moveResult.tileId,
                    from: moveResult.from,
                    to: moveResult.to,
                    carriedTurtle: moveResult.carriedTurtle,
                }]
                : []

        if (movedTiles.length === 0) {
            onComplete()
            return
        }

        let remainingAnimations = 0
        let finished = false

        const finalize = (): void => {
            if (finished) {
                return
            }

            finished = true
            this.sync(snapshot, this.latestTimeLeft)

            if (moveResult.from !== null) {
                const blankCenter = this.getCellCenter(moveResult.from)
                this.pulseBlankMarker()
                this.emitBubbleBurst(blankCenter.x, blankCenter.y, 0x9de7f5, Math.max(6, movedTiles.length * 2))
            } else {
                this.pulseBlankMarker()
            }

            onComplete()
        }

        const finishOne = (): void => {
            remainingAnimations -= 1

            if (remainingAnimations <= 0) {
                finalize()
            }
        }

        for (const move of movedTiles) {
            const tileView = this.tileViews.get(move.tileId)

            if (tileView === undefined) {
                continue
            }

            remainingAnimations += 1
            const target = this.getCellCenter(move.to)
            const deltaX = target.x - tileView.container.x
            const deltaY = target.y - tileView.container.y
            const slideDirection = this.getTravelDirection(move.from, move.to)
            const tileBaseScale = ((GameConfig.TILE_SIZE - 12) / 128) * (this.isTileMovable(tileView.position) ? 1.03 : 1)

            this.killTweens(tileView.container)
            this.killTweens(tileView.tileSprite)
            const ghost = this.spawnTileGhost(tileView)

            tileView.slideFx.setAngle(
                slideDirection === Direction.Up || slideDirection === Direction.Down
                    ? 90
                    : slideDirection === Direction.Left
                        ? 180
                        : 0,
            )
            tileView.slideFx.setVisible(true)
            tileView.slideFx.play('tile-slide')

            this.scene.tweens.add({
                targets: ghost,
                x: target.x - deltaX * 0.18,
                y: target.y - deltaY * 0.18,
                alpha: 0,
                scaleX: ghost.scaleX * 0.96,
                scaleY: ghost.scaleY * 0.96,
                duration: GameConfig.SLIDE_TWEEN_MS + 60,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    ghost.destroy()
                },
            })
            this.scene.tweens.add({
                targets: tileView.container,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 45,
                yoyo: true,
                ease: 'Sine.easeOut',
            })
            this.scene.tweens.add({
                targets: tileView.tileSprite,
                scaleX: tileBaseScale * 1.06,
                scaleY: tileBaseScale * 0.94,
                duration: 64,
                yoyo: true,
                ease: 'Sine.easeInOut',
            })
            this.scene.tweens.add({
                targets: tileView.container,
                x: target.x + deltaX * 0.08,
                y: target.y + deltaY * 0.08,
                duration: GameConfig.SLIDE_TWEEN_MS,
                ease: 'Cubic.easeOut',
            })
            this.scene.tweens.add({
                targets: tileView.container,
                angle: Math.max(-6, Math.min(6, (deltaX + deltaY) * 0.04)),
                duration: 72,
                yoyo: true,
                ease: 'Sine.easeOut',
            })

            if (move.carriedTurtle) {
                this.killTweens(this.turtleView.container)
                this.killTweens(this.turtleView.shadow)
                this.turtleView.sprite.play('turtle-walk')
                this.scene.tweens.add({
                    targets: this.turtleView.container,
                    x: target.x,
                    y: target.y - 4,
                    duration: GameConfig.SLIDE_TWEEN_MS + 20,
                    ease: 'Cubic.easeOut',
                })
                this.scene.tweens.add({
                    targets: this.turtleView.container,
                    scaleX: 0.97,
                    scaleY: 0.93,
                    duration: 80,
                    yoyo: true,
                    ease: 'Sine.easeInOut',
                })
                this.scene.tweens.add({
                    targets: this.turtleView.shadow,
                    scaleX: 0.88,
                    alpha: 0.1,
                    duration: GameConfig.SLIDE_TWEEN_MS,
                    yoyo: true,
                    ease: 'Sine.easeInOut',
                })
            }

            this.scene.time.delayedCall(GameConfig.SLIDE_TWEEN_MS, () => {
                this.scene.tweens.add({
                    targets: tileView.container,
                    x: target.x,
                    y: target.y,
                    angle: 0,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 70,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        tileView.slideFx.stop()
                        tileView.slideFx.setVisible(false)
                        tileView.slideFx.setTexture('tile-slide-0')
                        finishOne()
                    },
                })
            })
        }

        if (remainingAnimations === 0) {
            finalize()
        }
    }

    renderTurtleStep(snapshot: BoardSnapshot, stepResult: TurtleStepResult, onComplete: () => void): void {
        if (!stepResult.moved || stepResult.to === null) {
            this.sync(snapshot, this.latestTimeLeft)
            onComplete()
            return
        }

        this.applyTurtleDirection(this.getTravelDirection(stepResult.from, stepResult.to))
        const center = this.getCellCenter(stepResult.to)
        this.killTweens(this.turtleView.container)
        this.killTweens(this.turtleView.sprite)
        this.killTweens(this.turtleView.shadow)
        this.turtleView.sprite.play('turtle-walk')

        this.scene.tweens.add({
            targets: this.turtleView.container,
            x: center.x,
            y: center.y - 6,
            duration: GameConfig.TURTLE_TWEEN_MS,
            ease: 'Sine.easeInOut',
        })
        this.scene.tweens.add({
            targets: this.turtleView.container,
            scaleX: 1.03,
            scaleY: 0.96,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeInOut',
        })
        this.scene.tweens.add({
            targets: this.turtleView.sprite,
            scaleX: 1.04,
            scaleY: 0.94,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeInOut',
        })
        this.scene.tweens.add({
            targets: this.turtleView.shadow,
            scaleX: 0.84,
            alpha: 0.08,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeInOut',
        })

        this.scene.time.delayedCall(GameConfig.TURTLE_TWEEN_MS, () => {
            this.scene.tweens.add({
                targets: this.turtleView.container,
                y: center.y,
                duration: 80,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.turtleView.sprite.stop()
                    this.turtleView.sprite.setTexture('turtle-idle')
                    this.sync(snapshot, this.latestTimeLeft)

                    if (stepResult.collectedJewel) {
                        this.emitJewelBurst(center.x, center.y)
                    } else if (stepResult.triggeredCurrent) {
                        this.emitBubbleBurst(center.x, center.y, 0x7ae6f1, 8)
                    }

                    onComplete()
                },
            })
        })
    }

    celebrateRouteConnect(position: Position): void {
        const center = this.getCellCenter(position)
        const flash = this.scene.add.circle(center.x, center.y, 18, 0xc4ffff, 0.24)
        this.emitBubbleBurst(center.x, center.y, 0x9ffbff, 10)
        this.scene.tweens.add({
            targets: flash,
            scaleX: 2.1,
            scaleY: 2.1,
            alpha: 0,
            duration: 280,
            ease: 'Sine.easeOut',
            onComplete: () => {
                flash.destroy()
            },
        })
    }

    showRouteClosure(from: Position, blockedPosition: Position | null, direction: DirectionValue): void {
        this.routeImpact.clear()
        const start = this.getCellCenter(from)
        const end = blockedPosition === null
            ? {
                x: start.x + this.getDirectionVector(direction).x * 38,
                y: start.y + this.getDirectionVector(direction).y * 38,
            }
            : this.getCellCenter(blockedPosition)

        this.routeImpact.lineStyle(10, 0xf26a5f, 0.22)
        this.routeImpact.beginPath()
        this.routeImpact.moveTo(start.x, start.y)
        this.routeImpact.lineTo(end.x, end.y)
        this.routeImpact.strokePath()
        this.routeImpact.fillStyle(0xffd2ca, 0.95)
        this.routeImpact.fillCircle(end.x, end.y, 10)
        this.emitBubbleBurst(end.x, end.y, 0xffb8aa, 10)

        this.scene.tweens.add({
            targets: this.routeImpact,
            alpha: 0,
            duration: 360,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.routeImpact.clear()
                this.routeImpact.alpha = 1
            },
        })
    }

    updateScore(snapshot: ScoreSnapshot): void {
        this.scoreValueText.setText(this.formatScore(snapshot.score))
        this.footerText.setText(`STEP ${snapshot.travelCount}   SLIDE ${snapshot.slideCount}   MISS ${snapshot.crashCount}`)
        this.multiplierText.setText(
            `NO MISS x${snapshot.noMissMultiplier.toFixed(2)}   LINK x${snapshot.connectionMultiplier.toFixed(2)}   EFF ${snapshot.efficiency}`,
        )

        const awardSignature = `${snapshot.score}-${snapshot.lastEventLabel}-${snapshot.lastAward}-${snapshot.lastAwardDetail}`

        if (snapshot.lastAward > 0 && awardSignature !== this.awardSignature) {
            this.awardSignature = awardSignature
            const awardDetail = snapshot.lastAwardDetail === ''
                ? ''
                : `  ${snapshot.lastAwardDetail}`
            this.awardText.setText(
                `${snapshot.lastEventLabel}  +${this.formatScore(snapshot.lastAward)}${awardDetail}`,
            )
            this.awardText.setAlpha(1)
            this.awardText.y = 122
            this.scene.tweens.killTweensOf(this.awardText)
            this.scene.tweens.add({
                targets: this.awardText,
                y: 104,
                alpha: 0.18,
                duration: 1400,
                ease: 'Sine.easeOut',
            })
        }
    }

    updateBattle(snapshot: BattleSnapshot): void {
        const battleSignature = `${snapshot.state}-${snapshot.phase}-${snapshot.message}`
        const battleChanged = battleSignature !== this.battleSignature
        this.latestBattleSnapshot = snapshot
        this.battleSignature = battleSignature
        this.rivalScoreText.setText(this.formatScore(snapshot.rivalScore))

        if (snapshot.state === 'ahead') {
            this.battleLeadText.setText(`LEAD ${this.formatScore(snapshot.scoreDiff)}`)
            this.battleLeadText.setColor('#dfffcf')
        } else if (snapshot.state === 'behind') {
            this.battleLeadText.setText(`CHASE ${this.formatScore(Math.abs(snapshot.scoreDiff))}`)
            this.battleLeadText.setColor('#ffd9d1')
        } else {
            this.battleLeadText.setText('EVEN')
            this.battleLeadText.setColor('#dffcff')
        }

        this.battleStateText.setText(`${snapshot.phaseLabel} · ${snapshot.message}`)
        this.battleStateText.setColor(snapshot.state === 'ahead' ? '#aee7b7' : snapshot.state === 'behind' ? '#ffb7a7' : '#9fdfea')

        this.battleGaugePlayer.clear()
        this.battleGaugeRival.clear()
        this.drawRoundedPanel(
            this.battleGaugePlayer,
            0,
            0,
            Math.max(18, 268 * snapshot.playerGaugeRatio),
            12,
            6,
            0x8fe5eb,
            1,
        )
        this.drawRoundedPanel(
            this.battleGaugeRival,
            268 - Math.max(18, 268 * snapshot.rivalGaugeRatio),
            0,
            Math.max(18, 268 * snapshot.rivalGaugeRatio),
            12,
            6,
            snapshot.state === 'behind' ? 0xf08f78 : 0xc17a74,
            0.95,
        )

        if (battleChanged) {
            this.pulseBattleHud(snapshot.state)
        }
    }

    updateCombo(snapshot: ScoreSnapshot): void {
        if (snapshot.comboActive) {
            this.comboText.setText(
                snapshot.comboCount >= GameConfig.MAX_FLOW_COUNT ? 'FLOW MAX' : `FLOW x${snapshot.comboCount}`,
            )
            this.comboText.setColor('#032737')
            return
        }

        this.comboText.setText('FLOW READY')
        this.comboText.setColor('#0f4251')
    }

    updateTimer(seconds: number): void {
        this.latestTimeLeft = seconds
        this.timerText.setText(`${seconds}s`)
        this.timerFill.clear()

        const ratio = Phaser.Math.Clamp(seconds / GameConfig.SESSION_SECONDS, 0, 1)
        const fillColor = seconds <= GameConfig.TIME_DANGER_SECONDS
            ? 0xf26a5f
            : seconds <= GameConfig.TIME_WARNING_SECONDS
                ? 0xf2bb4b
                : 0x66d2da

        this.drawRoundedPanel(this.timerFill, 0, 0, Math.max(16, 192 * ratio), 12, 6, fillColor, 1)

        if (seconds <= GameConfig.TIME_DANGER_SECONDS) {
            this.timerText.setColor('#ffebe7')
            return
        }

        if (seconds <= GameConfig.TIME_WARNING_SECONDS) {
            this.timerText.setColor('#fff0cb')
            return
        }

        this.timerText.setColor('#dffcff')
    }

    showRetryNotice(): void {
        this.retryNotice.titleText.setText('ROUTE LOST')
        this.retryNotice.bodyText.setText('盤面を再展開しています')
        this.retryNotice.panel.setVisible(true)
    }

    hideRetryNotice(): void {
        this.retryNotice.panel.setVisible(false)
    }

    showCallout(title: string, body: string, accentColor: number = 0x8fe5eb, durationMs: number = 760): void {
        this.calloutSerial += 1
        const calloutSerial = this.calloutSerial
        this.drawRoundedPanel(this.callout.background, -192, -54, 384, 108, 28, 0x072a36, 0.94, accentColor, 2)
        this.callout.titleText.setText(title)
        this.callout.bodyText.setText(body)
        this.callout.container.setVisible(true)
        this.callout.container.setAlpha(0)
        this.callout.container.setScale(0.94)
        this.callout.container.y = 344
        this.scene.tweens.killTweensOf(this.callout.container)
        this.scene.tweens.killTweensOf(this.callout.titleText)
        this.scene.tweens.killTweensOf(this.callout.bodyText)
        this.scene.tweens.add({
            targets: this.callout.container,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            y: 332,
            duration: 160,
            ease: 'Back.easeOut',
        })
        this.scene.time.delayedCall(durationMs, () => {
            if (calloutSerial !== this.calloutSerial) {
                return
            }

            this.scene.tweens.add({
                targets: this.callout.container,
                alpha: 0,
                y: 320,
                duration: 180,
                ease: 'Sine.easeOut',
                onComplete: () => {
                    if (calloutSerial === this.calloutSerial) {
                        this.callout.container.setVisible(false)
                    }
                },
            })
        })
    }

    showResult(snapshot: ScoreSnapshot, battleSnapshot: BattleSnapshot): void {
        const battleResult = battleSnapshot.result === 'win'
            ? 'VICTORY'
            : battleSnapshot.result === 'lose'
                ? 'DEFEAT'
                : 'DRAW'

        this.resultPanel.scoreText.setText(`${battleResult}  ${this.formatScore(Math.abs(battleSnapshot.scoreDiff))}`)
        this.resultPanel.statsText.setText(
            `YOU ${this.formatScore(snapshot.score)}   RIVAL ${this.formatScore(battleSnapshot.rivalScore)}`,
        )
        this.resultPanel.detailText.setText(
            `宝石 ${snapshot.jewelCount}   最長 ${snapshot.longestSafeRoute}   救済 ${snapshot.rescueCount}   ループ ${snapshot.loopCount}`,
        )
        this.resultPanel.panel.setVisible(true)
    }

    hideResult(): void {
        this.resultPanel.panel.setVisible(false)
    }

    createBackdrop(): void {
        const backdrop = this.scene.add.graphics()
        backdrop.fillStyle(0x071f29, 1)
        backdrop.fillRect(0, 0, GameConfig.GAME_WIDTH, GameConfig.GAME_HEIGHT)
        backdrop.fillStyle(0x0d3847, 1)
        backdrop.fillRect(0, 0, GameConfig.GAME_WIDTH, 230)
        backdrop.fillStyle(0x124d62, 0.8)
        backdrop.fillRect(0, 230, GameConfig.GAME_WIDTH, 220)
        backdrop.fillStyle(0x1f677b, 0.55)
        backdrop.fillRect(0, 450, GameConfig.GAME_WIDTH, 270)

        const boardAura = this.scene.add.ellipse(640, 388, 640, 560, 0x8be3ef, 0.12)
        const boardAuraInner = this.scene.add.ellipse(640, 388, 480, 430, 0xd6ffff, 0.08)
        this.scene.tweens.add({
            targets: boardAura,
            scaleX: 1.06,
            scaleY: 1.04,
            alpha: 0.18,
            duration: 4200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        })
        this.scene.tweens.add({
            targets: boardAuraInner,
            scaleX: 1.04,
            scaleY: 1.08,
            alpha: 0.14,
            duration: 5200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        })

        for (let index = 0; index < 4; index += 1) {
            const ribbon = this.scene.add.ellipse(
                180 + index * 280,
                520 + (index % 2) * 64,
                240,
                38,
                0x9adce8,
                0.12,
            )

            this.scene.tweens.add({
                targets: ribbon,
                x: ribbon.x + 80,
                duration: 7000 + index * 900,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            })
        }

        this.scene.time.addEvent({
            delay: 430,
            loop: true,
            callback: () => {
                this.spawnAmbientBubble()
            },
        })
    }

    createHud(): void {
        const hudPanel = this.scene.add.graphics()
        this.drawRoundedPanel(hudPanel, 28, 28, 1224, 124, 30, 0x072a36, 0.78, 0x67c9d6, 2)

        this.scene.add.text(72, 42, 'SCORE', {
            fontFamily: UI_FONT,
            fontSize: '18px',
            color: '#9fdfea',
            fontStyle: 'bold',
        })

        this.scoreValueText = this.scene.add.text(72, 60, '000000', {
            fontFamily: UI_FONT,
            fontSize: '48px',
            color: '#fef7d1',
            fontStyle: 'bold',
        })

        this.scene.add.text(308, 42, 'RIVAL', {
            fontFamily: UI_FONT,
            fontSize: '18px',
            color: '#ffccbf',
            fontStyle: 'bold',
        })

        this.rivalScoreText = this.scene.add.text(308, 68, '000000', {
            fontFamily: UI_FONT,
            fontSize: '36px',
            color: '#ffe2db',
            fontStyle: 'bold',
        })

        this.battleLeadText = this.scene.add.text(308, 96, 'EVEN', {
            fontFamily: UI_FONT,
            fontSize: '20px',
            color: '#dffcff',
            fontStyle: 'bold',
        })

        this.battleStateText = this.scene.add.text(308, 118, 'CLASH', {
            fontFamily: UI_FONT,
            fontSize: '14px',
            color: '#9fdfea',
        })

        const battleGaugeTrack = this.scene.add.graphics()
        this.drawRoundedPanel(battleGaugeTrack, 506, 42, 268, 12, 6, 0x103847, 1)
        this.battleGaugePlayer = this.scene.add.graphics()
        this.battleGaugeRival = this.scene.add.graphics()
        this.battleGaugePlayer.x = 506
        this.battleGaugePlayer.y = 42
        this.battleGaugeRival.x = 506
        this.battleGaugeRival.y = 42

        this.awardText = this.scene.add.text(74, 114, '', {
            fontFamily: UI_FONT,
            fontSize: '16px',
            color: '#b4f4ff',
            fontStyle: 'bold',
        })
        this.awardText.setAlpha(0)

        const comboPill = this.scene.add.graphics()
        this.drawRoundedPanel(comboPill, 506, 60, 268, 32, 16, 0x8fe5eb, 0.95)
        this.comboText = this.scene.add.text(640, 66, 'FLOW READY', {
            fontFamily: UI_FONT,
            fontSize: '20px',
            color: '#0f4251',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0)

        const routePill = this.scene.add.graphics()
        this.drawRoundedPanel(routePill, 474, 100, 332, 32, 16, 0x0d4254, 0.96, 0x6fd4df, 2)
        this.routeText = this.scene.add.text(640, 106, 'SAFE 0', {
            fontFamily: UI_FONT,
            fontSize: '20px',
            color: '#dcffff',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0)

        this.routeDetailText = this.scene.add.text(640, 142, '', {
            fontFamily: UI_FONT,
            fontSize: '18px',
            color: '#8ec7d1',
        }).setOrigin(0.5, 0)

        const timerPanel = this.scene.add.graphics()
        this.drawRoundedPanel(timerPanel, 1026, 42, 170, 56, 22, 0x0d4254, 0.98, 0x6fd4df, 2)
        this.timerText = this.scene.add.text(1112, 48, `${GameConfig.SESSION_SECONDS}s`, {
            fontFamily: UI_FONT,
            fontSize: '30px',
            color: '#dffcff',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0)

        const timerTrack = this.scene.add.graphics()
        this.drawRoundedPanel(timerTrack, 1016, 104, 192, 12, 6, 0x103847, 1)
        this.timerFill = this.scene.add.graphics()
        this.timerFill.x = 1016
        this.timerFill.y = 104

        this.phaseText = this.scene.add.text(1112, 126, '', {
            fontFamily: UI_FONT,
            fontSize: '16px',
            color: '#8ec7d1',
        }).setOrigin(0.5, 0)

        this.footerText = this.scene.add.text(72, 650, '', {
            fontFamily: UI_FONT,
            fontSize: '18px',
            color: '#b7dbe2',
        })

        this.multiplierText = this.scene.add.text(742, 650, '', {
            fontFamily: UI_FONT,
            fontSize: '18px',
            color: '#f6eab5',
        })
    }

    createBoardBase(): void {
        const boardPanel = this.scene.add.graphics()
        this.drawRoundedPanel(boardPanel, 324, 142, 632, 466, 42, 0x093242, 0.88, 0x7fd7e4, 3)

        for (let row = 0; row < GameConfig.BOARD_SIZE; row += 1) {
            for (let col = 0; col < GameConfig.BOARD_SIZE; col += 1) {
                const center = this.getCellCenter({ row, col })
                const cell = this.scene.add.graphics()
                this.drawRoundedPanel(
                    cell,
                    center.x - GameConfig.TILE_SIZE / 2 + 4,
                    center.y - GameConfig.TILE_SIZE / 2 + 4,
                    GameConfig.TILE_SIZE - 8,
                    GameConfig.TILE_SIZE - 8,
                    24,
                    0x0e4255,
                    0.9,
                    0x2f7084,
                    2,
                )
            }
        }
    }

    createBlankMarker(): Phaser.GameObjects.Container {
        const container = this.scene.add.container(0, 0)
        const glow = this.scene.add.graphics()
        this.drawRoundedPanel(
            glow,
            -GameConfig.TILE_SIZE / 2 + 12,
            -GameConfig.TILE_SIZE / 2 + 12,
            GameConfig.TILE_SIZE - 24,
            GameConfig.TILE_SIZE - 24,
            22,
            0x8fe5eb,
            0.08,
            0xc8fbff,
            2,
        )
        const center = this.scene.add.circle(0, 0, 12, 0xbeeef6, 0.45)
        container.add([glow, center])
        this.scene.tweens.add({
            targets: container,
            scaleX: 1.04,
            scaleY: 1.04,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        })
        return container
    }

    createTileViews(snapshot: BoardSnapshot): void {
        for (const tile of snapshot.tileCatalog) {
            const container = this.scene.add.container(0, 0)
            const plate = this.scene.add.graphics()
            const tileSprite = this.scene.add.image(0, 0, this.getTileTexture(tile))
            const pathGlow = this.scene.add.graphics()
            const pathBase = this.scene.add.graphics()
            const specialAura = this.scene.add.graphics()
            const nextRing = this.scene.add.graphics()
            const dangerGlow = this.scene.add.graphics()
            const jewel = this.createJewelMarker()
            const slideFx = this.scene.add.sprite(0, 0, 'tile-slide-0')
            const tileScale = (GameConfig.TILE_SIZE - 12) / 128
            const slideScale = (GameConfig.TILE_SIZE - 8) / 256

            tileSprite.setScale(tileScale)
            tileSprite.setAngle(tile.rotation * 90)
            slideFx.setScale(slideScale, tileScale)
            slideFx.setVisible(false)
            slideFx.setAlpha(0.92)

            nextRing.alpha = 0
            dangerGlow.alpha = 0

            container.add([dangerGlow, nextRing, plate, tileSprite, pathGlow, pathBase, specialAura, slideFx, jewel])
            container.setSize(GameConfig.TILE_SIZE, GameConfig.TILE_SIZE)
            container.setInteractive(
                new Phaser.Geom.Rectangle(
                    -GameConfig.TILE_SIZE / 2,
                    -GameConfig.TILE_SIZE / 2,
                    GameConfig.TILE_SIZE,
                    GameConfig.TILE_SIZE,
                ),
                Phaser.Geom.Rectangle.Contains,
            )
            container.input!.cursor = 'pointer'

            const tileView: TileView = {
                position: { row: 0, col: 0 },
                tile,
                container,
                plate,
                tileSprite,
                pathGlow,
                pathBase,
                specialAura,
                nextRing,
                dangerGlow,
                jewel,
                slideFx,
                dangerTween: null,
                currentTween: null,
                nextTween: null,
            }

            container.on('pointerdown', () => {
                this.pulseTileTap(tileView)

                if (!this.interactionEnabled || this.tileSelectHandler === null) {
                    return
                }

                this.tileSelectHandler({
                    row: tileView.position.row,
                    col: tileView.position.col,
                })
            })

            this.tileViews.set(tile.id, tileView)
        }
    }

    createTurtleView(): TurtleView {
        const container = this.scene.add.container(0, 0)
        const shadow = this.scene.add.ellipse(0, 18, 46, 18, 0x000000, 0.18)
        const sprite = this.scene.add.sprite(0, 0, 'turtle-idle')
        sprite.setScale(0.78)

        container.add([shadow, sprite])
        return {
            container,
            shadow,
            sprite,
        }
    }

    createResultPanel(): ResultPanelView {
        const panel = this.scene.add.container(640, 360)
        const background = this.scene.add.graphics()
        this.drawRoundedPanel(background, -280, -132, 560, 264, 36, 0x072a36, 0.96, 0xbef6ff, 3)
        const title = this.scene.add.text(0, -82, 'SESSION RESULT', {
            fontFamily: UI_FONT,
            fontSize: '28px',
            color: '#c7fbff',
            fontStyle: 'bold',
        }).setOrigin(0.5)
        const scoreText = this.scene.add.text(0, -24, '', {
            fontFamily: UI_FONT,
            fontSize: '42px',
            color: '#fff3c1',
            fontStyle: 'bold',
        }).setOrigin(0.5)
        const statsText = this.scene.add.text(0, 34, '', {
            fontFamily: UI_FONT,
            fontSize: '22px',
            color: '#d1f7ff',
        }).setOrigin(0.5)
        const detailText = this.scene.add.text(0, 72, '', {
            fontFamily: UI_FONT,
            fontSize: '20px',
            color: '#9ddfea',
        }).setOrigin(0.5)
        const restartButtonBg = this.scene.add.graphics()
        this.drawRoundedPanel(restartButtonBg, -104, 102, 208, 46, 18, 0x8fe5eb, 1)
        const restartButton = this.scene.add.text(0, 125, 'もう一度', {
            fontFamily: UI_FONT,
            fontSize: '22px',
            color: '#072a36',
            fontStyle: 'bold',
        }).setOrigin(0.5)

        restartButtonBg.setInteractive(
            new Phaser.Geom.Rectangle(-104, 102, 208, 46),
            Phaser.Geom.Rectangle.Contains,
        )
        restartButtonBg.on('pointerdown', () => {
            if (this.restartHandler !== null) {
                this.restartHandler()
            }
        })

        panel.add([background, title, scoreText, statsText, detailText, restartButtonBg, restartButton])
        panel.setVisible(false)

        return {
            panel,
            scoreText,
            statsText,
            detailText,
        }
    }

    createRetryNotice(): RetryNoticeView {
        const panel = this.scene.add.container(640, 360)
        const background = this.scene.add.graphics()
        this.drawRoundedPanel(background, -190, -66, 380, 132, 28, 0x072a36, 0.94, 0xffb8aa, 2)
        const titleText = this.scene.add.text(0, -18, '', {
            fontFamily: UI_FONT,
            fontSize: '30px',
            color: '#fff0ea',
            fontStyle: 'bold',
        }).setOrigin(0.5)
        const bodyText = this.scene.add.text(0, 24, '', {
            fontFamily: UI_FONT,
            fontSize: '21px',
            color: '#ffd8cf',
        }).setOrigin(0.5)

        panel.add([background, titleText, bodyText])
        panel.setVisible(false)

        return {
            panel,
            titleText,
            bodyText,
        }
    }

    createBoostButton(): BoostButtonView {
        const container = this.scene.add.container(1112, 596)
        const background = this.scene.add.graphics()
        const label = this.scene.add.text(0, 0, 'BOOST', {
            fontFamily: UI_FONT,
            fontSize: '22px',
            color: '#dff9ff',
            fontStyle: 'bold',
        }).setOrigin(0.5)
        container.add([background, label])
        container.setSize(172, 56)
        container.setInteractive(
            new Phaser.Geom.Rectangle(-86, -28, 172, 56),
            Phaser.Geom.Rectangle.Contains,
        )

        container.on('pointerdown', () => {
            if (!this.interactionEnabled || this.boostStartHandler === null) {
                return
            }

            this.boostStartHandler()
        })
        container.on('pointerup', () => {
            if (this.boostEndHandler !== null) {
                this.boostEndHandler()
            }
        })
        container.on('pointerout', () => {
            if (this.boostEndHandler !== null) {
                this.boostEndHandler()
            }
        })
        container.on('pointerupoutside', () => {
            if (this.boostEndHandler !== null) {
                this.boostEndHandler()
            }
        })

        return {
            container,
            background,
            label,
        }
    }

    createWarningBanner(): WarningBannerView {
        const container = this.scene.add.container(640, 620)
        const background = this.scene.add.graphics()
        const label = this.scene.add.text(0, 0, '', {
            fontFamily: UI_FONT,
            fontSize: '22px',
            color: '#072a36',
            fontStyle: 'bold',
        }).setOrigin(0.5)
        container.add([background, label])
        container.setVisible(false)

        return {
            container,
            background,
            label,
        }
    }

    createCallout(): CalloutView {
        const container = this.scene.add.container(640, 332)
        const background = this.scene.add.graphics()
        const titleText = this.scene.add.text(0, -12, '', {
            fontFamily: UI_FONT,
            fontSize: '28px',
            color: '#f4f8d1',
            fontStyle: 'bold',
        }).setOrigin(0.5)
        const bodyText = this.scene.add.text(0, 22, '', {
            fontFamily: UI_FONT,
            fontSize: '18px',
            color: '#d8f8ff',
            fontStyle: 'bold',
        }).setOrigin(0.5)
        container.add([background, titleText, bodyText])
        container.setDepth(24)
        container.setVisible(false)

        return {
            container,
            background,
            titleText,
            bodyText,
        }
    }

    createJewelMarker(): Phaser.GameObjects.Container {
        const container = this.scene.add.container(0, 0)
        const glow = this.scene.add.circle(0, 0, 20, 0xffe39d, 0.18)
        const gem = this.scene.add.image(0, 0, 'gem-idle')
        gem.setScale(0.24)

        container.add([glow, gem])
        container.setVisible(false)
        this.scene.tweens.add({
            targets: container,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        })
        return container
    }

    refreshTileStates(snapshot: BoardSnapshot): void {
        const movableKeys = new Set<string>(snapshot.movablePositions.map((position) => `${position.row}-${position.col}`))
        const jewelTileIds = new Set<number>(snapshot.jewelTileIds)
        const connectedTileIds = new Set<number>(snapshot.routePreview.connectedTileIds)
        const dangerTileIds = new Set<number>(snapshot.routePreview.dangerTileIds)
        const nextKey = snapshot.routePreview.nextPosition === null
            ? ''
            : `${snapshot.routePreview.nextPosition.row}-${snapshot.routePreview.nextPosition.col}`
        const currentTileId = snapshot.tileIds[snapshot.turtlePosition.row][snapshot.turtlePosition.col]

        for (const tileView of this.tileViews.values()) {
            const key = `${tileView.position.row}-${tileView.position.col}`
            const isMovable = movableKeys.has(key)
            const isConnected = connectedTileIds.has(tileView.tile.id)
            const isDanger = dangerTileIds.has(tileView.tile.id)
            const isNext = key === nextKey
            const isCurrent = tileView.tile.id === currentTileId
            const hasJewel = jewelTileIds.has(tileView.tile.id)
            this.drawTile(tileView, isMovable, isConnected, isDanger, isNext, isCurrent, hasJewel, snapshot.routePreview.riskLevel)
        }
    }

    drawTile(
        tileView: TileView,
        isMovable: boolean,
        isConnected: boolean,
        isDanger: boolean,
        isNext: boolean,
        isCurrent: boolean,
        hasJewel: boolean,
        riskLevel: RouteRiskLevel,
    ): void {
        const fillColor = isDanger
            ? 0x8b3443
            : isCurrent
                ? 0x125b6f
                : isMovable
                    ? 0x1895aa
                    : 0x0f5567
        const strokeColor = isDanger ? 0xffc4ba : isNext ? 0xfff2c0 : isMovable ? 0xd4fcff : 0x8de6f0
        const pathColor = isDanger ? 0xffc9be : isConnected ? 0xbefcff : 0x92d7df
        const pathGlowColor = riskLevel === 'loop' ? 0x9effcf : isDanger ? 0xff8d72 : 0x72f2ff

        this.drawRoundedPanel(
            tileView.plate,
            -GameConfig.TILE_SIZE / 2 + 6,
            -GameConfig.TILE_SIZE / 2 + 6,
            GameConfig.TILE_SIZE - 12,
            GameConfig.TILE_SIZE - 12,
            24,
            fillColor,
            isMovable ? 0.72 : 0.52,
            strokeColor,
            isCurrent || isMovable ? 4 : 2,
        )
        this.drawRoundedPanel(
            tileView.nextRing,
            -GameConfig.TILE_SIZE / 2 + 1,
            -GameConfig.TILE_SIZE / 2 + 1,
            GameConfig.TILE_SIZE - 2,
            GameConfig.TILE_SIZE - 2,
            28,
            0xfff3bc,
            0.08,
            0xfff2c0,
            3,
        )
        this.drawRoundedPanel(
            tileView.dangerGlow,
            -GameConfig.TILE_SIZE / 2 - 4,
            -GameConfig.TILE_SIZE / 2 - 4,
            GameConfig.TILE_SIZE + 8,
            GameConfig.TILE_SIZE + 8,
            30,
            0xffa391,
            0.08,
            0xffc0b4,
            3,
        )

        tileView.tileSprite.setTexture(this.getTileTexture(tileView.tile))
        tileView.tileSprite.setAngle(tileView.tile.rotation * 90)
        tileView.tileSprite.setAlpha(isDanger ? 0.88 : isConnected || isCurrent || isMovable ? 1 : 0.94)
        tileView.tileSprite.setScale(((GameConfig.TILE_SIZE - 12) / 128) * (isMovable ? 1.03 : 1))

        if (isDanger) {
            tileView.tileSprite.setTint(0xffcfca)
        } else {
            tileView.tileSprite.clearTint()
        }

        this.drawTilePath(tileView.pathGlow, tileView.tile, pathGlowColor, isConnected || isMovable ? 16 : 8, isConnected ? 0.26 : isMovable ? 0.14 : 0.06)
        this.drawTilePath(tileView.pathBase, tileView.tile, pathColor, 8, isConnected || isCurrent ? 0.52 : isMovable ? 0.3 : 0.18)
        this.drawSpecialAura(tileView.specialAura, tileView.tile, isConnected || isCurrent)
        tileView.jewel.setVisible(hasJewel)

        this.toggleLoopTween(tileView.nextRing, isNext, 'next', tileView)
        this.toggleLoopTween(tileView.dangerGlow, isDanger, 'danger', tileView)
        this.toggleLoopTween(tileView.specialAura, tileView.tile.feature === 'current', 'current', tileView)
    }

    drawTilePath(
        graphics: Phaser.GameObjects.Graphics,
        tile: PathTileSnapshot,
        color: number,
        lineWidth: number,
        alpha: number,
    ): void {
        graphics.clear()
        graphics.lineStyle(lineWidth, color, alpha)
        graphics.fillStyle(color, Math.min(1, alpha + 0.15))

        for (const direction of this.getConnections(tile)) {
            const vector = this.getDirectionVector(direction)
            graphics.beginPath()
            graphics.moveTo(0, 0)
            graphics.lineTo(vector.x * 34, vector.y * 34)
            graphics.strokePath()
            graphics.fillCircle(vector.x * 34, vector.y * 34, lineWidth * 0.24)
        }

        graphics.fillCircle(0, 0, lineWidth * 0.48)
    }

    drawSpecialAura(graphics: Phaser.GameObjects.Graphics, tile: PathTileSnapshot, connected: boolean): void {
        graphics.clear()
        let visible = false

        if (tile.feature === 'current') {
            visible = true
            graphics.alpha = connected ? 0.85 : 0.42
            graphics.lineStyle(2, 0x8cf5ff, 0.9)
            graphics.strokeCircle(0, 0, 18)
            graphics.beginPath()
            graphics.moveTo(-9, 8)
            graphics.lineTo(0, -10)
            graphics.lineTo(9, 8)
            graphics.strokePath()
        }

        if (tile.kind === 'branch') {
            visible = true
            const preferredDirection = tile.branchBias === 'left'
                ? this.getDirectionVector((tile.rotation + 3) % 4 as DirectionValue)
                : this.getDirectionVector((tile.rotation + 1) % 4 as DirectionValue)
            graphics.lineStyle(3, 0xfff2c0, 0.96)
            graphics.beginPath()
            graphics.moveTo(preferredDirection.x * 10, preferredDirection.y * 10)
            graphics.lineTo(preferredDirection.x * 18, preferredDirection.y * 18)
            graphics.strokePath()
            graphics.fillStyle(0xfff2c0, 0.96)
            graphics.fillCircle(preferredDirection.x * 20, preferredDirection.y * 20, 3)
        }

        if (!visible) {
            graphics.alpha = 0
        }
    }

    refreshRouteLine(snapshot: BoardSnapshot): void {
        this.boardRouteGlow.clear()
        this.boardRouteLine.clear()

        const points = [this.getCellCenter(snapshot.turtlePosition)]

        for (const segment of snapshot.routePreview.segments) {
            points.push(this.getCellCenter(segment.position))
        }

        if (points.length <= 1) {
            return
        }

        const colors = this.getRouteColors(snapshot.routePreview.riskLevel)
        this.boardRouteGlow.lineStyle(22, colors.glow, 0.22)
        this.boardRouteLine.lineStyle(8, colors.core, 0.98)

        this.boardRouteGlow.beginPath()
        this.boardRouteGlow.moveTo(points[0].x, points[0].y)
        this.boardRouteLine.beginPath()
        this.boardRouteLine.moveTo(points[0].x, points[0].y)

        for (const point of points.slice(1)) {
            this.boardRouteGlow.lineTo(point.x, point.y)
            this.boardRouteLine.lineTo(point.x, point.y)
        }

        this.boardRouteGlow.strokePath()
        this.boardRouteLine.strokePath()

        for (const point of points) {
            this.boardRouteGlow.fillStyle(colors.glow, 0.16)
            this.boardRouteGlow.fillCircle(point.x, point.y, 10)
            this.boardRouteLine.fillStyle(colors.core, 0.95)
            this.boardRouteLine.fillCircle(point.x, point.y, 4)
        }
    }

    refreshThreatFrame(snapshot: BoardSnapshot): void {
        this.boardThreatFrame.clear()

        if (snapshot.routePreview.riskLevel === 'safe' || snapshot.routePreview.riskLevel === 'loop') {
            this.boardThreatFrame.alpha = 0
            this.boardPulseTween.pause()
            return
        }

        const strokeColor = snapshot.routePreview.riskLevel === 'danger' || snapshot.routePreview.riskLevel === 'critical'
            ? 0xffb3a2
            : 0xffe2a8

        this.drawRoundedPanel(this.boardThreatFrame, 316, 134, 648, 482, 46, strokeColor, 0.03, strokeColor, 4)
        this.boardThreatFrame.alpha = 0.55
        this.boardPulseTween.resume()
    }

    refreshRouteHud(snapshot: BoardSnapshot): void {
        const preview = snapshot.routePreview
        this.phaseText.setText(snapshot.difficultyLabel)

        if (preview.loopDetected) {
            this.routeText.setText(`LOOP ${preview.safeStepCount}`)
            this.routeText.setColor('#c8ffd8')
            this.routeDetailText.setText(
                preview.nextJewelDistance === null
                    ? 'ループ成立中'
                    : `宝石まで ${preview.nextJewelDistance} マス`,
            )
            return
        }

        if (preview.riskLevel === 'critical') {
            this.routeText.setText('BREAK NOW')
            this.routeText.setColor('#ffd7cf')
            this.routeDetailText.setText('次の1歩が切れています')
            return
        }

        if (preview.riskLevel === 'danger') {
            this.routeText.setText(`DANGER ${preview.safeStepCount}`)
            this.routeText.setColor('#ffd5cd')
            this.routeDetailText.setText(
                preview.nextJewelDistance === null
                    ? '猶予が少ない状態です'
                    : `宝石まで ${preview.nextJewelDistance} マス`,
            )
            return
        }

        if (preview.riskLevel === 'warning') {
            this.routeText.setText(`WATCH ${preview.safeStepCount}`)
            this.routeText.setColor('#fff0cb')
            this.routeDetailText.setText(
                preview.nextJewelDistance === null
                    ? '分岐の読み直しが必要です'
                    : `宝石まで ${preview.nextJewelDistance} マス`,
            )
            return
        }

        this.routeText.setText(`SAFE ${preview.safeStepCount}`)
        this.routeText.setColor('#dcffff')
        this.routeDetailText.setText(
            preview.nextJewelDistance === null
                ? '次の宝石は未接続です'
                : `宝石まで ${preview.nextJewelDistance} マス`,
        )
    }

    refreshWarningBanner(snapshot: BoardSnapshot): void {
        const preview = snapshot.routePreview
        let message = ''
        let fillColor = 0x8fe5eb
        let textColor = '#072a36'

        if (preview.riskLevel === 'critical') {
            message = 'ROUTE BREAK'
            fillColor = 0xffb4a8
        } else if (preview.riskLevel === 'danger') {
            message = 'LAST CHANCE'
            fillColor = 0xffc08b
        } else if (this.latestBattleSnapshot !== null && this.latestTimeLeft <= 10 && Math.abs(this.latestBattleSnapshot.scoreDiff) <= 160) {
            message = 'PHOTO FINISH'
            fillColor = 0xffe1a2
        } else if (this.latestBattleSnapshot !== null && this.latestTimeLeft <= 12 && this.latestBattleSnapshot.state === 'behind') {
            message = 'FINAL PUSH'
            fillColor = 0xffd289
        } else if (this.latestBattleSnapshot !== null && this.latestTimeLeft <= 12 && this.latestBattleSnapshot.state === 'ahead') {
            message = 'HOLD LEAD'
            fillColor = 0xbce6b4
        } else if (this.latestTimeLeft <= GameConfig.TIME_DANGER_SECONDS) {
            message = 'HURRY'
            fillColor = 0xffd289
        } else if (this.latestTimeLeft <= GameConfig.TIME_WARNING_SECONDS) {
            message = 'TIME PRESSURE'
            fillColor = 0xffefad
        }

        if (message === '') {
            this.warningBanner.container.setVisible(false)
            return
        }

        this.drawRoundedPanel(this.warningBanner.background, -120, -20, 240, 40, 18, fillColor, 1)
        this.warningBanner.label.setText(message)
        this.warningBanner.label.setColor(textColor)
        this.warningBanner.container.setVisible(true)
    }

    syncBlankMarker(position: Position): void {
        const center = this.getCellCenter(position)
        this.blankMarker.x = center.x
        this.blankMarker.y = center.y
    }

    syncTurtle(position: Position, direction: DirectionValue): void {
        const center = this.getCellCenter(position)
        this.turtleView.container.x = center.x
        this.turtleView.container.y = center.y
        this.turtleView.container.scale = 1
        this.turtleView.sprite.stop()
        this.turtleView.sprite.setTexture('turtle-idle')
        this.turtleView.sprite.setScale(0.78)
        this.turtleView.shadow.setScale(1, 1)
        this.turtleView.shadow.setAlpha(0.18)
        this.applyTurtleDirection(direction)
    }

    applyTurtleDirection(direction: DirectionValue): void {
        if (direction === Direction.Up) {
            this.turtleView.container.angle = -90
            return
        }

        if (direction === Direction.Right) {
            this.turtleView.container.angle = 0
            return
        }

        if (direction === Direction.Down) {
            this.turtleView.container.angle = 90
            return
        }

        this.turtleView.container.angle = 180
    }

    getTileTexture(tile: PathTileSnapshot): string {
        if (tile.kind === 'straight') {
            return 'tile-straight'
        }

        if (tile.kind === 'cross') {
            return 'tile-cross'
        }

        if (tile.kind === 'tee') {
            return 'tile-tee'
        }

        if (tile.kind === 'branch') {
            return 'tile-branch'
        }

        return 'tile-corner'
    }

    getConnections(tile: PathTileSnapshot): DirectionValue[] {
        if (tile.kind === 'straight') {
            return tile.rotation % 2 === 0
                ? [Direction.Up, Direction.Down]
                : [Direction.Left, Direction.Right]
        }

        if (tile.kind === 'cross') {
            return [Direction.Up, Direction.Right, Direction.Down, Direction.Left]
        }

        if (tile.kind === 'tee' || tile.kind === 'branch') {
            if (tile.rotation === 0) {
                return [Direction.Up, Direction.Right, Direction.Left]
            }

            if (tile.rotation === 1) {
                return [Direction.Up, Direction.Right, Direction.Down]
            }

            if (tile.rotation === 2) {
                return [Direction.Right, Direction.Down, Direction.Left]
            }

            return [Direction.Up, Direction.Down, Direction.Left]
        }

        if (tile.rotation === 0) {
            return [Direction.Up, Direction.Right]
        }

        if (tile.rotation === 1) {
            return [Direction.Right, Direction.Down]
        }

        if (tile.rotation === 2) {
            return [Direction.Down, Direction.Left]
        }

        return [Direction.Left, Direction.Up]
    }

    getRouteColors(riskLevel: RouteRiskLevel): { core: number, glow: number } {
        if (riskLevel === 'loop') {
            return { core: 0xcfffd8, glow: 0x7affb1 }
        }

        if (riskLevel === 'critical' || riskLevel === 'danger') {
            return { core: 0xffd5cd, glow: 0xff7a63 }
        }

        if (riskLevel === 'warning') {
            return { core: 0xffefcb, glow: 0xf8c55e }
        }

        return { core: 0xd8fdff, glow: 0x71f4ff }
    }

    getTravelDirection(from: Position, to: Position): DirectionValue {
        if (to.row < from.row) {
            return Direction.Up
        }

        if (to.col > from.col) {
            return Direction.Right
        }

        if (to.row > from.row) {
            return Direction.Down
        }

        return Direction.Left
    }

    getCellCenter(position: Position): { x: number, y: number } {
        return {
            x: GameConfig.BOARD_ORIGIN_X + position.col * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2,
            y: GameConfig.BOARD_ORIGIN_Y + position.row * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2,
        }
    }

    getDirectionVector(direction: DirectionValue): { x: number, y: number } {
        if (direction === Direction.Up) {
            return { x: 0, y: -1 }
        }

        if (direction === Direction.Right) {
            return { x: 1, y: 0 }
        }

        if (direction === Direction.Down) {
            return { x: 0, y: 1 }
        }

        return { x: -1, y: 0 }
    }

    isTileMovable(position: Position): boolean {
        return this.latestSnapshot.movablePositions.some(
            (movablePosition) => movablePosition.row === position.row && movablePosition.col === position.col,
        )
    }

    spawnTileGhost(tileView: TileView): Phaser.GameObjects.Image {
        const ghost = this.scene.add.image(
            tileView.container.x,
            tileView.container.y,
            this.getTileTexture(tileView.tile),
        )
        const tileBaseScale = ((GameConfig.TILE_SIZE - 12) / 128) * (this.isTileMovable(tileView.position) ? 1.03 : 1)

        ghost.setAngle(tileView.tile.rotation * 90)
        ghost.setScale(tileBaseScale)
        ghost.setAlpha(0.32)
        ghost.setTint(0xdffcff)
        return ghost
    }

    pulseBlankMarker(): void {
        this.scene.tweens.add({
            targets: this.blankMarker,
            scaleX: 1.14,
            scaleY: 1.14,
            duration: 90,
            yoyo: true,
            ease: 'Back.easeOut',
        })
    }

    formatScore(score: number): string {
        return Math.max(0, Math.trunc(score)).toLocaleString('en-US')
    }

    pulseBattleHud(state: BattleSnapshot['state']): void {
        const accentColor = state === 'ahead' ? 0xdfffcf : state === 'behind' ? 0xffd9d1 : 0xdffcff
        this.killTweens(this.battleLeadText)
        this.killTweens(this.battleStateText)
        this.scene.tweens.add({
            targets: this.battleLeadText,
            scaleX: 1.06,
            scaleY: 1.06,
            duration: 90,
            yoyo: true,
            ease: 'Sine.easeOut',
        })
        this.scene.tweens.add({
            targets: this.battleStateText,
            alpha: 0.58,
            duration: 90,
            yoyo: true,
            ease: 'Sine.easeOut',
        })

        const flash = this.scene.add.rectangle(640, 90, 320, 28, accentColor === 0xdfffcf ? 0xb6f0bd : accentColor === 0xffd9d1 ? 0xffb5a6 : 0xbceeff, 0.18)
        flash.setBlendMode(Phaser.BlendModes.ADD)
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scaleX: 1.1,
            duration: 220,
            ease: 'Sine.easeOut',
            onComplete: () => {
                flash.destroy()
            },
        })
    }

    pulseTileTap(tileView: TileView): void {
        this.killTweens(tileView.container)
        this.scene.tweens.add({
            targets: tileView.container,
            scaleX: 0.96,
            scaleY: 0.96,
            duration: 40,
            yoyo: true,
            ease: 'Sine.easeOut',
        })
    }

    toggleLoopTween(
        target: Phaser.GameObjects.Graphics,
        active: boolean,
        type: 'danger' | 'current' | 'next',
        tileView: TileView,
    ): void {
        const field = type === 'danger'
            ? 'dangerTween'
            : type === 'current'
                ? 'currentTween'
                : 'nextTween'

        const tween = tileView[field]

        if (!active) {
            if (tween !== null) {
                tween.stop()
                tileView[field] = null
            }

            target.alpha = type === 'current' ? 0.42 : 0
            return
        }

        if (tween !== null) {
            return
        }

        if (type === 'current') {
            tileView[field] = this.scene.tweens.add({
                targets: target,
                alpha: 0.92,
                duration: 720,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            })
            return
        }

        tileView[field] = this.scene.tweens.add({
            targets: target,
            alpha: type === 'danger' ? 0.88 : 0.72,
            duration: type === 'danger' ? 280 : 520,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        })
    }

    drawRoundedPanel(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        fillColor: number,
        alpha: number,
        strokeColor?: number,
        strokeWidth: number = 0,
    ): void {
        graphics.clear()
        graphics.fillStyle(fillColor, alpha)
        graphics.fillRoundedRect(x, y, width, height, radius)

        if (strokeColor !== undefined && strokeWidth > 0) {
            graphics.lineStyle(strokeWidth, strokeColor, 1)
            graphics.strokeRoundedRect(x, y, width, height, radius)
        }
    }

    killTweens(target: object): void {
        this.scene.tweens.killTweensOf(target)
    }

    spawnAmbientBubble(): void {
        const bubble = this.scene.add.circle(
            Phaser.Math.Between(48, GameConfig.GAME_WIDTH - 48),
            Phaser.Math.Between(730, 780),
            Phaser.Math.Between(3, 7),
            0xd9f9ff,
            Phaser.Math.FloatBetween(0.15, 0.34),
        )

        this.scene.tweens.add({
            targets: bubble,
            y: bubble.y - Phaser.Math.Between(180, 320),
            x: bubble.x + Phaser.Math.Between(-24, 24),
            alpha: 0,
            duration: Phaser.Math.Between(2600, 4200),
            ease: 'Sine.easeOut',
            onComplete: () => {
                bubble.destroy()
            },
        })
    }

    emitBubbleBurst(x: number, y: number, color: number, count: number): void {
        for (let index = 0; index < count; index += 1) {
            const bubble = this.scene.add.circle(x, y, Phaser.Math.Between(2, 6), color, 0.55)
            const destinationX = x + Phaser.Math.Between(-26, 26)
            const destinationY = y + Phaser.Math.Between(-28, 28)

            this.scene.tweens.add({
                targets: bubble,
                x: destinationX,
                y: destinationY,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: Phaser.Math.Between(260, 520),
                ease: 'Sine.easeOut',
                onComplete: () => {
                    bubble.destroy()
                },
            })
        }
    }

    emitJewelBurst(x: number, y: number): void {
        const pickup = this.scene.add.sprite(x, y, 'gem-pickup-0')
        pickup.setScale(0.46)
        pickup.play('gem-pickup')
        pickup.once('animationcomplete', () => {
            pickup.destroy()
        })

        for (let index = 0; index < 10; index += 1) {
            const spark = this.scene.add.rectangle(x, y, 10, 4, 0xffefb2, 0.95)
            spark.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)
            const destinationX = x + Phaser.Math.Between(-44, 44)
            const destinationY = y + Phaser.Math.Between(-44, 44)

            this.scene.tweens.add({
                targets: spark,
                x: destinationX,
                y: destinationY,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: Phaser.Math.Between(260, 560),
                ease: 'Sine.easeOut',
                onComplete: () => {
                    spark.destroy()
                },
            })
        }

        const flash = this.scene.add.circle(x, y, 26, 0xfff4c6, 0.28)
        this.scene.tweens.add({
            targets: flash,
            scaleX: 1.8,
            scaleY: 1.8,
            alpha: 0,
            duration: 260,
            ease: 'Sine.easeOut',
            onComplete: () => {
                flash.destroy()
            },
        })
    }
}
