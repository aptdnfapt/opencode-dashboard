// Audio utilities - Web Audio API bing + TTS queue playback

let audioContext: AudioContext | null = null
const audioQueue: string[] = []
let isPlaying = false

// Get or create AudioContext (lazy init to avoid SSR issues)
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

// Check if sound is enabled in localStorage
function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  // Default to enabled if not set
  const setting = localStorage.getItem('dashboard_sound_enabled')
  return setting === null || setting === 'true'
}

// Check if TTS is enabled in localStorage
function isTTSEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('dashboard_tts_enabled') === 'true'
}

/**
 * Play 880Hz sine wave bing sound with 0.5s fade out
 */
export function playBing(): void {
  if (!isSoundEnabled()) return
  
  const ctx = getAudioContext()
  if (!ctx) return
  
  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  
  // Create oscillator - 880Hz sine wave
  const oscillator = ctx.createOscillator()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, ctx.currentTime)
  
  // Create gain node for fade out
  const gainNode = ctx.createGain()
  gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
  // Fade out over 0.5s
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  
  // Connect: oscillator -> gain -> output
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  
  // Play and stop
  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 0.5)
}

/**
 * Queue TTS audio URL for playback with deduplication
 */
export function queueAudio(url: string): void {
  if (!isTTSEnabled()) return
  if (typeof window === 'undefined') return
  
  // Deduplicate - don't add if already in queue
  if (audioQueue.includes(url)) return
  
  audioQueue.push(url)
  
  // Start playback if not already playing
  if (!isPlaying) {
    playQueuedAudio()
  }
}

/**
 * Play audio from queue sequentially
 */
export function playQueuedAudio(): void {
  if (typeof window === 'undefined') return
  if (audioQueue.length === 0) {
    isPlaying = false
    return
  }
  
  isPlaying = true
  const url = audioQueue.shift()!
  
  const audio = new Audio(url)
  
  audio.onended = () => {
    // Play next in queue
    playQueuedAudio()
  }
  
  audio.onerror = () => {
    console.warn('[Audio] Failed to play:', url)
    // Continue with next in queue
    playQueuedAudio()
  }
  
  audio.play().catch((err) => {
    console.warn('[Audio] Playback failed:', err)
    playQueuedAudio()
  })
}
