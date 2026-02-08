# Phase 6: Different Sound for Subagents

## Goal
Play distinct audio when subagent sessions need attention or go idle

## Changes

### 6.1 Add isSubagent flag to broadcasts
**File:** `backend/src/websocket/server.ts`

```typescript
// Update broadcast methods to include isSubagent flag

broadcastIdle(sessionId: string, audioUrl?: string, isSubagent?: boolean): void {
  this.broadcast({
    type: 'idle',
    data: { sessionId, audioUrl, isSubagent }
  })
}

broadcastAttention(sessionId: string, needsAttention: boolean, audioUrl?: string, isSubagent?: boolean): void {
  this.broadcast({
    type: 'attention',
    data: { sessionId, needsAttention, audioUrl, isSubagent }
  })
}
```

### 6.2 Check parent_session_id in webhook
**File:** `backend/src/handlers/webhook.ts`

```typescript
// In session.idle case (~91-106):
const session = db.prepare('SELECT title, parent_session_id FROM sessions WHERE id = ?')
  .get(event.sessionId) as { title: string, parent_session_id: string | null } | null

const isSubagent = !!session?.parent_session_id

// Pass to broadcast
wsManager.broadcastIdle(event.sessionId!, audioUrl, isSubagent)

// Same for attention broadcasts (~131-142)
wsManager.broadcastAttention(event.sessionId!, true, attentionAudioUrl, isSubagent)
```

### 6.3 Generate different TTS for subagents
**File:** `backend/src/services/tts.ts`

```typescript
// Option A: Different voice/pitch
export function generateSignedUrl(text: string, expiryMinutes: number, isSubagent?: boolean): string {
  // Add voice parameter to TTS generation
  const voice = isSubagent ? 'af_sky' : 'af_bella'  // or different pitch
  // ...
}

// Option B: Different text template
const announcement = isSubagent 
  ? `Subagent ${title} is idle`
  : `${title} is idle`
```

### 6.4 Frontend - Handle subagent audio
**File:** `frontend/src/App.tsx`

```typescript
// In handleWSMessage, idle case:
case 'idle':
  updateSession({ id: msg.data.sessionId, status: 'idle' })
  
  // Play different sound for subagents
  if (msg.data.audioUrl) {
    playAudio(msg.data.audioUrl)
  } else if (msg.data.isSubagent) {
    playAudio('/sounds/subagent-idle.mp3')  // Fallback
  } else {
    playAudio('/sounds/idle.mp3')  // Fallback
  }
  break

// Same pattern for attention case
```

### 6.5 Add fallback sound files
**Directory:** `frontend/public/sounds/`

```
sounds/
  idle.mp3           # Main session idle
  attention.mp3      # Main session needs attention  
  subagent-idle.mp3  # Subagent idle (shorter/different tone)
  subagent-attention.mp3  # Subagent needs attention
```

**Note:** Can use free sound effects or generate with TTS offline

## Verification
```bash
# Trigger subagent idle and check:
# 1. Backend log shows isSubagent=true
# 2. Frontend receives isSubagent in WS message
# 3. Different audio plays
```

## Dependencies
- Phase 1 (parent_session_id exists)
- Phase 2 (broadcasts working)

## Blocks
- None
