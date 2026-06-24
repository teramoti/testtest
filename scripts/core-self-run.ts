import { BoardManager } from '../src/game/robotSlide/systems/BoardManager.ts'
import { ScoreManager } from '../src/game/robotSlide/systems/ScoreManager.ts'
import { GameConfig } from '../src/game/robotSlide/utils/GameConfig.ts'

// Core simulation: board, route, robot movement, jewel collection, crash/reset, STOP-like pause windows.
// This does not render Phaser/React. It verifies the game rules can run for a full 60s session without throwing.
function applyNormalTuning() {
  GameConfig.SESSION_SECONDS = 60
  GameConfig.BOARD_SIZE = 6
  GameConfig.BLANK_COUNT = 4
  GameConfig.TILE_SIZE = 90
  GameConfig.ROBOT_STEP_MS = 2000
  GameConfig.ROBOT_STEP_ACCELERATION_MS = 10
  GameConfig.MIN_ROBOT_STEP_MS = 1350
  GameConfig.SPEED_SCORE_STEP = 10
  GameConfig.WARNING_ROUTE_STEPS = 10
  GameConfig.DANGER_ROUTE_STEPS = 5
  GameConfig.JEWEL_EXPIRE_SECONDS = 999
  GameConfig.JEWEL_EXPIRE_COUNT = 0
}

function pickMove(board: BoardManager) {
  const snapshot = board.getSnapshot()
  const beforeSafe = snapshot.routePreview.safeStepCount
  let best = null as null | { row: number, col: number, gain: number }

  for (const pos of snapshot.movablePositions) {
    const distance = Math.abs(pos.row - snapshot.robotPosition.row) + Math.abs(pos.col - snapshot.robotPosition.col)
    const onRoute = snapshot.routePreview.segments.some((segment) => segment.position.row === pos.row && segment.position.col === pos.col)
    const gain = (onRoute ? 4 : 0) + Math.max(0, 6 - distance) + beforeSafe
    if (best === null || gain > best.gain) best = { ...pos, gain }
  }

  return best
}

function runOneSession() {
  applyNormalTuning()
  const board = new BoardManager(GameConfig.BOARD_SIZE)
  const score = new ScoreManager()
  board.resetBoard(0)
  board.ensureRouteJewels(5, 2)
  score.reset()

  let timeMs = 0
  let timeLeft = GameConfig.SESSION_SECONDS
  let robotDelay = GameConfig.ROBOT_STEP_MS
  let nextRobotMs = robotDelay
  let crashes = 0
  let stopUses = 0
  let hintUses = 0
  let missionClears = 0
  let luckyAssists = 8
  let luckyAssistUses = 0
  let feverTriggered = false

  while (timeLeft > 0 && timeMs <= 70000) {
    const snapshot = board.getSnapshot()

    // Simulate player slide roughly every 450ms when danger/low safe route, otherwise every 850ms.
    if (timeMs % (snapshot.routePreview.safeStepCount <= 4 ? 450 : 850) === 0) {
      const move = pickMove(board)
      if (move !== null) {
        const before = board.getSnapshot()
        const result = board.moveTile(move)
        if (result.moved) score.registerSlide(before.routePreview, board.getSnapshot().routePreview, result.carriedRobot, result.movedTiles.length)
      }
    }

    // Simulate HINT use when the route is short: it picks the same best assist move the real game exposes.
    if (snapshot.routePreview.safeStepCount <= 5 && hintUses < 3) {
      const assist = board.getBestAssistMove()
      if (assist !== null) {
        hintUses += 1
        const before = board.getSnapshot()
        const result = board.moveTile(assist)
        if (result.moved) score.registerSlide(before.routePreview, board.getSnapshot().routePreview, result.carriedRobot, result.movedTiles.length)
      }
    }

    // Simulate STOP use when critical/danger once early and once after fever/mission recharge.
    const risk = board.getSnapshot().routePreview.riskLevel
    if ((risk === 'critical' || risk === 'danger') && stopUses < 2) {
      stopUses += 1
      nextRobotMs += 2200
    }

    if (!feverTriggered && timeLeft <= 10) {
      feverTriggered = true
      board.upgradeRouteJewels(8, 5)
      board.ensureRouteJewels(8, 5)
      score.registerBonus('FINAL FEVER', 3, '+3 / POWER GEMS')
    }

    if (timeMs >= nextRobotMs) {
      const step = board.stepRobot()
      if (!step.moved) {
        const assist = luckyAssists > 0 ? board.getBestAssistMove() : null
        if (assist !== null) {
          luckyAssists -= 1
          luckyAssistUses += 1
          const before = board.getSnapshot()
          const result = board.moveTile(assist)
          if (result.moved) score.registerSlide(before.routePreview, board.getSnapshot().routePreview, result.carriedRobot, result.movedTiles.length)
          board.ensureRouteJewels(2, 2)
          score.registerBonus('LUCKY ASSIST', 2, 'CRASH AVOIDED')
          nextRobotMs += robotDelay
          continue
        }

        crashes += 1
        score.registerCrash()
        board.resetBoard(0)
        board.ensureRouteJewels(4, 2)
        nextRobotMs += 1000
      } else {
        const after = board.getSnapshot()
        const stepSnapshot = score.registerRobotStep(after.routePreview, step.triggeredCurrent)
        if (stepSnapshot.travelCount > 0 && stepSnapshot.travelCount % 3 === 0) {
          board.ensureRouteJewels(4, 3)
          score.registerBonus('ROUTE CHAIN', 3, '+3 / ROUTE GEMS')
        }
        if (step.collectedJewel) {
          const snap = score.registerJewelCollect(after.routePreview, step.collectedJewelValue)
          board.ensureRouteJewels(3, 2)
          if (step.collectedJewelValue >= 5) board.upgradeRouteJewels(3, 5)
          if (snap.jewelCount > 0 && snap.jewelCount % 3 === 0) {
            missionClears += 1
            score.registerBonus('MISSION CLEAR', 5, '+5 / ROUTE GEMS')
            board.ensureRouteJewels(3, 3)
          }
        }
      }
      robotDelay = Math.max(GameConfig.MIN_ROBOT_STEP_MS, GameConfig.ROBOT_STEP_MS - score.getSnapshot().speedLevel * GameConfig.ROBOT_STEP_ACCELERATION_MS)
      nextRobotMs += robotDelay
    }

    timeMs += 50
    timeLeft = Math.max(0, GameConfig.SESSION_SECONDS - Math.floor(timeMs / 1000))
  }

  const final = score.getSnapshot()
  return {
    score: final.score,
    jewels: final.jewelCount,
    crashes,
    travel: final.travelCount,
    missionClears,
    luckyAssistUses,
    stopUses,
    hintUses,
    feverTriggered,
    timeMs,
  }
}

const runs = Array.from({ length: 8 }, () => runOneSession())
const failed = runs.some((run) => run.timeMs < 60000 || !run.feverTriggered)
console.log(JSON.stringify({ ok: !failed, runs }, null, 2))
if (failed) process.exit(1)
