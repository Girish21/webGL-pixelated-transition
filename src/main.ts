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
  private activeTexture = 0
  private animationDirection: -1 | 1 = -1
  private animationRunning = false
  private animationFrame: number | null = null

  private gui: GUI

  private config = {
    progress: 0,
    animate: () => {
      this.animate()
    },
  }

  constructor(el: HTMLElement) {
    this.domElement = el

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
    this.renderer.setClearColor(0xffffff, 1)
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
    this.geometry = new THREE.PlaneGeometry(600, 900, 32, 32)
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        animate: { value: 0 },
        uTexture1: { value: this.textures[this.activeTexture] },
        uTexture2: { value: this.textures[this.activeTexture + 1] },
        uDataTexture: { value: this.dataTexture },
        uProgress: { value: 0 },
        uDirection: { value: -1 },
      },
      fragmentShader,
      vertexShader,
      transparent: true,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)

    this.scene.add(this.mesh)
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

  animate() {
    this.animationRunning = true
    this.render()
    gsap.to(this.config, {
      progress: 1,
      duration: 1.5,
      ease: 'Expo.easeInOut',
      onComplete: () => {
        const next = Math.abs(
          (this.activeTexture + -this.animationDirection) %
            this.textures.length,
        )
        const nextNext = Math.abs(
          (next + -this.animationDirection) % this.textures.length,
        )

        window.cancelAnimationFrame(this.animationFrame!)
        this.animationRunning = false
        this.config.progress = 0

        this.material!.uniforms.uTexture1.value = this.textures[next]
        this.material!.uniforms.uTexture2.value = this.textures[nextNext]
        this.activeTexture = next
      },
    })
  }

  resize() {
    this.windowSize.set(
      this.domElement.offsetWidth,
      this.domElement.offsetHeight,
    )

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
      this.domElement,
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
