// Audio utilities - Web Audio API sound presets + TTS queue playback

let audioContext: AudioContext | null = null
const audioQueue: string[] = []
let isPlaying = false

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

function resumeCtx(ctx: AudioContext) {
  if (ctx.state === 'suspended') ctx.resume()
}

// --- Sound Presets ---
// Each preset is a function that plays a distinct sound via Web Audio API

export type SoundPreset = 'bing' | 'chime' | 'ping' | 'bell' | 'soft' | 'double-beep'

export const SOUND_PRESETS: { value: SoundPreset; label: string }[] = [
  { value: 'bing', label: 'Bing' },         // 880Hz sine, 0.5s fade
  { value: 'chime', label: 'Chime' },       // two-tone ascending
  { value: 'ping', label: 'Ping' },         // short high pop
  { value: 'bell', label: 'Bell' },         // triangle wave, longer ring
  { value: 'soft', label: 'Soft' },         // low gentle hum
  { value: 'double-beep', label: 'Double Beep' }, // two quick beeps
]

const soundFns: Record<SoundPreset, (ctx: AudioContext, vol: number) => void> = {
  // Classic 880Hz sine with fade
  'bing': (ctx, vol) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.5)
  },

  // Two-tone ascending chime (C5 → E5)
  'chime': (ctx, vol) => {
    const t = ctx.currentTime
    // First note
    const o1 = ctx.createOscillator()
    o1.type = 'sine'
    o1.frequency.setValueAtTime(523, t) // C5
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(vol, t)
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    o1.connect(g1).connect(ctx.destination)
    o1.start(t); o1.stop(t + 0.25)
    // Second note
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.setValueAtTime(659, t + 0.15) // E5
    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(vol, t + 0.15)
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    o2.connect(g2).connect(ctx.destination)
    o2.start(t + 0.15); o2.stop(t + 0.5)
  },

  // Short high pop — 1400Hz, very brief
  'ping': (ctx, vol) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, ctx.currentTime)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain).connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.12)
  },

  // Triangle wave bell — richer tone, longer ring
  'bell': (ctx, vol) => {
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(700, t)
    // Add subtle vibrato
    const lfo = ctx.createOscillator()
    lfo.frequency.setValueAtTime(6, t)
    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(8, t)
    lfo.connect(lfoGain).connect(osc.frequency)
    lfo.start(t); lfo.stop(t + 0.8)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.8)
  },

  // Low gentle hum — 330Hz, slow fade
  'soft': (ctx, vol) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(330, ctx.currentTime)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(vol * 0.7, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.6)
  },

  // Two quick beeps
  'double-beep': (ctx, vol) => {
    const t = ctx.currentTime
    for (const offset of [0, 0.18]) {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(960, t + offset)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(vol * 0.4, t + offset) // square is louder, scale down
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t + offset); osc.stop(t + offset + 0.1)
    }
  },
}

// --- Play a specific preset (for test buttons) ---
export function playPreset(preset: SoundPreset, volume = 0.3): void {
  const ctx = getAudioContext()
  if (!ctx) return
  resumeCtx(ctx)
  soundFns[preset](ctx, volume)
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

export function playBing(): void {
  if (!isAgentSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return
  resumeCtx(ctx)
  soundFns[getAgentPreset()](ctx, 0.3)
}

export function playSubagentBing(): void {
  if (!isSubagentSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return
  resumeCtx(ctx)
  soundFns[getSubagentPreset()](ctx, 0.15)
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
