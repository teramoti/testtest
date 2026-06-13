import { useEffect, useRef, useState } from 'react'
import './StartScreen.css'

import titleBackground from '../../../../assets/Image/title/title_background_1280x720.png'
import titleLogo from '../../../../assets/Image/title/title_logo.png'
import startBgm from '../../../../assets/bkue_ghost/audio/start.mp3'
import { playClickSound } from '../../audio/playClickSound'
import { getGameTimeLimitSeconds } from '../../data/gameRules'

type Difficulty = 'easy' | 'normal' | 'hard'

type Props = {
  onStart: (settings: {
    playerCount: number
    difficulty: Difficulty
  }) => void
}

const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
}

const difficultyDescriptions: Record<Difficulty, string> = {
  easy: '制限時間が長く、ルートを確認しやすい設定です。',
  normal: '標準の制限時間でスコアを競います。',
  hard: '制限時間が短く、判断速度が必要です。',
}

function getQueryPlayerCount(): number | null {
  const queryPlayerCount = Number(
    new URLSearchParams(window.location.search).get('playerCount')
  )

  if (Number.isNaN(queryPlayerCount) || queryPlayerCount < 1) return null
  return Math.min(4, Math.trunc(queryPlayerCount))
}

export default function StartScreen({ onStart }: Props) {
  const initialPlayerCount = getQueryPlayerCount()
  const [playerCount, setPlayerCount] = useState(initialPlayerCount ?? 4)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [isHowToOpen, setIsHowToOpen] = useState(false)
  const [isDifficultyDialogOpen, setIsDifficultyDialogOpen] = useState(false)
  const [isPlayerCountFixed] = useState(initialPlayerCount !== null)
  const isPlayerCountFixedRef = useRef(initialPlayerCount !== null)
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const timeLimitSeconds = getGameTimeLimitSeconds(difficulty)

  useEffect(() => {
    const audio = new Audio(startBgm)
    audio.loop = true
    bgmRef.current = audio

    const playBgm = () => {
      void audio.play().catch(() => {
        // ブラウザの自動再生制限時は、次のユーザー操作で再試行します。
      })
    }

    playBgm()
    window.addEventListener('pointerdown', playBgm, { once: true })
    window.addEventListener('keydown', playBgm, { once: true })

    return () => {
      window.removeEventListener('pointerdown', playBgm)
      window.removeEventListener('keydown', playBgm)
      audio.pause()
      audio.currentTime = 0
      bgmRef.current = null
    }
  }, [])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'SET_PLAYER_COUNT') return
      if (isPlayerCountFixedRef.current) return

      const count = Number(event.data.playerCount)
      if (Number.isNaN(count) || count < 1) return

      setPlayerCount(Math.min(4, Math.trunc(count)))
    }

    window.parent.postMessage({ type: 'READY' }, '*')
    window.addEventListener('message', handler)

    return () => {
      window.removeEventListener('message', handler)
    }
  }, [])

  const startGame = () => {
    playClickSound()
    onStart({ playerCount, difficulty })
  }

  return (
    <div
      className="backColor startScreenYellowBackground"
      style={{ backgroundImage: `url(${titleBackground})` }}
    >
      <div className="startScreen richStartPanel">
        <header className="titleArea richTitleArea">
          <div className="richTitleRow">
            <img
              className="titleLogoImage"
              src={titleLogo}
              alt="Robot Slide"
            />
          </div>

        </header>

        <section className="menuArea">
          <div className="playerSetting">
            <label className="label" htmlFor="playerCount">
              Player Count
            </label>

            <div className="playerCountRow">
              <p className="playerCount">
                {playerCount}P
              </p>

              {!isPlayerCountFixed && (
                <input
                  className="numberInput"
                  id="playerCount"
                  type="number"
                  min={1}
                  max={4}
                  value={playerCount}
                  onChange={(event) =>
                    setPlayerCount(
                      Math.max(1, Math.min(4, Number(event.target.value) || 1))
                    )
                  }
                />
              )}
            </div>
          </div>

          <div className="difficultySetting">
            <div className="difficultyRichRow">
              <button
                className="difficultyOpenButton"
                type="button"
                onClick={() => setIsDifficultyDialogOpen(true)}
              >
                Difficulty
              </button>

              <div className="difficultyCurrent">
                {difficultyLabels[difficulty]}
              </div>
            </div>
          </div>

          <div className="startPatternDisplay">
            <span className="startPatternLabel">Time Limit</span>
            <strong className="startPatternValue">
              {timeLimitSeconds}s
            </strong>
          </div>

          <div className="buttonArea">
            <button
              className="startButton"
              type="button"
              onClick={startGame}
            >
              GAME START
            </button>

            <button
              className="howToButton"
              type="button"
              onClick={() => {
                playClickSound()
                setIsHowToOpen(true)
              }}
            >
              How To Play
            </button>
          </div>
        </section>

        {isDifficultyDialogOpen && (
          <div className="difficultyDialogLayer" role="presentation">
            <div className="difficultyDialog" role="dialog" aria-modal="true" aria-label="Difficulty">
              <h2 className="difficultyDialogTitle">Select Difficulty</h2>

              <div className="difficultyDialogButtons">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((value) => (
                  <button
                    className={`difficultyChoiceButton ${difficulty === value ? 'difficultyChoiceSelected' : ''}`}
                    type="button"
                    onClick={() => {
                      playClickSound()
                      setDifficulty(value)
                      setIsDifficultyDialogOpen(false)
                    }}
                    key={value}
                  >
                    {difficultyLabels[value]}
                  </button>
                ))}
              </div>

              <button
                className="difficultyDialogClose"
                type="button"
                onClick={() => setIsDifficultyDialogOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {isHowToOpen && (
        <div className="howToOverlay" onClick={() => setIsHowToOpen(false)}>
          <div className="howToModal" onClick={(event) => event.stopPropagation()}>
            <p className="howToTitle">How To Play</p>
            <p className="howToBody">
              動かせるタイルを選び、空白マスへスライドさせます。ロボットの進路をつなげ、宝石を集めてスコアを伸ばします。
            </p>
            <p className="howToBody">
              {difficultyDescriptions[difficulty]}
            </p>

            <button
              className="howToClose"
              type="button"
              onClick={() => {
                playClickSound()
                setIsHowToOpen(false)
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
