// Audio utilities — hybrid approach for reliable background-tab playback
//
// How it works:
// 1. Pre-render each sound into an AudioBuffer via OfflineAudioContext (one-time, cached)
//    → No timing bugs, no suspended-context issues during rendering
// 2. Play via a live AudioContext kept alive with a silent oscillator
//    → Survives background tabs (unlike new Audio() which browsers block)
// 3. Unlock AudioContext on first user gesture (click/key/touch)
// 4. Resume on visibility change as safety net

const audioQueue: string[] = []
let isPlaying = false

// --- Live AudioContext (for playback only) ---
let audioContext: AudioContext | null = null
let keepAliveNode: OscillatorNode | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    audioContext = new AudioContext()
    startKeepAlive(audioContext)
    setupVisibilityHandler()
  }
  return audioContext
}

// Silent oscillator keeps AudioContext alive in background tabs
function startKeepAlive(ctx: AudioContext) {
  if (keepAliveNode) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime) // silent
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    keepAliveNode = osc
  } catch { /* non-critical */ }
}

// Resume context when tab becomes visible (safety net)
let visibilitySetup = false
function setupVisibilityHandler() {
  if (visibilitySetup || typeof window === 'undefined') return
  visibilitySetup = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && audioContext?.state === 'suspended') {
      audioContext.resume().catch(() => {})
    }
  })
}

// Unlock AudioContext on first user gesture — call from layout onMount
let unlockDone = false
export function initAudioUnlock() {
  if (unlockDone || typeof window === 'undefined') return
  unlockDone = true
  const unlock = () => {
    const ctx = getAudioContext()
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
    window.removeEventListener('click', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('touchstart', unlock)
  }
  window.addEventListener('click', unlock)
  window.addEventListener('keydown', unlock)
  window.addEventListener('touchstart', unlock)
}

// --- Sound preset definitions ---
export type SoundPreset = 'bing' | 'chime' | 'ping' | 'bell' | 'soft' | 'double-beep'

export const SOUND_PRESETS: { value: SoundPreset; label: string }[] = [
  { value: 'bing', label: 'Bing' },
  { value: 'chime', label: 'Chime' },
  { value: 'ping', label: 'Ping' },
  { value: 'bell', label: 'Bell' },
  { value: 'soft', label: 'Soft' },
  { value: 'double-beep', label: 'Double Beep' },
]

// Renderers: build sound into an OfflineAudioContext (time starts at 0, no hardware)
const soundRenderers: Record<SoundPreset, (ctx: OfflineAudioContext, vol: number) => void> = {
  'bing': (ctx, vol) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, 0)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, 0)
    gain.gain.exponentialRampToValueAtTime(0.001, 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start(0); osc.stop(0.5)
  },

  'chime': (ctx, vol) => {
    const o1 = ctx.createOscillator()
    o1.type = 'sine'
    o1.frequency.setValueAtTime(523, 0)
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(vol, 0)
    g1.gain.exponentialRampToValueAtTime(0.001, 0.25)
    o1.connect(g1).connect(ctx.destination)
    o1.start(0); o1.stop(0.25)

    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.setValueAtTime(659, 0.15)
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(vol, 0.15)
    g2.gain.exponentialRampToValueAtTime(0.001, 0.5)
    o2.connect(g2).connect(ctx.destination)
    o2.start(0.15); o2.stop(0.5)
  },

  'ping': (ctx, vol) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, 0)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, 0)
    gain.gain.exponentialRampToValueAtTime(0.001, 0.12)
    osc.connect(gain).connect(ctx.destination)
    osc.start(0); osc.stop(0.12)
  },

  'bell': (ctx, vol) => {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(700, 0)
    const lfo = ctx.createOscillator()
    lfo.frequency.setValueAtTime(6, 0)
    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(8, 0)
    lfo.connect(lfoGain).connect(osc.frequency)
    lfo.start(0); lfo.stop(0.8)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, 0)
    gain.gain.exponentialRampToValueAtTime(0.001, 0.8)
    osc.connect(gain).connect(ctx.destination)
    osc.start(0); osc.stop(0.8)
  },

  'soft': (ctx, vol) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(330, 0)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol * 0.7, 0)
    gain.gain.exponentialRampToValueAtTime(0.001, 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(0); osc.stop(0.6)
  },

  'double-beep': (ctx, vol) => {
    for (const offset of [0, 0.18]) {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(960, offset)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(vol * 0.4, offset)
      gain.gain.exponentialRampToValueAtTime(0.001, offset + 0.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start(offset); osc.stop(offset + 0.1)
    }
  },
}

// --- Pre-render into AudioBuffer (cached) ---
const bufferCache = new Map<string, AudioBuffer>()

const durations: Record<SoundPreset, number> = {
  'bing': 0.5, 'chime': 0.5, 'ping': 0.12, 'bell': 0.8, 'soft': 0.6, 'double-beep': 0.3
}

async function getBuffer(preset: SoundPreset, volume: number): Promise<AudioBuffer> {
  const key = `${preset}-${volume}`
  if (bufferCache.has(key)) return bufferCache.get(key)!

  const sampleRate = 44100
  const offline = new OfflineAudioContext(1, Math.ceil(sampleRate * durations[preset]), sampleRate)
  soundRenderers[preset](offline, volume)
  const buffer = await offline.startRendering()
  bufferCache.set(key, buffer)
  return buffer
}

// --- Play pre-rendered buffer through live AudioContext ---
async function playSound(preset: SoundPreset, volume: number): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const buffer = await getBuffer(preset, volume)
    const ctx = getAudioContext()
    if (!ctx) return

    // Resume if suspended (best-effort — may fail without gesture)
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})

    // Play the pre-rendered buffer
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
  } catch (err) {
    console.warn('[Audio] Playback failed:', err)
  }
}

// --- Play a specific preset (for test buttons in settings) ---
export async function playPreset(preset: SoundPreset, volume = 0.3): Promise<void> {
  await playSound(preset, volume)
}

// --- Settings helpers ---
function getAgentPreset(): SoundPreset {
  if (typeof window === 'undefined') return 'bing'
  return (localStorage.getItem('dashboard_agent_sound_preset') as SoundPreset) || 'bing'
}

function getSubagentPreset(): SoundPreset {
  if (typeof window === 'undefined') return 'ping'
  return (localStorage.getItem('dashboard_subagent_sound_preset') as SoundPreset) || 'ping'
}

function isAgentSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const setting = localStorage.getItem('dashboard_agent_sound_enabled')
  return setting === null || setting === 'true'
}

function isSubagentSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const setting = localStorage.getItem('dashboard_subagent_sound_enabled')
  return setting === null || setting === 'true'
}

function isTTSEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('dashboard_tts_enabled') === 'true'
}

// --- Public play functions (called by websocket handler) ---

export async function playBing(): Promise<void> {
  if (!isAgentSoundEnabled()) return
  await playSound(getAgentPreset(), 0.5)
}

export async function playSubagentBing(): Promise<void> {
  if (!isSubagentSoundEnabled()) return
  await playSound(getSubagentPreset(), 0.5)
}

// --- TTS Queue ---

export function queueAudio(url: string): void {
  if (!isTTSEnabled()) return
  if (typeof window === 'undefined') return
  if (audioQueue.includes(url)) return
  audioQueue.push(url)
  if (!isPlaying) playQueuedAudio()
}

export function playQueuedAudio(): void {
  if (typeof window === 'undefined') return
  if (audioQueue.length === 0) { isPlaying = false; return }
  isPlaying = true
  const url = audioQueue.shift()!
  const audio = new Audio(url)
  audio.onended = () => playQueuedAudio()
  audio.onerror = () => { console.warn('[Audio] Failed to play:', url); playQueuedAudio() }
  audio.play().catch((err) => { console.warn('[Audio] Playback failed:', err); playQueuedAudio() })
}
