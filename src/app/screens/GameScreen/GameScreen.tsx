import { useEffect, useRef, useState } from 'react'
import './GameScreen.css'

import { startGame, destroyGame } from '../../../game/GameManager'
import type { GameResult, GameSettings } from '../../App'
import gameBgm from '../../../../assets/bkue_ghost/audio/game_bgm.mp3'
import scoreDigit0Image from '../../../../assets/Image/score/digit_0.png'
import scoreDigit1Image from '../../../../assets/Image/score/digit_1.png'
import scoreDigit2Image from '../../../../assets/Image/score/digit_2.png'
import scoreDigit3Image from '../../../../assets/Image/score/digit_3.png'
import scoreDigit4Image from '../../../../assets/Image/score/digit_4.png'
import scoreDigit5Image from '../../../../assets/Image/score/digit_5.png'
import scoreDigit6Image from '../../../../assets/Image/score/digit_6.png'
import scoreDigit7Image from '../../../../assets/Image/score/digit_7.png'
import scoreDigit8Image from '../../../../assets/Image/score/digit_8.png'
import scoreDigit9Image from '../../../../assets/Image/score/digit_9.png'
import scoreDigitColonImage from '../../../../assets/Image/score/digit_colon.png'
import timeDigit0Image from '../../../../assets/Image/time/digit_0.png'
import timeDigit1Image from '../../../../assets/Image/time/digit_1.png'
import timeDigit2Image from '../../../../assets/Image/time/digit_2.png'
import timeDigit3Image from '../../../../assets/Image/time/digit_3.png'
import timeDigit4Image from '../../../../assets/Image/time/digit_4.png'
import timeDigit5Image from '../../../../assets/Image/time/digit_5.png'
import timeDigit6Image from '../../../../assets/Image/time/digit_6.png'
import timeDigit7Image from '../../../../assets/Image/time/digit_7.png'
import timeDigit8Image from '../../../../assets/Image/time/digit_8.png'
import timeDigit9Image from '../../../../assets/Image/time/digit_9.png'
import timeDigitColonImage from '../../../../assets/Image/time/digit_colon.png'

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
  jewelCount?: number
  missCount?: number
  chainCount?: number
  efficiency?: number
  lastEventLabel?: string
  lastAward?: number
  lastAwardDetail?: string
  missionLabel?: string
  missionCount?: number
  missionTarget?: number
  missionTimeLeft?: number
  missionKind?: 'jewel' | 'route' | 'streak'
  feverActive?: boolean
}

const scoreDigitImages: Record<string, string> = {
  '0': scoreDigit0Image,
  '1': scoreDigit1Image,
  '2': scoreDigit2Image,
  '3': scoreDigit3Image,
  '4': scoreDigit4Image,
  '5': scoreDigit5Image,
  '6': scoreDigit6Image,
  '7': scoreDigit7Image,
  '8': scoreDigit8Image,
  '9': scoreDigit9Image,
  ':': scoreDigitColonImage,
}

const timeDigitImages: Record<string, string> = {
  '0': timeDigit0Image,
  '1': timeDigit1Image,
  '2': timeDigit2Image,
  '3': timeDigit3Image,
  '4': timeDigit4Image,
  '5': timeDigit5Image,
  '6': timeDigit6Image,
  '7': timeDigit7Image,
  '8': timeDigit8Image,
  '9': timeDigit9Image,
  ':': timeDigitColonImage,
}


function formatScore(value: number | null) {
  return Math.max(0, Math.floor(value ?? 0)).toString()
}

function DigitSpriteText({
  value,
  digitImages,
  className = '',
}: {
  value: string
  digitImages: Record<string, string>
  className?: string
}) {
  return (
    <span className={`digitSpriteText ${className}`} aria-label={value}>
      {value.split('').map((char, index) => {
        const src = digitImages[char]
        if (!src) {
          return <span key={`${char}-${index}`} className="digitFallback">{char}</span>
        }

        return (
          <img
            key={`${char}-${index}`}
            src={src}
            alt=""
            className={char === ':' ? 'digitSprite digitSpriteColon' : 'digitSprite'}
            draggable={false}
          />
        )
      })}
    </span>
  )
}

export default function GameScreen({ settings, onFinish }: Props) {
  const difficulty = settings.difficulty ?? 'normal'
  const [hud, setHud] = useState<GameHudState>({
    currentPlayerIndex: 0,
    playerCount: settings.playerCount,
    scores: Array(settings.playerCount).fill(null),
    currentScore: null,
    timeLeft: 60,
    ruleName: 'Wind-Up Route Rush',
    jewelCount: 0,
    missCount: 0,
    chainCount: 0,
    efficiency: 100,
    lastEventLabel: 'READY',
    lastAward: 0,
    lastAwardDetail: '',
    missionLabel: 'GET 3 JEWELS',
    missionCount: 0,
    missionTarget: 3,
    missionTimeLeft: 15,
    missionKind: 'jewel',
    feverActive: false,
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
        <aside className="gamePrimaryHud" aria-label="Game status">
          <div className="hudHeaderRow">
            <span>PLAYER {hud.currentPlayerIndex + 1}/{hud.playerCount}</span>
            <strong>{difficulty.toUpperCase()}</strong>
          </div>

          <div className="hudMainRow">
            <span className="compactHudLabel">TIME</span>
            <DigitSpriteText
              value={`${Math.max(0, Math.floor(hud.timeLeft ?? 0)).toString().padStart(2, '0')}`}
              digitImages={timeDigitImages}
              className="compactHudDigits compactHudTimeDigits"
            />
          </div>

          <div className="hudMainRow">
            <span className="compactHudLabel">SCORE</span>
            <DigitSpriteText
              value={formatScore(hud.currentScore)}
              digitImages={scoreDigitImages}
              className="compactHudDigits compactHudScoreDigits"
            />
          </div>

          <div className="hudMetricGrid hudMetricGridCompact">
            <div>
              <span>JEWEL</span>
              <strong>{hud.jewelCount ?? 0}</strong>
            </div>
            <div>
              <span>MISS</span>
              <strong>{hud.missCount ?? 0}</strong>
            </div>
            <div>
              <span>CHAIN</span>
              <strong>{hud.chainCount ?? 0}</strong>
            </div>
          </div>
        </aside>

          <div className={`missionCard ${hud.feverActive ? 'missionCardFever' : ''}`}>
            <span>{hud.feverActive ? 'FINAL FEVER' : hud.missionLabel ?? 'MISSION'}</span>
            <strong>
              {hud.missionCount ?? 0}/{hud.missionTarget ?? 3}
            </strong>
            <small>{Math.max(0, Math.ceil(hud.missionTimeLeft ?? 0))}s</small>
          </div>


        <div className="guideRibbon">
          <strong>SLIDE PATH</strong>
          <span>光る線=ルート / 黄色い輪=次の候補 / 宝石=得点</span>
          <small>同じ行・列のタイルを空白へスライド</small>
        </div>

        <div
          ref={ref}
          className="gameCanvasHost"
        />
      </div>
    </div>
  )
}
