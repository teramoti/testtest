import { useEffect, useRef, useState } from 'react'
import './StartScreen.css'

import titleBackground from '../../../../assets/Image/title/title_background_1280x720.png'
import titleLogo from '../../../../assets/Image/title/title_logo.png'
import titleKeyVisual from '../../../../assets/Image/title/title_key_visual.png'
import titleRobotIdle01 from '../../../../assets/Image/robot_idle/robot_idle_01.png'
import titleRobotIdle02 from '../../../../assets/Image/robot_idle/robot_idle_02.png'
import titleRobotIdle03 from '../../../../assets/Image/robot_idle/robot_idle_03.png'
import titleRobotIdle04 from '../../../../assets/Image/robot_idle/robot_idle_04.png'
import titleGem01 from '../../../../assets/Image/gem_anim_8frames_32x32/gem_anim_01.png'
import titleGem02 from '../../../../assets/Image/gem_anim_8frames_32x32/gem_anim_02.png'
import titleGem03 from '../../../../assets/Image/gem_anim_8frames_32x32/gem_anim_03.png'
import titleGem04 from '../../../../assets/Image/gem_anim_8frames_32x32/gem_anim_04.png'
import titleGem05 from '../../../../assets/Image/gem_anim_8frames_32x32/gem_anim_05.png'
import titleGem06 from '../../../../assets/Image/gem_anim_8frames_32x32/gem_anim_06.png'
import titleGem07 from '../../../../assets/Image/gem_anim_8frames_32x32/gem_anim_07.png'
import titleGem08 from '../../../../assets/Image/gem_anim_8frames_32x32/gem_anim_08.png'
import startButtonNormal from '../../../../assets/Image/ui/start_normal.png'
import startButtonSelected from '../../../../assets/Image/ui/start_selected.png'
import startButtonPressed from '../../../../assets/Image/ui/start_pressed.png'
import howToButtonNormal from '../../../../assets/Image/ui/howto_normal.png'
import howToButtonSelected from '../../../../assets/Image/ui/howto_selected.png'
import howToButtonPressed from '../../../../assets/Image/ui/howto_pressed.png'
import pathHorizontalImage from '../../../../assets/Image/path_tiles_32x32/path_horizontal.png'
import pathVerticalImage from '../../../../assets/Image/path_tiles_32x32/path_vertical.png'
import pathCornerTopRightImage from '../../../../assets/Image/path_tiles_32x32/path_corner_top_right.png'
import pathCornerRightBottomImage from '../../../../assets/Image/path_tiles_32x32/path_corner_right_bottom.png'
import pathCornerLeftBottomImage from '../../../../assets/Image/path_tiles_32x32/path_corner_left_bottom.png'
import pathCornerLeftTopImage from '../../../../assets/Image/path_tiles_32x32/path_corner_left_top.png'
import pathCrossImage from '../../../../assets/Image/path_tiles_32x32/path_cross.png'
import spark01 from '../../../../assets/Image/effects/spark/spark_01.png'
import spark02 from '../../../../assets/Image/effects/spark/spark_02.png'
import spark03 from '../../../../assets/Image/effects/spark/spark_03.png'
import spark04 from '../../../../assets/Image/effects/spark/spark_04.png'
import startBgm from '../../../../assets/bkue_ghost/audio/start.mp3'
import { playClickSound } from '../../audio/playClickSound'
import { difficultyDescriptions, getGameBoardSize } from '../../data/gameRules'

type Difficulty = 'easy' | 'normal' | 'hard'
type TitleButton = 'start' | 'howTo'
type HowToPage = 'route' | 'slide' | 'score'

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

const howToPages: Array<{
  id: HowToPage
  label: string
  title: string
  body: string
}> = [
  {
    id: 'route',
    label: 'ルート',
    title: '道をつなぐ',
    body: 'ロボットの進む先に道がつながるように、タイルの並びを見て動かします。',
  },
  {
    id: 'slide',
    label: 'スライド',
    title: '空白へ動かす',
    body: '同じ行または列にある空白マスへ、タイルをまとめてスライドできます。',
  },
  {
    id: 'score',
    label: 'スコア',
    title: '宝石を集める',
    body: 'つながった道の先にある宝石を取るとスコアが増えます。長く安全なルートを作るほど有利です。',
  },
]

const titleRobotFrames = [
  titleRobotIdle01,
  titleRobotIdle02,
  titleRobotIdle03,
  titleRobotIdle04,
]

const titleGemFrames = [
  titleGem01,
  titleGem02,
  titleGem03,
  titleGem04,
  titleGem05,
  titleGem06,
  titleGem07,
  titleGem08,
]

const sparkFrames = [spark01, spark02, spark03, spark04]

const demoTiles = [
  { src: pathCornerRightBottomImage },
  { src: pathHorizontalImage },
  { src: pathCornerLeftBottomImage },
  { src: pathVerticalImage },
  { src: pathCrossImage },
  { src: pathVerticalImage },
  { src: pathCornerTopRightImage },
  { src: pathHorizontalImage },
  { src: pathCornerLeftTopImage },
]

const routeLoopSegments = ['top', 'right', 'bottom', 'left']

function getQueryPlayerCount(): number | null {
  const queryPlayerCount = Number(
    new URLSearchParams(window.location.search).get('playerCount')
  )

  if (Number.isNaN(queryPlayerCount) || queryPlayerCount < 1) return null
  return Math.min(4, Math.trunc(queryPlayerCount))
}

export default function StartScreen({ onStart }: Props) {
  const initialPlayerCount = getQueryPlayerCount()
  const [playerCount, setPlayerCount] = useState(initialPlayerCount ?? 1)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [isHowToOpen, setIsHowToOpen] = useState(false)
  const [isDifficultyDialogOpen, setIsDifficultyDialogOpen] = useState(false)
  const [hoveredTitleButton, setHoveredTitleButton] = useState<TitleButton | null>(null)
  const [pressedTitleButton, setPressedTitleButton] = useState<TitleButton | null>(null)
  const [titleRobotFrameIndex, setTitleRobotFrameIndex] = useState(0)
  const [titleGemFrameIndex, setTitleGemFrameIndex] = useState(0)
  const [selectedHowToPage, setSelectedHowToPage] = useState<HowToPage>('route')
  const [isPlayerCountFixed] = useState(initialPlayerCount !== null)
  const isPlayerCountFixedRef = useRef(initialPlayerCount !== null)
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const boardSize = getGameBoardSize(difficulty)

  useEffect(() => {
    const audio = new Audio(startBgm)
    audio.loop = true
    bgmRef.current = audio

    const playBgm = () => {
      void audio.play().catch(() => {
        // Browser autoplay can fail until the first user input.
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
    const robotTimerId = window.setInterval(() => {
      setTitleRobotFrameIndex((index) => (index + 1) % titleRobotFrames.length)
    }, 240)

    const gemTimerId = window.setInterval(() => {
      setTitleGemFrameIndex((index) => (index + 1) % titleGemFrames.length)
    }, 120)

    return () => {
      window.clearInterval(robotTimerId)
      window.clearInterval(gemTimerId)
    }
  }, [])

  useEffect(() => {
    const handleTitleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isHowToOpen && !isDifficultyDialogOpen) {
        startGame()
      }
    }

    window.addEventListener('keydown', handleTitleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleTitleKeyDown)
    }
  }, [playerCount, difficulty, isHowToOpen, isDifficultyDialogOpen])

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

  const getTitleButtonImage = (button: TitleButton) => {
    const isPressed = pressedTitleButton === button
    const isHovered = hoveredTitleButton === button

    if (button === 'start') {
      if (isPressed) return startButtonPressed
      if (isHovered) return startButtonSelected
      return startButtonNormal
    }

    if (isPressed) return howToButtonPressed
    if (isHovered) return howToButtonSelected
    return howToButtonNormal
  }

  const startGame = () => {
    playClickSound()
    onStart({ playerCount, difficulty })
  }

  return (
    <div
      className="backColor startScreenYellowBackground"
      style={{ backgroundImage: `url(${titleBackground})` }}
    >
      <div className="titleStageDecoration" aria-hidden="true">
        <img
          className="titleRobotMascot"
          src={titleRobotFrames[titleRobotFrameIndex]}
          alt=""
          draggable={false}
        />
        <img
          className="titleGemMascot titleGemMascotLeft"
          src={titleGemFrames[titleGemFrameIndex]}
          alt=""
          draggable={false}
        />
        <img
          className="titleGemMascot titleGemMascotRight"
          src={titleGemFrames[(titleGemFrameIndex + 3) % titleGemFrames.length]}
          alt=""
          draggable={false}
        />
        {[0, 1, 2, 3].map((index) => (
          <img
            className={`titleSparkDecor titleSparkDecor${index + 1}`}
            src={sparkFrames[(titleGemFrameIndex + index) % sparkFrames.length]}
            alt=""
            draggable={false}
            key={index}
          />
        ))}
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <img
            className={`titleGemTrail titleGemTrail${index + 1}`}
            src={titleGemFrames[(titleGemFrameIndex + index) % titleGemFrames.length]}
            alt=""
            draggable={false}
            key={`trail-${index}`}
          />
        ))}
      </div>

      <div className="titleCenterShowcase" aria-hidden="true">
        <img
          className="titleKeyVisualImage"
          src={titleKeyVisual}
          alt=""
          draggable={false}
        />
        <span className="titleMovingRobotShadow" />
        <img
          className="titleMovingRobot"
          src={titleRobotFrames[titleRobotFrameIndex]}
          alt=""
          draggable={false}
        />
        <img
          className="titleMovingGem titleMovingGemA"
          src={titleGemFrames[titleGemFrameIndex]}
          alt=""
          draggable={false}
        />
        <img
          className="titleMovingGem titleMovingGemB"
          src={titleGemFrames[(titleGemFrameIndex + 4) % titleGemFrames.length]}
          alt=""
          draggable={false}
        />
        <div className="titleShowcaseStatus">
          <span>ROUTE READY</span>
          <span>GEMS x 3</span>
          <span>60 SEC</span>
        </div>
      </div>

      <div className="startScreen richStartPanel">
        <header className="titleArea richTitleArea">
          <div className="richTitleRow">
            <img
              className="titleLogoImage"
              src={titleLogo}
              alt="ゼンマイ ルートラッシュ"
            />
          </div>
        </header>

        <section className="menuArea">
          <div className="playerSetting">
            <div className="playerCountRow">
              <p className="playerCount">
                参加人数 : {playerCount}P
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
            <span className="startPatternLabel">Board Size</span>
            <strong className="startPatternValue">
              {boardSize} x {boardSize}
            </strong>
          </div>

          <div className="buttonArea titleButtonArea">
            <button
              className="titleImageButton titleStartButton"
              type="button"
              aria-label="START"
              onMouseEnter={() => setHoveredTitleButton('start')}
              onMouseLeave={() => {
                setHoveredTitleButton(null)
                setPressedTitleButton(null)
              }}
              onFocus={() => setHoveredTitleButton('start')}
              onBlur={() => {
                setHoveredTitleButton(null)
                setPressedTitleButton(null)
              }}
              onPointerDown={() => setPressedTitleButton('start')}
              onPointerUp={() => setPressedTitleButton(null)}
              onClick={startGame}
            >
              <img
                className="titleButtonImage"
                src={getTitleButtonImage('start')}
                alt=""
                draggable={false}
              />
            </button>

            <button
              className="titleImageButton titleHowToButton"
              type="button"
              aria-label="あそびかた"
              onMouseEnter={() => setHoveredTitleButton('howTo')}
              onMouseLeave={() => {
                setHoveredTitleButton(null)
                setPressedTitleButton(null)
              }}
              onFocus={() => setHoveredTitleButton('howTo')}
              onBlur={() => {
                setHoveredTitleButton(null)
                setPressedTitleButton(null)
              }}
              onPointerDown={() => setPressedTitleButton('howTo')}
              onPointerUp={() => setPressedTitleButton(null)}
              onClick={() => {
                playClickSound()
                setIsHowToOpen(true)
              }}
            >
              <img
                className="titleButtonImage"
                src={getTitleButtonImage('howTo')}
                alt=""
                draggable={false}
              />
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
          <div className="howToModal gameHowToModal" onClick={(event) => event.stopPropagation()}>
            <div className="gameHowToHeader">
              <p className="howToTitle">How To Play</p>
              <div className="howToTabs" role="tablist" aria-label="How to play pages">
                {howToPages.map((page) => (
                  <button
                    className={`howToTab ${selectedHowToPage === page.id ? 'howToTabActive' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={selectedHowToPage === page.id}
                    onClick={() => {
                      playClickSound()
                      setSelectedHowToPage(page.id)
                    }}
                    key={page.id}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`howToVideoPreview howToVideoPreview-${selectedHowToPage}`}>
              <div className="howToPreviewGrid" aria-hidden="true">
                {demoTiles.map((tile, index) => (
                  <span className="howToPreviewTile" key={`${tile.src}-${index}`}>
                    <img
                      src={tile.src}
                      alt=""
                      draggable={false}
                    />
                  </span>
                ))}
                <span className="routeLoop howToRouteLoop">
                  {routeLoopSegments.map((segment) => (
                    <span
                      className={`routeLoopSegment routeLoopSegment-${segment}`}
                      key={segment}
                    />
                  ))}
                </span>
                <span className="howToPreviewSlideGhost" />
                <img
                  className="howToPreviewRobot"
                  src={titleRobotFrames[titleRobotFrameIndex]}
                  alt=""
                  draggable={false}
                />
                <img
                  className="howToPreviewGem"
                  src={titleGemFrames[titleGemFrameIndex]}
                  alt=""
                  draggable={false}
                />
                <img
                  className="howToPreviewSpark"
                  src={sparkFrames[titleGemFrameIndex % sparkFrames.length]}
                  alt=""
                  draggable={false}
                />
              </div>
            </div>

            {howToPages.map((page) => (
              selectedHowToPage === page.id && (
                <div className="howToPageText" key={page.id}>
                  <p className="howToStepTitle">{page.title}</p>
                  <p className="howToBody">{page.body}</p>
                  <p className="howToBody howToDifficultyText">
                    {difficultyDescriptions[difficulty]}
                  </p>
                </div>
              )
            ))}

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
