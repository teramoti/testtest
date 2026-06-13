import { useEffect, useRef, useState } from 'react'
import './GameScreen.css'

import { startGame, destroyGame } from '../../../game/GameManager'
import type { GameResult, GameSettings } from '../../App'
import { getGameTimeLimitSeconds } from '../../data/gameRules'
import gameBgm from '../../../../assets/bkue_ghost/audio/game_bgm.mp3'

type Props = {
  settings: GameSettings
  onFinish: (result: GameResult | { scores?: number[]; results?: unknown[] }) => void
}

type GameHudState = {
  currentPlayerIndex: number
  playerCount: number
  scores: Array<number | null>
  currentScore: number | null
  timeLeft: number
  ruleName?: string
}

export default function GameScreen({ settings, onFinish }: Props) {
  const difficulty = settings.difficulty ?? 'normal'
  const [hud, setHud] = useState<GameHudState>({
    currentPlayerIndex: 0,
    playerCount: settings.playerCount,
    scores: Array(settings.playerCount).fill(null),
    currentScore: null,
    timeLeft: getGameTimeLimitSeconds(difficulty),
    ruleName: 'Robot Slide',
  })
  const ref = useRef<HTMLDivElement | null>(null)
  const hudTargetRef = useRef<EventTarget>(new EventTarget())
  const bgmRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const hudTarget = hudTargetRef.current
    const audio = new Audio(gameBgm)
    audio.loop = true
    bgmRef.current = audio

    const playBgm = () => {
      void audio.play().catch(() => {
        // ブラウザの自動再生制限時は、次のユーザー操作で再試行します。
      })
    }

    const handleHudUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<GameHudState>
      setHud((current) => ({
        ...current,
        ...customEvent.detail,
      }))
    }

    playBgm()
    window.addEventListener('pointerdown', playBgm, { once: true })
    window.addEventListener('keydown', playBgm, { once: true })
    hudTarget.addEventListener('game-hud-update', handleHudUpdate)

    if (ref.current) {
      startGame(
        ref.current,
        {
          ...settings,
          difficulty,
          hudTarget,
        },
        onFinish
      )
    }

    return () => {
      destroyGame()
      hudTarget.removeEventListener('game-hud-update', handleHudUpdate)
      window.removeEventListener('pointerdown', playBgm)
      window.removeEventListener('keydown', playBgm)
      audio.pause()
      audio.currentTime = 0
      bgmRef.current = null
    }
  }, [difficulty, onFinish, settings])

  return (
    <div className="gameScreenShell">
      <div className="gameScreenPanel">
        <div className="gameRuleCard">
          <span className="gameRuleLabel">Rule</span>
          <strong className="gameRuleName">
            {hud.ruleName ?? 'Robot Slide'}
          </strong>
        </div>

        <aside className="gameHtmlHud">
          <div className="gameHudCard gameHudPlayerCard">
            <p className="gameHudLabel">Player</p>
            <p className="gameHudMain">
              {hud.currentPlayerIndex + 1} / {hud.playerCount}
            </p>
          </div>

          <div className="gameHudCard">
            <p className="gameHudLabel">Time</p>
            <p className="gameHudTimer">
              {hud.timeLeft}s
            </p>
          </div>

          <div className="gameHudCard">
            <p className="gameHudLabel">Score</p>
            <p className="gameHudScore">
              {hud.currentScore ?? 0}
            </p>
          </div>

          <div className="gameHudCard">
            <p className="gameHudLabel">All Scores</p>
            <ul className="gameHudScoreList">
              {hud.scores.map((score, index) => (
                <li key={index}>
                  <span>P{index + 1}</span>
                  <strong>{score ?? '-'}</strong>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div
          ref={ref}
          className="gameCanvasHost"
        />
      </div>
    </div>
  )
}
