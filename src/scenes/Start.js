import { Start as RobotPreloadScene } from '../game/robotSlide/scenes/RobotPreloadScene.ts'
import { RobotSlideScene } from '../game/robotSlide/scenes/RobotSlideScene.ts'

const defaultOptions = () => ({
  settings: {
    playerCount: 1,
    difficulty: 'normal',
  },
  hudTarget: null,
  onFinish: (result) => {
    console.log('Robot slide result:', result)
  },
})

const mergeOptions = (options = {}) => ({
  ...defaultOptions(),
  ...options,
  settings: {
    ...defaultOptions().settings,
    ...(options.settings ?? {}),
  },
})

export class Start extends RobotPreloadScene {
  constructor(options = {}) {
    super(mergeOptions(options))
  }

  init(options = {}) {
    super.init(mergeOptions(options))
  }

  create() {
    this.ensureAnimations()

    if (!this.scene.get('RobotSlideScene')) {
      this.scene.add('RobotSlideScene', RobotSlideScene, false)
    }

    this.scene.start('RobotSlideScene', this.options)
  }
}
