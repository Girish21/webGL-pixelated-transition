import './style.css'

import { Gesture } from '@use-gesture/vanilla'
import gsap from 'gsap'
import { Lethargy } from 'lethargy'
import GUI from 'lil-gui'
import * as THREE from 'three'

import fragmentShader from './shader/fragment.frag?raw'
import vertexShader from './shader/vertex.vert?raw'
import img1 from './assets/1.jpeg'
import img2 from './assets/2.jpeg'

const lethargy = new Lethargy()

class Sketch {
  private domElement: HTMLElement
  private image: HTMLImageElement
  private windowSize: THREE.Vector2
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private cameraZPosition = 800
  private clock: THREE.Clock
  private renderer: THREE.WebGLRenderer
  private geometry: THREE.PlaneGeometry | null
  private material: THREE.ShaderMaterial | null
  private mesh: THREE.Mesh | null
  private loadingManager: THREE.LoadingManager
  private loader: THREE.TextureLoader
  private dataTexture: THREE.DataTexture | null
  private textures: THREE.Texture[] = []
  private bgColors: string[] = ['#d8b4fe', '#fde68a']
  private fontColors: string[] = ['#ffffff', '#000000']
  private activeTexture = 0
  private animationDirection: -1 | 1 = -1
  private animationRunning = false
  private animationFrame: number | null = null
  private pageTitles: NodeList

  private gui: GUI

  private config = {
    progress: 0,
    revealAnimation: true,
    animate: () => {
      this.animate()
    },
  }

  constructor(el: HTMLElement) {
    this.domElement = el
    this.image = document.getElementById('img-container') as HTMLImageElement
    this.pageTitles = document.querySelectorAll('.page-title')

    this.windowSize = new THREE.Vector2(
      this.domElement.offsetWidth,
      this.domElement.offsetHeight,
    )

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      this.cameraFOV(),
      this.windowSize.x / this.windowSize.y,
      0.1,
      1000,
    )
    this.camera.position.z = this.cameraZPosition
    this.scene.add(this.camera)

    this.clock = new THREE.Clock()

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setClearColor(0xffffff, 0)
    this.domElement.append(this.renderer.domElement)

    this.loadingManager = new THREE.LoadingManager()
    this.loader = new THREE.TextureLoader(this.loadingManager)

    this.dataTexture = null
    this.geometry = null
    this.material = null
    this.mesh = null

    this.gui = new GUI()

    this.fillDataTexture()
    this.loadTextures()
    this.addObject()
    this.addGUI()
    this.addGesture()
    this.addEventListener()
    this.resize()
    this.loadingManager.onLoad = () => {
      this.render()
      this.revealAnimation()
    }
  }

  cameraFOV() {
    return (
      2 *
      THREE.MathUtils.radToDeg(
        Math.atan(this.windowSize.y / 2 / this.cameraZPosition),
      )
    )
  }

  loadTextures() {
    this.textures.push(this.loader.load(img1))
    this.textures.push(this.loader.load(img2))

    if (this.pageTitles.length != this.textures.length) {
      throw new Error('Number of page titles and images must be equal')
    }
  }

  fillDataTexture() {
    const width = 16,
      height = 24

    const size = width * height
    const data = new Float32Array(4 * size)

    for (let i = 0; i < size; i++) {
      const r = 0.1 + 0.9 * Math.random()
      const stride = i * 4

      data[stride] = r
      data[stride + 1] = r
      data[stride + 2] = r
      data[stride + 3] = 1.0
    }

    this.dataTexture = new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat,
      THREE.FloatType,
    )
    this.dataTexture.magFilter = this.dataTexture.minFilter =
      THREE.NearestFilter
    this.dataTexture.needsUpdate = true
  }

  addObject() {
    this.geometry = new THREE.PlaneGeometry(1, 1, 32, 32)
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        animate: { value: 0 },
        uResolution: { value: new THREE.Vector4() },
        uTexture1: { value: null },
        uTexture2: { value: this.textures[this.activeTexture] },
        uDataTexture: { value: this.dataTexture },
        uProgress: { value: 0 },
        uRevealAnimation: { value: this.config.revealAnimation },
        uDirection: { value: 1 },
      },
      fragmentShader,
      vertexShader,
      transparent: true,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)

    this.scaleAndPosition()

    this.scene.add(this.mesh)
  }

  scaleAndPosition() {
    const boundingBox = this.image.getBoundingClientRect()
    const imageAspect = 2880 / 1920

    let side1, side2

    if (boundingBox.height / boundingBox.width > imageAspect) {
      side1 = (boundingBox.width / boundingBox.height) * imageAspect
      side2 = 1
    } else {
      side1 = 1
      side2 = boundingBox.height / boundingBox.width / imageAspect
    }

    this.mesh!.scale.set(boundingBox.width, boundingBox.height, 1)
    this.mesh!.position.x =
      boundingBox.left - this.windowSize.x / 2 + boundingBox.width / 2
    this.mesh!.position.y =
      this.windowSize.y / 2 - boundingBox.top - boundingBox.height / 2

    this.material!.uniforms.uResolution.value.x = boundingBox.width
    this.material!.uniforms.uResolution.value.y = boundingBox.height
    this.material!.uniforms.uResolution.value.z = side1
    this.material!.uniforms.uResolution.value.w = side2
  }

  addGUI() {
    this.gui
      .add(this.config, 'progress')
      .name('Animate')
      .min(0)
      .max(1)
      .step(0.01)
      .onChange((val: number) => {
        this.material!.uniforms.uProgress.value = val
      })
    this.gui.add(this.config, 'animate').name('Animate')
  }

  revealAnimation() {
    const title = this.pageTitles[0] as HTMLElement
    title.hidden = false

    this.animationRunning = true
    this.render()

    const tl = gsap.timeline()
    tl.to(title.querySelectorAll('span'), {
      y: 0,
      stagger: 0.02,
      duration: 2,
      ease: 'elastic.out(1.2, 1)',
    }).to(
      this.config,
      {
        progress: 1,
        delay: 0.2,
        duration: 2,
        ease: 'expo.inOut',
        onComplete: () => {
          window.cancelAnimationFrame(this.animationFrame!)
          this.animationRunning = false
          this.config.revealAnimation = false
          this.config.progress = 0

          this.material!.uniforms.uTexture1.value =
            this.textures[this.activeTexture]
          this.material!.uniforms.uTexture2.value =
            this.textures[this.activeTexture + 1]
          this.material!.uniforms.uRevealAnimation.value =
            this.config.revealAnimation
        },
      },
      '<',
    )
  }

  animate() {
    this.animationRunning = true
    this.render()
    const next = Math.abs(
      (this.activeTexture + -this.animationDirection) % this.textures.length,
    )
    const nextNext = Math.abs(
      (next + -this.animationDirection) % this.textures.length,
    )
    const currentText = this.pageTitles[this.activeTexture] as HTMLElement
    const nextText = this.pageTitles[next] as HTMLElement
    const tl = gsap.timeline()

    tl.to(currentText.querySelectorAll('span'), {
      y: '100%',
      duration: 0.5,
      ease: 'power1.out',
    })
      .set(currentText, { hidden: true }, '>')
      .set(nextText, { hidden: false }, '>')
      .set(nextText.querySelectorAll('span'), { y: '100%' }, '>')
      .to(nextText.querySelectorAll('span'), {
        y: 0,
        stagger: 0.02,
        duration: 0.7,
        ease: 'elastic.out(1.2, 1)',
      })
      .to(
        'html',
        {
          '--background': this.bgColors[next],
          '--font-color': this.fontColors[next],
          ease: 'expo.inOut',
          delay: 0.1,
          duration: 1.5,
        },
        '<',
      )
      .to(
        this.config,
        {
          progress: 1,
          duration: 1.5,
          ease: 'expo.inOut',
          onComplete: () => {
            window.cancelAnimationFrame(this.animationFrame!)
            this.animationRunning = false
            this.config.progress = 0

            this.material!.uniforms.uTexture1.value = this.textures[next]
            this.material!.uniforms.uTexture2.value = this.textures[nextNext]
            this.activeTexture = next
          },
        },
        '<',
      )
  }

  resize() {
    this.windowSize.set(
      this.domElement.offsetWidth,
      this.domElement.offsetHeight,
    )

    this.scaleAndPosition()

    this.camera.fov = this.cameraFOV()
    this.camera.aspect = this.windowSize.x / this.windowSize.y
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(this.windowSize.x, this.windowSize.y)
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))

    this.render()
  }

  addEventListener() {
    window.addEventListener('resize', this.resize.bind(this))
  }

  addGesture() {
    new Gesture(
      window,
      {
        onDrag: ({ intentional, direction: [x], dragging }) => {
          if (intentional && !this.animationRunning && dragging) {
            this.animationRunning = true
            this.animationDirection = x as any
            this.material!.uniforms.uDirection.value = x
            this.animate()
          }
        },
        onWheel: ({ event }) => {
          const direction = lethargy.check(event)
          if (direction && !this.animationRunning) {
            this.animationRunning = true
            this.animationDirection = direction
            this.material!.uniforms.uDirection.value = direction
            this.animate()
          }
        },
      },
      {
        wheel: {
          preventDefault: true,
          eventOptions: { passive: false },
          enabled: window.matchMedia('(pointer: fine)').matches,
        },
        drag: {
          enabled: window.matchMedia('(pointer: coarse)').matches,
          axis: 'x',
        },
      },
    )
  }

  render() {
    const elapsedTime = this.clock.getElapsedTime()

    if (this.material) {
      this.material.uniforms.uTime.value = elapsedTime
      this.material.uniforms.uProgress.value = this.config.progress
    }

    this.renderer.render(this.scene, this.camera)

    if (this.animationRunning) {
      this.animationFrame = window.requestAnimationFrame(this.render.bind(this))
    }
  }
}

new Sketch(document.getElementById('app')!)
