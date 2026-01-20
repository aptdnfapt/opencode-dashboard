// backend/src/services/tts.ts
// Kokoro TTS service - loads model once, generates audio on demand

import { KokoroTTS } from 'kokoro-js'
import { createHash } from 'crypto'

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

// Generate signed URL for TTS audio
export function generateSignedUrl(text: string, expiresInMinutes: number = 5): string {
  const expiry = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60)
  const serverKey = process.env.FRONTEND_PASSWORD || 'default-key'

  // Create signature: HMAC-SHA256(text + expiry, key)
  const dataToSign = `${text}${expiry}`
  const signature = createHash('sha256')
    .update(dataToSign + serverKey)
    .digest('hex')
    .substring(0, 32) // First 32 hex chars (16 bytes) to match frontend

  return `/api/tts?text=${encodeURIComponent(text)}&exp=${expiry}&sig=${signature}`
}

// Verify signed URL
export function verifySignedUrl(text: string, expiry: string, signature: string): boolean {
  const serverKey = process.env.FRONTEND_PASSWORD || 'default-key'
  const now = Math.floor(Date.now() / 1000)

  // Check expiry
  if (parseInt(expiry) < now) {
    return false
  }

  // Verify signature
  const dataToSign = `${text}${expiry}`
  const expectedSignature = createHash('sha256')
    .update(dataToSign + serverKey)
    .digest('hex')
    .substring(0, 32)

  return signature === expectedSignature
}

// Generate idle announcement
export async function generateIdleAnnouncement(sessionTitle: string): Promise<Buffer | null> {
  return generateSpeech(`${sessionTitle} is idle`)
}
