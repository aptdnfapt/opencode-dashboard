// backend/src/services/tts.ts
// Kokoro TTS service - loads model once, generates audio on demand

import { KokoroTTS } from 'kokoro-js'

let tts: KokoroTTS | null = null
let loading = false
let loadError: Error | null = null

// Initialize TTS model (call once on startup)
export async function initTTS(): Promise<void> {
  if (tts || loading) return
  loading = true
  
  console.log('[TTS] Loading Kokoro model (q8 quantized)...')
  const start = Date.now()
  
  try {
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8', // 86MB quantized version
    })
    console.log(`[TTS] Model loaded in ${Date.now() - start}ms`)
  } catch (err) {
    loadError = err as Error
    console.error('[TTS] Failed to load model:', err)
  } finally {
    loading = false
  }
}

// Check if TTS is ready
export function isTTSReady(): boolean {
  return tts !== null
}

// Generate speech audio from text
export async function generateSpeech(text: string, voice: string = 'af_bella'): Promise<Buffer | null> {
  if (!tts) {
    console.warn('[TTS] Model not loaded yet')
    return null
  }
  
  try {
    const audio = await tts.generate(text, { voice })
    
    // Get WAV data as Uint8Array then convert to Buffer
    const wavData = audio.toWav()
    return Buffer.from(wavData)
  } catch (err) {
    console.error('[TTS] Generation failed:', err)
    return null
  }
}

// Generate idle announcement
export async function generateIdleAnnouncement(sessionTitle: string): Promise<Buffer | null> {
  return generateSpeech(`${sessionTitle} is idle`)
}
