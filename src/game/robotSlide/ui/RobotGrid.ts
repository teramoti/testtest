import Phaser from 'phaser'
import type { BoardSnapshot } from '../models/BoardSnapshot.ts'
import type { BattleSnapshot } from '../models/BattleSnapshot.ts'
import { Direction, type Direction as DirectionValue } from '../models/Direction.ts'
import type { MoveResult } from '../models/MoveResult.ts'
import type { PathTileSnapshot } from '../models/PathTileSnapshot.ts'
import type { Position } from '../models/Position.ts'
import type { RouteRiskLevel } from '../models/RoutePreview.ts'
import type { ScoreSnapshot } from '../models/ScoreSnapshot.ts'
import type { RobotStepResult } from '../models/RobotStepResult.ts'
import { GameConfig } from '../utils/GameConfig.ts'

/**
 * RobotGrid: Responsible for rendering tiles, handling input, and animating slides.
 * - Uses snapshot data from BoardManager; UI should rely on snapshot.boardSize and tileIds.
 * - renderSlide expects moveResult.movedTiles[]: each entry must contain tileId, from, to.
 * - Pointer alignment issues can come from mismatched GameConfig origin/size or canvas scaling.
 * - For touch devices, prefer pointerdown/pointerup handling instead of pointerover previews.
 */

interface TileView {
    position: Position
    tile: PathTileSnapshot
    _pressStart?: { x: number; y: number }
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

interface RobotView {
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
const TILE_DEPTH_BASE = 100
const SLIDING_TILE_DEPTH_BASE = 1000
const ROBOT_DEPTH = 1200
const OVERLAY_DEPTH = 2100
const RESULT_DEPTH = 2200

export class RobotGrid {
    scene: Phaser.Scene
    tileViews: Map<number, TileView>
    boardRouteGlow: Phaser.GameObjects.Graphics
    boardRouteLine: Phaser.GameObjects.Graphics
    routeImpact: Phaser.GameObjects.Graphics
    boardThreatFrame: Phaser.GameObjects.Graphics
    boardPulseTween: Phaser.Tweens.Tween
    blankMarkers: Phaser.GameObjects.Container[]
    robotView: RobotView
    scoreValueText!: Phaser.GameObjects.Text
    rivalScoreText!: Phaser.GameObjects.Text
    battleLeadText!: Phaser.GameObjects.Text
    battleStateText!: Phaser.GameObjects.Text
    battleGaugePlayer!: Phaser.GameObjects.Graphics
    battleGaugeRival!: Phaser.GameObjects.Graphics
    awardText!: Phaser.GameObjects.Text
    comboText!: Phaser.GameObjects.Text
    routeText!: Phaser.GameObjects.Text
    routeDetailText!: Phaser.GameObjects.Text
    timerText!: Phaser.GameObjects.Text
    phaseText!: Phaser.GameObjects.Text
    timerFill!: Phaser.GameObjects.Graphics
    footerText!: Phaser.GameObjects.Text
    multiplierText!: Phaser.GameObjects.Text
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
        this.tileViews = new Map()
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
        this.blankMarkers = this.createBlankMarkers(2)
        this.createTileViews(snapshot)
        this.robotView = this.createRobotView()
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

    /**
     * sync: BoardManager 縺九ｉ貂｡縺輔ｌ縺・snapshot 繧貞・縺ｫ UI 縺ｮ蜈ｨ陦ｨ遉ｺ繧呈峩譁ｰ縺吶ｋ縲・     * - tileViews 縺ｮ菴咲ｽｮ/繧ｹ繝励Λ繧､繝医ｒ譖ｴ譁ｰ縺励｜lank/robot/route/HUD 繧貞酔譛溘☆繧九・     * - snapshot.boardSize 繧貞茜逕ｨ縺励※蜿ｯ螟峨し繧､繧ｺ縺ｫ蟇ｾ蠢懊☆繧九・     */
    sync(snapshot: BoardSnapshot, timeLeft: number = this.latestTimeLeft): void {
        this.latestSnapshot = snapshot
        this.latestTimeLeft = timeLeft

        const tileCatalog = new Map(snapshot.tileCatalog.map((tile) => [tile.id, tile]))

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
                tileView.tileSprite.setAngle(this.getTileAngle())
                tileView.tileSprite.setScale(this.getTextureScale(this.getTileTexture(tile), GameConfig.TILE_SIZE - 10))
                const center = this.getCellCenter(tileView.position)
                tileView.container.x = center.x
                tileView.container.y = center.y
                tileView.container.angle = 0
                tileView.container.scale = 1
                tileView.container.setDepth(TILE_DEPTH_BASE + row * snapshot.boardSize + col)
            }
        }

        this.syncBlankMarkers(snapshot.blankPositions ?? [snapshot.blankPosition])
        this.refreshTileStates(snapshot)
        this.syncRobot(snapshot.robotPosition, snapshot.robotDirection)
        this.refreshRouteLine(snapshot)
        this.refreshThreatFrame(snapshot)
        this.refreshRouteHud(snapshot)
        this.refreshWarningBanner(snapshot)
        this.updateTimer(timeLeft)
    }

    /**
     * renderSlide: BoardManager.moveTile 縺ｮ謌ｻ繧雁､ movedTiles 繧貞女縺大叙繧翫∝推繧ｿ繧､繝ｫ繧貞句挨縺ｫ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺吶ｋ縲・     * - movedTiles 驟榊・縺ｮ蜀・ｮｹ・・ileId, from, to, carriedRobot・峨↓蝓ｺ縺･縺・tween 繧剃ｽ懈・縺吶ｋ縲・     * - UI 蛛ｴ縺ｧ tileViews.get(tileId) 縺瑚ｦ九▽縺九ｉ縺ｪ縺・ｴ蜷医・繧ｹ繧ｭ繝・・縺吶ｋ縲・     * - 繧｢繝九Γ螳御ｺ・ｾ後↓ this.sync 繧貞他縺ｳ縲∫乢髱｢繧貞・繝ｬ繝ｳ繝繝ｪ繝ｳ繧ｰ縺吶ｋ縲・     */
    renderSlide(snapshot: BoardSnapshot, moveResult: MoveResult, onComplete: () => void): void {
        // Accepts moveResult.movedTiles (array) produced by BoardManager.moveTile.
        // Added debug logging to help diagnose cases where only one tile visually moves.
        const movedTiles = moveResult.movedTiles && moveResult.movedTiles.length > 0
            ? moveResult.movedTiles
            : moveResult.moved && moveResult.from !== null && moveResult.to !== null
                ? [{
                    tileId: moveResult.tileId,
                    from: moveResult.from,
                    to: moveResult.to,
                    carriedRobot: moveResult.carriedRobot,
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
                this.pulseBlankMarkers()
                this.emitBubbleBurst(blankCenter.x, blankCenter.y, 0x9de7f5, Math.max(6, movedTiles.length * 2))
            } else {
                this.pulseBlankMarkers()
            }

            onComplete()
        }

        const finishOne = (): void => {
            remainingAnimations -= 1

            if (remainingAnimations <= 0) {
                finalize()
            }
        }

        for (const [index, move] of movedTiles.entries()) {
            const tileView = this.tileViews.get(move.tileId)

            if (tileView === undefined) {
                continue
            }

            remainingAnimations += 1
            tileView.container.setDepth(SLIDING_TILE_DEPTH_BASE + index)
            const target = this.getCellCenter(move.to)
            const deltaX = target.x - tileView.container.x
            const deltaY = target.y - tileView.container.y
            const slideDirection = this.getTravelDirection(move.from, move.to)
            const tileBaseScale = this.getTextureScale(this.getTileTexture(tileView.tile), GameConfig.TILE_SIZE - 10)
                * (this.isTileMovable(tileView.position) ? 1.03 : 1)
            const staggerDelay = index * 18

            this.killTweens(tileView.container)
            this.killTweens(tileView.tileSprite)
            const ghost = this.spawnTileGhost(tileView)
            this.scene.time.delayedCall(staggerDelay, () => {
                this.emitSlideTrail(move.from, move.to, move.carriedRobot ? 0xfff0bb : 0x9ffbff)
                tileView.slideFx.setAngle(
                    slideDirection === Direction.Up || slideDirection === Direction.Down
                        ? 90
                        : slideDirection === Direction.Left
                            ? 180
                            : 0,
                )
                tileView.slideFx.setVisible(true)
                tileView.slideFx.play('tile-slide')
            })

            this.scene.tweens.add({
                targets: ghost,
                x: target.x - deltaX * 0.18,
                y: target.y - deltaY * 0.18,
                alpha: 0,
                scaleX: ghost.scaleX * 0.96,
                scaleY: ghost.scaleY * 0.96,
                duration: GameConfig.SLIDE_TWEEN_MS + 60,
                delay: staggerDelay,
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
                delay: staggerDelay,
                yoyo: true,
                ease: 'Sine.easeOut',
            })
            this.scene.tweens.add({
                targets: tileView.tileSprite,
                scaleX: tileBaseScale * 1.06,
                scaleY: tileBaseScale * 0.94,
                duration: 64,
                delay: staggerDelay,
                yoyo: true,
                ease: 'Sine.easeInOut',
            })
            this.scene.tweens.add({
                targets: tileView.container,
                x: target.x + deltaX * 0.08,
                y: target.y + deltaY * 0.08,
                duration: GameConfig.SLIDE_TWEEN_MS,
                delay: staggerDelay,
                ease: 'Cubic.easeOut',
            })
            this.scene.tweens.add({
                targets: tileView.container,
                angle: Math.max(-6, Math.min(6, (deltaX + deltaY) * 0.04)),
                duration: 72,
                delay: staggerDelay,
                yoyo: true,
                ease: 'Sine.easeOut',
            })

            if (move.carriedRobot) {
                this.killTweens(this.robotView.container)
                this.killTweens(this.robotView.shadow)
                this.robotView.container.setDepth(ROBOT_DEPTH)
                this.robotView.sprite.play(this.getRobotWalkAnimation(this.getTravelDirection(move.from, move.to)))
                this.scene.tweens.add({
                    targets: this.robotView.container,
                    x: target.x,
                    y: target.y - 4,
                    duration: GameConfig.SLIDE_TWEEN_MS + 20,
                    delay: staggerDelay,
                    ease: 'Cubic.easeOut',
                })
                this.scene.tweens.add({
                    targets: this.robotView.container,
                    scaleX: 0.97,
                    scaleY: 0.93,
                    duration: 80,
                    delay: staggerDelay,
                    yoyo: true,
                    ease: 'Sine.easeInOut',
                })
                this.scene.tweens.add({
                    targets: this.robotView.shadow,
                    scaleX: 0.88,
                    alpha: 0.1,
                    duration: GameConfig.SLIDE_TWEEN_MS,
                    delay: staggerDelay,
                    yoyo: true,
                    ease: 'Sine.easeInOut',
                })
            }

            this.scene.time.delayedCall(GameConfig.SLIDE_TWEEN_MS + staggerDelay, () => {
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

    /**
     * renderRobotStep: 繧ｫ繝｡縺ｮ騾ｲ陦後ｒ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺励∝ｮ御ｺ・ｾ後↓ snapshot 縺ｧ蜷梧悄縺吶ｋ縲・     * - 遘ｻ蜍輔′縺ｪ縺代ｌ縺ｰ蜊ｳ蠎ｧ縺ｫ蜷梧悄縺励※繧ｳ繝ｼ繝ｫ繝舌ャ繧ｯ繧貞他縺ｶ縲・     */
    renderRobotStep(snapshot: BoardSnapshot, stepResult: RobotStepResult, onComplete: () => void): void {
        if (!stepResult.moved || stepResult.to === null) {
            this.sync(snapshot, this.latestTimeLeft)
            onComplete()
            return
        }

        const travelDirection = this.getTravelDirection(stepResult.from, stepResult.to)
        this.applyRobotDirection(travelDirection)
        const center = this.getCellCenter(stepResult.to)
        this.killTweens(this.robotView.container)
        this.killTweens(this.robotView.sprite)
        this.killTweens(this.robotView.shadow)
        this.robotView.sprite.play(this.getRobotWalkAnimation(travelDirection))

        this.scene.tweens.add({
            targets: this.robotView.container,
            x: center.x,
            y: center.y - 6,
            duration: GameConfig.ROBOT_TWEEN_MS,
            ease: 'Sine.easeInOut',
        })
        this.scene.tweens.add({
            targets: this.robotView.container,
            scaleX: 1.03,
            scaleY: 0.96,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeInOut',
        })
        this.scene.tweens.add({
            targets: this.robotView.sprite,
            scaleX: 1.04,
            scaleY: 0.94,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeInOut',
        })
        this.scene.tweens.add({
            targets: this.robotView.shadow,
            scaleX: 0.84,
            alpha: 0.08,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeInOut',
        })

        this.scene.time.delayedCall(GameConfig.ROBOT_TWEEN_MS, () => {
            this.scene.tweens.add({
                targets: this.robotView.container,
                y: center.y,
                duration: 80,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.robotView.sprite.stop()
                    this.robotView.sprite.setTexture(this.getRobotIdleTexture(snapshot.robotDirection))
                    this.robotView.sprite.setScale(GameConfig.ROBOT_SCALE)
                    this.sync(snapshot, this.latestTimeLeft)

                    if (stepResult.collectedJewel) {
                        this.emitJewelBurst(center.x, center.y, stepResult.collectedJewelValue)
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
        this.multiplierText.setText(`JEWEL ${snapshot.jewelCount}   LONGEST ${snapshot.longestSafeRoute}`)

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
            this.battleLeadText.setText('CLEAR')
            this.battleLeadText.setColor('#dfffcf')
        } else if (snapshot.state === 'behind') {
            this.battleLeadText.setText(`LEFT ${this.formatScore(Math.abs(snapshot.scoreDiff))}`)
            this.battleLeadText.setColor('#ffd9d1')
        } else {
            this.battleLeadText.setText('TARGET')
            this.battleLeadText.setColor('#dffcff')
        }

        this.battleStateText.setText(`${snapshot.phaseLabel} / ${snapshot.message}`)
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
        this.comboText.setText(`JEWELS ${snapshot.jewelCount}`)
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
        this.retryNotice.bodyText.setText('Rebuilding board')
        this.retryNotice.panel.setVisible(true)
    }

    hideRetryNotice(): void {
        this.retryNotice.panel.setVisible(false)
    }

    showAssistHint(position: Position, label: string = 'MOVE THIS'): void {
        const center = this.getCellCenter(position)
        this.routeImpact.lineStyle(7, 0xffe281, 0.96)
        this.routeImpact.strokeCircle(center.x, center.y, GameConfig.TILE_SIZE * 0.52)
        this.routeImpact.lineStyle(3, 0xffffff, 0.82)
        this.routeImpact.strokeCircle(center.x, center.y, GameConfig.TILE_SIZE * 0.64)

        const text = this.scene.add.text(center.x, center.y - GameConfig.TILE_SIZE * 0.72, label, {
            fontFamily: UI_FONT,
            fontSize: '18px',
            fontStyle: '900',
            color: '#fff4c5',
            stroke: '#072a36',
            strokeThickness: 5,
        }).setOrigin(0.5).setDepth(OVERLAY_DEPTH + 1)

        this.scene.tweens.add({
            targets: text,
            y: text.y - 8,
            alpha: 0,
            duration: 1100,
            ease: 'Sine.easeOut',
            onComplete: () => {
                text.destroy()
            },
        })
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
        const resultText = battleSnapshot.result === 'win' ? 'CLEAR' : 'TIME UP'

        this.resultPanel.scoreText.setText(`${resultText}  ${this.formatScore(snapshot.score)}`)
        this.resultPanel.statsText.setText(
            `TARGET ${this.formatScore(battleSnapshot.rivalScore)}   LEFT ${this.formatScore(Math.max(0, -battleSnapshot.scoreDiff))}`,
        )
        this.resultPanel.detailText.setText(
            `JEWEL ${snapshot.jewelCount}   STEP ${snapshot.travelCount}   SLIDE ${snapshot.slideCount}   MISS ${snapshot.crashCount}`,
        )
        this.resultPanel.panel.setVisible(true)
    }

    hideResult(): void {
        this.resultPanel.panel.setVisible(false)
    }

    createBackdrop(): void {
        this.scene.add.image(640, 360, 'game-background').setDisplaySize(
            GameConfig.GAME_WIDTH,
            GameConfig.GAME_HEIGHT,
        )

        const backdrop = this.scene.add.graphics()
        backdrop.fillStyle(0x04181f, 0.38)
        backdrop.fillRect(0, 0, GameConfig.GAME_WIDTH, GameConfig.GAME_HEIGHT)
        backdrop.fillStyle(0x082731, 0.62)
        backdrop.fillRoundedRect(342, 68, 596, 620, 36)
        backdrop.lineStyle(3, 0xffd274, 0.42)
        backdrop.strokeRoundedRect(342, 68, 596, 620, 36)
        backdrop.fillStyle(0x0d4254, 0.32)
        backdrop.fillRect(0, 0, GameConfig.GAME_WIDTH, 106)
        backdrop.fillRect(0, 612, GameConfig.GAME_WIDTH, 108)

        const boardAura = this.scene.add.ellipse(640, 388, 760, 610, 0x8be3ef, 0.16)
        const boardAuraInner = this.scene.add.ellipse(640, 388, 560, 470, 0xd6ffff, 0.11)
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
        // HTML側の左上HUDへ集約するため、Phaser側の上帯HUD/下部統計HUDは表示しません。
        // updateScore/updateBattle/updateTimer から参照されるオブジェクトだけを非表示で作成します。
        this.scoreValueText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.rivalScoreText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.battleLeadText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.battleStateText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.battleGaugePlayer = this.scene.add.graphics().setVisible(false)
        this.battleGaugeRival = this.scene.add.graphics().setVisible(false)
        this.awardText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.comboText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.routeText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.routeDetailText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.timerText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.phaseText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.timerFill = this.scene.add.graphics().setVisible(false)
        this.footerText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
        this.multiplierText = this.scene.add.text(-1000, -1000, '', { fontFamily: UI_FONT, fontSize: '1px' }).setVisible(false)
    }

    createBoardBase(): void {
        const boardPanel = this.scene.add.graphics()
        const boardSize = this.latestSnapshot?.boardSize ?? GameConfig.BOARD_SIZE
        const boardPixelSize = boardSize * GameConfig.TILE_SIZE
        const panelPadding = 26
        this.drawRoundedPanel(
            boardPanel,
            GameConfig.BOARD_ORIGIN_X - panelPadding,
            GameConfig.BOARD_ORIGIN_Y - panelPadding,
            boardPixelSize + panelPadding * 2,
            boardPixelSize + panelPadding * 2,
            42,
            0x093242,
            0.03,
            0xffd274,
            0,
        )

        for (let row = 0; row < boardSize; row += 1) {
            for (let col = 0; col < boardSize; col += 1) {
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

    createBlankMarkers(count: number): Phaser.GameObjects.Container[] {
        const markers: Phaser.GameObjects.Container[] = []

        for (let index = 0; index < count; index += 1) {
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
            markers.push(container)
        }

        return markers
    }

    /**
     * createTileViews: tileCatalog 縺ｮ蜷・ち繧､繝ｫ縺ｫ蟇ｾ縺励※陦ｨ遉ｺ逕ｨ Container/Graphics/Image 繧堤函謌舌＠ tileViews 縺ｫ逋ｻ骭ｲ縺吶ｋ縲・     * - 蜷・さ繝ｳ繝・リ縺ｫ pointerdown/pointerup/pointerover/pointerout 縺ｮ繝上Φ繝峨Λ繧定ｨｭ螳壹＠縲√ち繝・・繝ｻ繝峨Λ繝・げ謖吝虚繧貞ｮ溯｣・☆繧九・     */
    createTileViews(snapshot: BoardSnapshot): void {
        const visibleTileIds = new Set(snapshot.tileIds.flat().filter((tileId) => tileId !== 0))

        for (const tile of snapshot.tileCatalog) {
            if (!visibleTileIds.has(tile.id)) {
                continue
            }

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
            const tileScale = this.getTextureScale(this.getTileTexture(tile), GameConfig.TILE_SIZE - 10)
            const slideScale = (GameConfig.TILE_SIZE - 8) / 256

            tileSprite.setScale(tileScale)
            tileSprite.setAngle(this.getTileAngle())
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

            // Press/drag/release handling: support tap and drag-to-slide on touch devices
            container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                // record start coordinate for drag detection
                // use worldX/worldY when available (camera transforms) and fall back to pointer.x/y
                const px = pointer.worldX ?? pointer.x
                const py = pointer.worldY ?? pointer.y
                tileView._pressStart = { x: px, y: py }
                this.pulseTileTap(tileView)

                if (this.isTileMovable(tileView.position)) {
                    this.showSlidePreview(tileView.position)
                }
            })

            container.on('pointerup', (pointer: Phaser.Input.Pointer) => {
                if (!this.interactionEnabled || this.tileSelectHandler === null) {
                    this.clearSlidePreview()
                    return
                }

                const start = tileView._pressStart
                const px = pointer.worldX ?? pointer.x
                const py = pointer.worldY ?? pointer.y
                const dx = start ? Math.abs(px - start.x) : 0
                const dy = start ? Math.abs(py - start.y) : 0
                const distance = dx + dy
                const DRAG_THRESHOLD = 8 // pixels; tune if needed

                if (distance <= DRAG_THRESHOLD) {
                    // Treat as tap
                    this.tileSelectHandler({ row: tileView.position.row, col: tileView.position.col })
                    this.clearSlidePreview()
                    return
                }

                // On drag, if tile is movable, perform slide. We call handler with the tile position
                if (this.isTileMovable(tileView.position)) {
                    this.tileSelectHandler({ row: tileView.position.row, col: tileView.position.col })
                }

                this.clearSlidePreview()
                tileView._pressStart = undefined
            })

            container.on('pointerover', () => {
                if (this.isTileMovable(tileView.position)) {
                    this.showSlidePreview(tileView.position)
                }
            })

            container.on('pointerout', () => {
                this.clearSlidePreview()
            })

            this.tileViews.set(tile.id, tileView)
        }
    }

    createRobotView(): RobotView {
        const container = this.scene.add.container(0, 0)
        const shadow = this.scene.add.ellipse(
            0,
            GameConfig.TILE_SIZE * 0.28,
            GameConfig.TILE_SIZE * 0.72,
            GameConfig.TILE_SIZE * 0.25,
            0x000000,
            0.18,
        )
        const sprite = this.scene.add.sprite(0, 0, 'robot-right-idle')
        sprite.setScale(GameConfig.ROBOT_SCALE)

        container.add([shadow, sprite])
        container.setDepth(ROBOT_DEPTH)
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
        const restartButton = this.scene.add.text(0, 125, '繧ゅ≧荳蠎ｦ', {
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
        panel.setDepth(RESULT_DEPTH)
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
        panel.setDepth(RESULT_DEPTH)
        panel.setVisible(false)

        return {
            panel,
            titleText,
            bodyText,
        }
    }

    createBoostButton(): BoostButtonView {
        // BOOST表示は削除。setBoostActive から参照されるため、非表示のplaceholderだけ作成します。
        const container = this.scene.add.container(-1000, -1000)
        const background = this.scene.add.graphics().setVisible(false)
        const label = this.scene.add.text(0, 0, '', {
            fontFamily: UI_FONT,
            fontSize: '1px',
            color: '#ffffff',
        }).setVisible(false)
        container.add([background, label])
        container.setVisible(false)

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
        container.setDepth(OVERLAY_DEPTH)

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
        container.setDepth(OVERLAY_DEPTH)
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
        gem.setScale(this.getTextureScale(gem.texture.key, GameConfig.TILE_SIZE * 0.48))

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

    setJewelValue(container: Phaser.GameObjects.Container, value: number): void {
        const gem = container.getAt(1) as Phaser.GameObjects.Image | undefined

        if (gem === undefined) {
            return
        }

        const textureKey = this.getJewelTextureForValue(value)
        gem.setTexture(textureKey)
        gem.setScale(this.getTextureScale(textureKey, GameConfig.TILE_SIZE * this.getJewelSizeRatio(value)))
    }

    getJewelTextureForValue(value: number): string {
        if (value >= 5) {
            return 'gem-purple-idle'
        }

        if (value >= 3) {
            return 'gem-blue-idle'
        }

        if (value >= 2) {
            return 'gem-cyan-idle'
        }

        return 'gem-idle'
    }

    getJewelSizeRatio(value: number): number {
        if (value >= 5) {
            return 0.56
        }

        if (value >= 3) {
            return 0.52
        }

        return 0.48
    }

    refreshTileStates(snapshot: BoardSnapshot): void {
        const movableKeys = new Set(snapshot.movablePositions.map((position) => `${position.row}-${position.col}`))
        const jewelTileIds = new Set(snapshot.jewelTileIds)
        const jewelValues = snapshot.jewelValues
        const connectedTileIds = new Set(snapshot.routePreview.connectedTileIds)
        const dangerTileIds = new Set(snapshot.routePreview.dangerTileIds)
        const nextKey = snapshot.routePreview.nextPosition === null
            ? ''
            : `${snapshot.routePreview.nextPosition.row}-${snapshot.routePreview.nextPosition.col}`
        const currentTileId = snapshot.tileIds[snapshot.robotPosition.row][snapshot.robotPosition.col]

        for (const tileView of this.tileViews.values()) {
            const key = `${tileView.position.row}-${tileView.position.col}`
            const isMovable = movableKeys.has(key)
            const isConnected = connectedTileIds.has(tileView.tile.id)
            const isDanger = dangerTileIds.has(tileView.tile.id)
            const isNext = key === nextKey
            const isCurrent = tileView.tile.id === currentTileId
            const hasJewel = jewelTileIds.has(tileView.tile.id)
            const jewelValue = jewelValues[tileView.tile.id] ?? 1
            this.drawTile(tileView, isMovable, isConnected, isDanger, isNext, isCurrent, hasJewel, jewelValue, snapshot.routePreview.riskLevel)
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
        jewelValue: number,
        riskLevel: RouteRiskLevel,
    ): void {
        const fillColor = isDanger
            ? 0x8b3443
            : isCurrent
                ? 0x125b6f
                : isMovable
                    ? 0x105a68
                    : 0x0f5567
        const strokeColor = isDanger ? 0xffc4ba : isNext ? 0xfff2c0 : isMovable ? 0x8fe5eb : 0x8de6f0
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
            isMovable ? 0.58 : 0.52,
            strokeColor,
            isCurrent ? 4 : isMovable ? 3 : 2,
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
        tileView.tileSprite.setAngle(this.getTileAngle())
        tileView.tileSprite.setAlpha(isDanger ? 0.88 : isConnected || isCurrent ? 1 : 0.94)
        tileView.tileSprite.setScale(
            this.getTextureScale(this.getTileTexture(tileView.tile), GameConfig.TILE_SIZE - 10)
                * (isConnected || isCurrent ? 1.03 : 1),
        )

        if (isDanger) {
            tileView.tileSprite.setTint(0xffcfca)
        } else {
            tileView.tileSprite.clearTint()
        }

        this.drawTilePath(tileView.pathGlow, tileView.tile, pathGlowColor, isConnected ? 22 : 8, isConnected ? 0.36 : 0.04)
        this.drawTilePath(tileView.pathBase, tileView.tile, pathColor, isConnected ? 10 : 8, isConnected || isCurrent ? 0.72 : 0.18)
        this.drawSpecialAura(tileView.specialAura, tileView.tile, isConnected || isCurrent)
        this.setJewelValue(tileView.jewel, jewelValue)
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
        this.routeImpact.clear()

        const points = [this.getCellCenter(snapshot.robotPosition)]

        for (const segment of snapshot.routePreview.segments) {
            points.push(this.getCellCenter(segment.position))
        }

        if (points.length <= 1) {
            this.drawBlockedMarker(snapshot)
            return
        }

        const colors = this.getRouteColors(snapshot.routePreview.riskLevel)

        // 太い帯で「今ロボットが進む道」を見せる。判断力より反応しやすさを優先。
        this.boardRouteGlow.lineStyle(34, colors.glow, 0.30)
        this.boardRouteLine.lineStyle(12, colors.core, 1)

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

        for (const [index, point] of points.entries()) {
            const isNearFuture = index > 0 && index <= 4
            this.boardRouteGlow.fillStyle(colors.glow, isNearFuture ? 0.32 : 0.16)
            this.boardRouteGlow.fillCircle(point.x, point.y, isNearFuture ? 16 : 10)
            this.boardRouteLine.fillStyle(colors.core, 0.98)
            this.boardRouteLine.fillCircle(point.x, point.y, isNearFuture ? 7 : 4)

            if (isNearFuture) {
                this.routeImpact.lineStyle(2, 0x072a36, 0.88)
                this.routeImpact.fillStyle(0xfff2c0, 0.92)
                this.routeImpact.fillCircle(point.x + 16, point.y - 16, 11)
                this.routeImpact.strokeCircle(point.x + 16, point.y - 16, 11)
            }
        }

        const routeJewelSegment = snapshot.routePreview.segments.find((segment) => snapshot.jewelTileIds.includes(segment.tileId))

        if (routeJewelSegment !== undefined) {
            const jewelCenter = this.getCellCenter(routeJewelSegment.position)
            this.routeImpact.lineStyle(4, 0xffe281, 0.95)
            this.routeImpact.fillStyle(0xffe281, 0.18)
            this.routeImpact.fillCircle(jewelCenter.x, jewelCenter.y, 30)
            this.routeImpact.strokeCircle(jewelCenter.x, jewelCenter.y, 30)
            this.routeImpact.lineStyle(2, 0xffffff, 0.72)
            this.routeImpact.strokeCircle(jewelCenter.x, jewelCenter.y, 38)
        }

        this.drawBlockedMarker(snapshot)
    }

    drawBlockedMarker(snapshot: BoardSnapshot): void {
        if (snapshot.routePreview.blockedPosition === null) {
            return
        }

        const center = this.getCellCenter(snapshot.routePreview.blockedPosition)
        this.routeImpact.lineStyle(7, 0xff6f5f, 0.95)
        this.routeImpact.beginPath()
        this.routeImpact.moveTo(center.x - 18, center.y - 18)
        this.routeImpact.lineTo(center.x + 18, center.y + 18)
        this.routeImpact.moveTo(center.x + 18, center.y - 18)
        this.routeImpact.lineTo(center.x - 18, center.y + 18)
        this.routeImpact.strokePath()
        this.routeImpact.fillStyle(0xffd5cd, 0.2)
        this.routeImpact.fillCircle(center.x, center.y, 28)
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

        const boardSize = this.latestSnapshot?.boardSize ?? GameConfig.BOARD_SIZE
        const boardPixelSize = boardSize * GameConfig.TILE_SIZE
        this.drawRoundedPanel(
            this.boardThreatFrame,
            GameConfig.BOARD_ORIGIN_X - 34,
            GameConfig.BOARD_ORIGIN_Y - 34,
            boardPixelSize + 68,
            boardPixelSize + 68,
            46,
            strokeColor,
            0,
            strokeColor,
            2,
        )
        this.boardThreatFrame.alpha = 0.24
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
                    ? 'SAFE LOOP'
                    : `JEWEL ${preview.nextJewelDistance} STEP`,
            )
            return
        }

        if (preview.riskLevel === 'critical') {
            this.routeText.setText('FIX NOW')
            this.routeText.setColor('#ffd7cf')
            this.routeDetailText.setText('NEXT STEP BLOCKED')
            return
        }

        if (preview.riskLevel === 'danger') {
            this.routeText.setText(`DANGER ${preview.safeStepCount}`)
            this.routeText.setColor('#ffd5cd')
            this.routeDetailText.setText(
                preview.nextJewelDistance === null
                    ? 'ROUTE TOO SHORT'
                    : `JEWEL ${preview.nextJewelDistance} STEP`,
            )
            return
        }

        if (preview.riskLevel === 'warning') {
            this.routeText.setText(`WATCH ${preview.safeStepCount}`)
            this.routeText.setColor('#fff0cb')
            this.routeDetailText.setText(
                preview.nextJewelDistance === null
                    ? 'MAKE LONGER PATH'
                    : `JEWEL ${preview.nextJewelDistance} STEP`,
            )
            return
        }

        this.routeText.setText(`SAFE ${preview.safeStepCount}`)
        this.routeText.setColor('#dcffff')
        this.routeDetailText.setText(
            preview.nextJewelDistance === null
                ? 'FIND A JEWEL PATH'
                : `JEWEL ${preview.nextJewelDistance} STEP`,
        )
    }


    refreshWarningBanner(snapshot: BoardSnapshot): void {
        const preview = snapshot.routePreview
        let message = ''
        let fillColor = 0x8fe5eb
        const textColor = '#072a36'

        if (preview.riskLevel === 'critical') {
            message = 'ROUTE BREAK'
            fillColor = 0xffb4a8
        } else if (preview.riskLevel === 'danger') {
            message = 'LAST CHANCE'
            fillColor = 0xffc08b
        } else if (this.latestBattleSnapshot !== null && this.latestTimeLeft <= 10 && Math.abs(this.latestBattleSnapshot.scoreDiff) <= 160) {
            message = 'TARGET CLOSE'
            fillColor = 0xffe1a2
        } else if (this.latestBattleSnapshot !== null && this.latestTimeLeft <= 12 && this.latestBattleSnapshot.state === 'behind') {
            message = 'FINAL PUSH'
            fillColor = 0xffd289
        } else if (this.latestBattleSnapshot !== null && this.latestTimeLeft <= 12 && this.latestBattleSnapshot.state === 'ahead') {
            message = 'CLEAR'
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

    syncBlankMarkers(positions: Position[]): void {
        for (let index = 0; index < this.blankMarkers.length; index += 1) {
            const marker = this.blankMarkers[index]
            const position = positions[index]

            if (position === undefined) {
                marker.setVisible(false)
                continue
            }

            const center = this.getCellCenter(position)
            marker.x = center.x
            marker.y = center.y
            marker.setVisible(true)
        }
    }

    syncRobot(position: Position, direction: DirectionValue): void {
        const center = this.getCellCenter(position)
        this.robotView.container.x = center.x
        this.robotView.container.y = center.y
        this.robotView.container.setDepth(ROBOT_DEPTH)
        this.robotView.container.scale = 1
        this.robotView.sprite.stop()
        this.robotView.sprite.setTexture(this.getRobotIdleTexture(direction))
        this.robotView.sprite.setScale(GameConfig.ROBOT_SCALE)
        this.robotView.shadow.setScale(1, 1)
        this.robotView.shadow.setAlpha(0.18)
        this.applyRobotDirection(direction)
    }

    applyRobotDirection(direction: DirectionValue): void {
        this.robotView.container.angle = 0
        this.robotView.sprite.setTexture(this.getRobotIdleTexture(direction))
        this.robotView.sprite.setScale(GameConfig.ROBOT_SCALE)
    }

    getRobotIdleTexture(direction: DirectionValue): string {
        if (direction === Direction.Up) {
            return 'robot-back-idle'
        }

        if (direction === Direction.Right) {
            return 'robot-right-idle'
        }

        if (direction === Direction.Down) {
            return 'robot-front-idle'
        }

        return 'robot-left-idle'
    }

    getRobotWalkAnimation(direction: DirectionValue): string {
        if (direction === Direction.Up) {
            return 'robot-walk-back'
        }

        if (direction === Direction.Right) {
            return 'robot-walk-right'
        }

        if (direction === Direction.Down) {
            return 'robot-walk-front'
        }

        return 'robot-walk-left'
    }

    getTileTexture(tile: PathTileSnapshot): string {
        if (tile.kind === 'straight') {
            return tile.rotation % 2 === 0
                ? 'tile-straight-vertical'
                : 'tile-straight-horizontal'
        }

        if (tile.kind === 'cross') {
            return 'tile-cross'
        }

        if (tile.kind === 'tee' || tile.kind === 'branch') {
            if (tile.rotation === 0) {
                return 'tile-tee-up'
            }

            if (tile.rotation === 1) {
                return 'tile-tee-right'
            }

            if (tile.rotation === 2) {
                return 'tile-tee-down'
            }

            return 'tile-tee-left'
        }

        if (tile.rotation === 0) {
            return 'tile-corner-up-right'
        }

        if (tile.rotation === 1) {
            return 'tile-corner-right-down'
        }

        if (tile.rotation === 2) {
            return 'tile-corner-down-left'
        }

        return 'tile-corner-left-up'
    }

    getTileAngle(): number {
        return 0
    }

    getTextureScale(textureKey: string, targetSize: number): number {
        const texture = this.scene.textures.get(textureKey)
        const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement
        const width = source.width || targetSize
        const height = source.height || targetSize
        return targetSize / Math.max(width, height)
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

    /**
     * getCellCenter: 謖・ｮ壹そ繝ｫ縺ｮ逕ｻ髱｢荳贋ｸｭ蠢・ｺｧ讓吶ｒ霑斐☆縲・     * - GameConfig.BOARD_ORIGIN_X/Y 縺ｨ TILE_SIZE 繧堤畑縺・※險育ｮ励☆繧九・     * - 繝昴う繝ｳ繧ｿ縺ｨ隕九◆逶ｮ縺後★繧後ｋ蝣ｴ蜷医・ canvas 縺ｮ繧ｹ繧ｱ繝ｼ繝ｪ繝ｳ繧ｰ繧・CSS 繧ｵ繧､繧ｺ繧堤｢ｺ隱阪☆繧九％縺ｨ縲・     */
    getCellCenter(position: Position): { x: number, y: number } {
        // NOTE: Uses GameConfig origin and tile size. If the canvas is scaled (Phaser.Scale.FIT)
        // or the visible board differs from GameConfig, pointer coordinates may not align with
        // visual tiles. When debugging mouse/touch mismatch, verify these values and the
        // canvas scaling / CSS size used by Phaser.
        return {
            x: GameConfig.BOARD_ORIGIN_X + position.col * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2,
            y: GameConfig.BOARD_ORIGIN_Y + position.row * GameConfig.TILE_SIZE + GameConfig.TILE_SIZE / 2,
        }
    }

    /**
     * getSlidePathPositions: 驕ｸ謚槭・繧ｹ縺九ｉ遨ｺ逋ｽ縺ｾ縺ｧ縺ｮ繝代せ繧定ｿ斐☆・育ｩｺ逋ｽ縺ｯ蜷ｫ繧√↑縺・ｼ峨・     * - 謌ｻ繧雁､縺ｯ source -> ... -> 遨ｺ逋ｽ逶ｴ蜑・縺ｮ鬆・ｺ上・     * - BoardManager 縺ｨ蜷後§莉墓ｧ倥〒鬆・ｺ上ｒ菫昴▽縺薙→縺碁㍾隕・ｼ・I 縺・movedTiles 繧呈悄蠕・＠縺ｦ縺・ｋ縺溘ａ・峨・     */
    getSlidePathPositions(position: Position): Position[] | null {
        // Returns positions from the selected tile toward the blank (excluding the blank).
        // Order: source (selected) -> ... -> tile adjacent to blank
        // BoardManager.moveTile uses this ordering to build movedTiles[]. If this returns null,
        // the selected tile is not aligned with the blank and cannot slide.
        const blankPositions = this.latestSnapshot.blankPositions ?? [this.latestSnapshot.blankPosition]
        let bestPath: Position[] | null = null
        let bestDistance = Number.POSITIVE_INFINITY

        for (const blank of blankPositions) {
            if (position.row !== blank.row && position.col !== blank.col) {
                continue
            }

            const direction = position.row === blank.row
                ? position.col < blank.col
                    ? 1
                    : -1
                : position.row < blank.row
                    ? 1
                    : -1

            const path: Position[] = []

            if (position.row === blank.row) {
                for (let col = position.col; col !== blank.col; col += direction) {
                    path.push({ row: position.row, col })
                }
            } else {
                for (let row = position.row; row !== blank.row; row += direction) {
                    path.push({ row, col: position.col })
                }
            }

            if (path.length === 0) {
                continue
            }

            if (path.length < bestDistance) {
                bestDistance = path.length
                bestPath = path
            }
        }

        return bestPath
    }

    /**
     * showSlidePreview: 驕ｸ謚槭・繧ｹ縺九ｉ遨ｺ逋ｽ縺ｾ縺ｧ縺ｮ繝代せ繧偵ワ繧､繝ｩ繧､繝医＠縺ｦ隕冶ｦ夂噪縺ｫ遉ｺ縺吶・     * - 繧ｿ繧､繝ｫ縺ｮ tint 繧・slideFx 繧貞茜逕ｨ縺励※繝励Ξ繝薙Η繝ｼ陦ｨ遉ｺ縺吶ｋ縲・     * - 萓句､悶・螳牙・縺ｫ辟｡隕悶＠縺ｦ謠冗判縺悟｣翫ｌ縺ｪ縺・ｈ縺・↓縺励※縺・ｋ縲・     */
    showSlidePreview(position: Position): void {
        this.clearSlidePreview()
        const path = this.getSlidePathPositions(position)

        if (path === null || path.length === 0) {
            return
        }

        for (const p of path) {
            const tileId = this.latestSnapshot.tileIds[p.row][p.col]
            const tv = this.tileViews.get(tileId)

            if (tv === undefined) {
                continue
            }

            try {
                tv.tileSprite.setTint(0x9ffbff)
                tv.slideFx.setVisible(true)
            } catch {
                // safe guard if sprite not ready
            }
        }
    }

    /**
     * clearSlidePreview: 縺吶∋縺ｦ縺ｮ繧ｿ繧､繝ｫ縺ｮ繝励Ξ繝薙Η繝ｼ陦ｨ遉ｺ・・int/slideFx・峨ｒ繧ｯ繝ｪ繧｢縺吶ｋ縲・     */
    clearSlidePreview(): void {
        for (const tv of this.tileViews.values()) {
            try {
                tv.tileSprite.clearTint()
                tv.slideFx.setVisible(false)
            } catch {
                // ignore
            }
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

    /**
     * isTileMovable: 譛譁ｰ snapshot 縺ｮ movablePositions 繧貞盾辣ｧ縺励※菴咲ｽｮ縺檎ｧｻ蜍募庄閭ｽ縺句愛螳壹☆繧九・     */
    isTileMovable(position: Position): boolean {
        return this.latestSnapshot.movablePositions.some(
            (movablePosition) => movablePosition.row === position.row && movablePosition.col === position.col,
        )
    }

    /**
     * spawnTileGhost: 繧ｹ繝ｩ繧､繝画凾縺ｫ菴ｿ逕ｨ縺吶ｋ繧ｴ繝ｼ繧ｹ繝育判蜒擾ｼ医ヵ繧ｧ繝ｼ繝峨☆繧九さ繝斐・・峨ｒ逕滓・縺励※霑斐☆縲・     * - 蜈・・ tileView 縺ｮ菴咲ｽｮ/繝・け繧ｹ繝√Ε/蝗櫁ｻ｢繧偵さ繝斐・縺吶ｋ縲・     */
    spawnTileGhost(tileView: TileView): Phaser.GameObjects.Image {
        const ghost = this.scene.add.image(
            tileView.container.x,
            tileView.container.y,
            this.getTileTexture(tileView.tile),
        )
        const tileBaseScale = this.getTextureScale(this.getTileTexture(tileView.tile), GameConfig.TILE_SIZE - 10)
            * (this.isTileMovable(tileView.position) ? 1.03 : 1)

        ghost.setAngle(this.getTileAngle())
        ghost.setScale(tileBaseScale)
        ghost.setAlpha(0.32)
        ghost.setTint(0xdffcff)
        return ghost
    }

    pulseBlankMarkers(): void {
        for (const marker of this.blankMarkers) {
            this.scene.tweens.add({
                targets: marker,
                scaleX: 1.14,
                scaleY: 1.14,
                duration: 90,
                yoyo: true,
                ease: 'Back.easeOut',
            })
        }
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

    emitSlideTrail(from: Position, to: Position, color: number): void {
        const start = this.getCellCenter(from)
        const end = this.getCellCenter(to)
        const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y)
        if (distance <= 0) {
            return
        }

        const trail = this.scene.add.rectangle(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2,
            distance + 12,
            8,
            color,
            0.28,
        )
        trail.setRotation(Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y))
        trail.setBlendMode(Phaser.BlendModes.ADD)
        this.scene.tweens.add({
            targets: trail,
            alpha: 0,
            scaleX: 1.08,
            scaleY: 0.45,
            duration: GameConfig.SLIDE_TWEEN_MS + 100,
            ease: 'Sine.easeOut',
            onComplete: () => {
                trail.destroy()
            },
        })
    }

    emitJewelBurst(x: number, y: number, value: number = 1): void {
        const pickup = this.scene.add.sprite(x, y, 'gem-pickup-0')
        pickup.setScale(value >= 5 ? 0.68 : value >= 3 ? 0.56 : 0.46)
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

        const valueColor = value >= 5
            ? '#f2a7ff'
            : value >= 3
                ? '#9ed8ff'
                : value >= 2
                    ? '#a4fff5'
                    : '#fff0a8'
        const valueText = this.scene.add.text(x, y - 12, `+${value}`, {
            fontFamily: UI_FONT,
            fontSize: value >= 5 ? '48px' : value >= 3 ? '40px' : '34px',
            color: valueColor,
            fontStyle: 'bold',
            stroke: '#09232b',
            strokeThickness: 7,
        }).setOrigin(0.5).setDepth(OVERLAY_DEPTH)

        this.scene.tweens.add({
            targets: valueText,
            y: y - 76,
            scaleX: value >= 5 ? 1.24 : 1.08,
            scaleY: value >= 5 ? 1.24 : 1.08,
            alpha: 0,
            duration: value >= 5 ? 980 : 720,
            ease: 'Back.easeOut',
            onComplete: () => {
                valueText.destroy()
            },
        })
    }

    emitJewelExpire(position: Position, value: number): void {
        const center = this.getCellCenter(position)
        const textureKey = this.getJewelTextureForValue(value)
        const ghost = this.scene.add.image(center.x, center.y, textureKey)
        ghost.setScale(this.getTextureScale(textureKey, GameConfig.TILE_SIZE * this.getJewelSizeRatio(value)))
        ghost.setTint(0xb8f7ff)
        ghost.setAlpha(0.78)
        ghost.setDepth(OVERLAY_DEPTH)

        this.scene.tweens.add({
            targets: ghost,
            scaleX: ghost.scaleX * 0.2,
            scaleY: ghost.scaleY * 0.2,
            alpha: 0,
            angle: 28,
            duration: 360,
            ease: 'Back.easeIn',
            onComplete: () => {
                ghost.destroy()
            },
        })

        const ring = this.scene.add.circle(center.x, center.y, GameConfig.TILE_SIZE * 0.24, 0x9ffbff, 0.2)
        ring.setDepth(OVERLAY_DEPTH)
        this.scene.tweens.add({
            targets: ring,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 420,
            ease: 'Sine.easeOut',
            onComplete: () => {
                ring.destroy()
            },
        })

        for (let index = 0; index < 8; index += 1) {
            const spark = this.scene.add.rectangle(center.x, center.y, 8, 3, 0x9ffbff, 0.82)
            spark.setDepth(OVERLAY_DEPTH)
            spark.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2)

            this.scene.tweens.add({
                targets: spark,
                x: center.x + Phaser.Math.Between(-34, 34),
                y: center.y + Phaser.Math.Between(-34, 34),
                alpha: 0,
                scaleX: 0.15,
                scaleY: 0.15,
                duration: Phaser.Math.Between(260, 460),
                ease: 'Sine.easeOut',
                onComplete: () => {
                    spark.destroy()
                },
            })
        }
    }
}
