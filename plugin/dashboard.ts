import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { homedir, hostname as getHostname } from "os"

// ============================================
// Helper functions
// ============================================
function getFileExtension(filePath: string): string | null {
  const fileName = filePath.split("/").pop() || ""
  const match = fileName.match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : null
}

function countLines(text: string | undefined): number {
  if (!text) return 0
  return text.split("\n").length
}

// ============================================
// Config types
// ============================================
interface DashboardConfig {
  url: string
  apiKey?: string
  hostname: string
}

// ============================================
// Simple TOML parser (key = "value" format only)
// Handles: url = "http://...", apiKey = "xxx", hostname = "myhost"
// ============================================
function parseSimpleToml(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split("\n")
  
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue
    
    // Match: key = "value" or key = 'value' or key = value
    const match = trimmed.match(/^(\w+)\s*=\s*["']?([^"'\r\n]*)["']?\s*$/)
    if (match) {
      result[match[1]] = match[2]
    }
  }
  return result
}

// ============================================
// Load config from file path
// ============================================
function loadConfigFile(configPath: string): Record<string, string> | null {
  try {
    if (!existsSync(configPath)) return null
    const content = readFileSync(configPath, "utf-8")
    return parseSimpleToml(content)
  } catch {
    return null
  }
}

// ============================================
// Load config with priority: project > global > defaults
// ============================================
function loadConfig(directory: string): DashboardConfig {
  let config: Record<string, string> = {}
  
  // 1. Global config: ~/.config/opencode/dashboard.toml
  const globalPath = join(homedir(), ".config", "opencode", "dashboard.toml")
  const globalConfig = loadConfigFile(globalPath)
  if (globalConfig) {
    config = { ...globalConfig }
  }
  
  // 2. Project config: .opencode/dashboard.toml (overrides global)
  const projectPath = join(directory, ".opencode", "dashboard.toml")
  const projectConfig = loadConfigFile(projectPath)
  if (projectConfig) {
    config = { ...config, ...projectConfig }
  }
  
  // 3. Apply defaults
  return {
    url: config.url || "http://localhost:3000",
    apiKey: config.apiKey,
    hostname: config.hostname || getHostname()
  }
}

// ============================================
// Plugin export
// ============================================
export const DashboardPlugin: Plugin = async ({ directory }) => {
  const config = loadConfig(directory || process.cwd())
  const BACKEND_URL = `${config.url}/events`
  
  // Store last message per session - only send on idle
  const pendingMessages = new Map<string, string>()
  
  // Track last model used per session — captured from message.updated streaming events
  const pendingModels = new Map<string, { modelId: string; providerId: string }>()
  
  // Track which messages we've already sent tokens for (prevent duplicates)
  const sentTokenMessages = new Set<string>()
  
  // Dedup: track last idle send time per session to prevent duplicate bing sounds
  // OpenCode's cancel() can fire session.status idle multiple times rapidly
  const lastIdleSent = new Map<string, number>()
  const IDLE_DEDUP_MS = 2000 // ignore duplicate idle events within 2 seconds
  
  // Track sessions that were just aborted (ESC) — abort fires session.error THEN session.status idle
  // We suppress the bing on session.error for aborts, but still need to send session.idle
  // so backend knows session is idle — just without a bing-triggering event
  const recentAborts = new Set<string>()
  
  // Send event to backend. Returns promise so callers can await if ordering matters.
  function send(payload: any): Promise<void> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (config.apiKey) {
      headers["X-API-Key"] = config.apiKey
    }
    
    return fetch(BACKEND_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ 
        ...payload, 
        instance: directory,
        hostname: config.hostname,
        timestamp: Date.now() 
      })
    }).then(() => {}).catch(() => {})
  }
  
  return {
    event: async ({ event }) => {
      const props = (event as any).properties
      
      switch (event.type) {
        case "session.created": {
          const session = props?.info
          if (session) {
            send({
              type: "session.created",
              sessionId: session.id,
              parentSessionId: session.parentID,
              title: session.title || "Untitled Session"
            })
          }
          break
        }
        
        case "session.updated": {
          const session = props?.info
          if (session) {
            send({
              type: "session.updated",
              sessionId: session.id,
              title: session.title
            })
          }
          break
        }
          
        // Handle session.status - only send pending message, don't spam timeline
        case "session.status": {
          const sessionId = props?.sessionID
          const status = props?.status
          if (sessionId && status) {
            if (status.type === "idle") {
              // Dedup: skip if we already sent idle for this session recently
              const now = Date.now()
              const lastSent = lastIdleSent.get(sessionId) || 0
              if (now - lastSent < IDLE_DEDUP_MS) break
              lastIdleSent.set(sessionId, now)
              
              // Wait briefly — cancel() fires idle BEFORE processor fires session.error
              // This gives the abort error time to arrive and set recentAborts flag
              await new Promise(r => setTimeout(r, 150))
              
              // Check if this idle follows an abort — if so, skip bing entirely
              // User pressed ESC → they don't need a notification for their own action
              if (recentAborts.has(sessionId)) {
                recentAborts.delete(sessionId)
                // Still tell backend session is idle, but mark silent so it skips broadcast
                send({ type: "session.idle", sessionId, silent: true })
                break
              }
              
              // Send pending message first, THEN idle — order matters so backend
              // processes timeline before marking session idle (which triggers bing)
              const msg = pendingMessages.get(sessionId)
              if (msg) {
                const model = pendingModels.get(sessionId)
                await send({
                  type: "timeline",
                  eventType: "message",
                  sessionId,
                  summary: msg,
                  // Include model info so timeline events show which model responded
                  ...(model && { modelId: model.modelId, providerId: model.providerId })
                })
                pendingMessages.delete(sessionId)
                pendingModels.delete(sessionId)
              }
              // Now safe to mark idle — backend won't flip status back to active
              send({ type: "session.idle", sessionId })
            }
            // Don't send busy/idle to timeline - too noisy
          }
          break
        }
          
        // Deprecated session.idle - ignore, handled by session.status
        case "session.idle": {
          // Skip - session.status handles this now
          break
        }
          
        case "session.error": {
          const sessionId = props?.sessionID
          const errorMsg = props?.error?.data?.message || props?.error?.name || "Unknown error"
          
          // User-initiated cancel (ESC) fires "The operation was aborted." — not a real error
          // Don't bing, don't send error event, just log it in timeline as info
          const isAbort = errorMsg.includes("aborted") || errorMsg.includes("AbortError")
          if (isAbort && sessionId) {
            // Mark this session as recently aborted so idle handler knows to skip pending msg
            recentAborts.add(sessionId)
            // Still record in timeline so user sees it happened, but as a mild event
            send({
              type: "timeline",
              eventType: "error",
              sessionId,
              summary: "Cancelled"
            })
            // Clear partial AI response — abort means incomplete, don't flush garbage
            pendingMessages.delete(sessionId)
            break
          }
          
          // Real errors — send normally with bing
          send({
            type: "timeline",
            eventType: "error",
            sessionId,
            summary: errorMsg
          })
          send({ type: "session.error", sessionId, error: errorMsg })
          break
        }
          
        case "session.compacted": {
          const sessionId = props?.sessionID
          if (sessionId) {
            send({
              type: "timeline",
              eventType: "compacted",
              sessionId,
              summary: "Session compacted"
            })
          }
          break
        }
          
        case "permission.asked": {
          send({
            type: "timeline",
            eventType: "permission",
            sessionId: props?.sessionID,
            summary: `Permission: ${props?.title || props?.type}`
          })
          break
        }
        
        // AI model asked user a question via the question tool — needs attention
        case "question.asked": {
          const questions = props?.questions || []
          // Build summary from first question's text, fallback to header
          const summary = questions[0]?.question || questions[0]?.header || "Question asked"
          send({
            type: "timeline",
            eventType: "question",
            sessionId: props?.sessionID,
            summary: `Question: ${summary}`
          })
          break
        }
        
        case "message.updated": {
          const msg = props?.info
          
          // Track model for this session — available on every streaming update
          // Used when flushing pending message on idle so timeline events have model_id
          if (msg?.role === "assistant" && msg?.modelID && msg?.sessionID) {
            pendingModels.set(msg.sessionID, { modelId: msg.modelID, providerId: msg.providerID || "" })
          }
          
          // Only count tokens when message is FINISHED (has finish field)
          // message.updated fires on every streaming update - we only want final count
          if (msg?.role === "assistant" && msg?.tokens && msg?.finish && !sentTokenMessages.has(msg.id)) {
            // Mark as sent to prevent duplicates
            sentTokenMessages.add(msg.id)
            // Calculate duration from message's own timestamps (reliable)
            // time.created = when message started, time.completed = when finished
            const durationMs = msg.time?.created 
              ? (msg.time?.completed || Date.now()) - msg.time.created 
              : null
            
            // OpenCode's msg.tokens.input already excludes cached tokens (adjusted by provider)
            // Cache read/write are tracked separately - don't add to input or we double-count
            const rawInput = msg.tokens.input || 0
            const cacheRead = msg.tokens.cache?.read || 0
            const cacheWrite = msg.tokens.cache?.write || 0
            
            send({
              type: "tokens",
              sessionId: msg.sessionID,
              messageId: msg.id,
              providerId: msg.providerID,
              modelId: msg.modelID,
              agent: msg.mode || "unknown",  // agent mode: code, ask, plan, etc.
              tokensIn: rawInput,  // Don't add cacheRead - already excluded by opencode
              tokensOut: msg.tokens.output || 0,
              cacheRead: cacheRead,
              cacheWrite: cacheWrite,
              reasoning: msg.tokens.reasoning || 0,
              cost: msg.cost || 0,
              durationMs  // time from step-start to finish
            })
          }
          break
        }
          
        case "message.part.updated": {
          const part = props?.part
          
          // Store message text, don't send until idle
          if (part?.type === "text" && part?.text) {
            const text = part.text.trim()
            if (text.length > 0 && part.sessionID) {
              pendingMessages.set(part.sessionID, text)
            }
          }
          break
        }
      }
    },
    
    // Capture user messages
    "chat.message": async (input, output) => {
      const parts = output.parts || []
      const textParts = parts.filter((p: any) => p?.type === "text" && p?.text).map((p: any) => p.text)
      const prompt = textParts.join("\n").trim()
      if (prompt) {
        send({
          type: "timeline",
          eventType: "user",
          sessionId: input.sessionID,
          summary: prompt
        })
      }
    },

    "tool.execute.before": async (input, output) => {
      const args = output.args || {}
      let detail = ""
      
      if (input.tool === "read" || input.tool === "write" || input.tool === "edit") {
        detail = args.filePath?.split("/").slice(-2).join("/") || ""
      } else if (input.tool === "bash") {
        const cmd = args.command || ""
        detail = cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd
      } else if (input.tool === "glob" || input.tool === "grep") {
        detail = args.pattern || ""
      } else if (input.tool === "task") {
        detail = args.description || ""
      } else if (input.tool === "pty_spawn" || input.tool === "pty_read" || input.tool === "pty_write") {
        detail = args.title || args.id || ""
      }
      
      send({
        type: "timeline",
        eventType: "tool",
        sessionId: input.sessionID,
        tool: input.tool,
        summary: detail
      })
      
      // Track lines of code for edit/write operations
      if (input.tool === "edit" || input.tool === "write") {
        const filePath = args.filePath || ""
        const fileExtension = getFileExtension(filePath)
        
        let linesAdded = 0
        let linesRemoved = 0
        
        if (input.tool === "edit") {
          // Edit: count old vs new lines
          linesRemoved = countLines(args.oldString)
          linesAdded = countLines(args.newString)
        } else if (input.tool === "write") {
          // Write: all lines are "added"
          linesAdded = countLines(args.content)
        }
        
        send({
          type: "file.edit",
          sessionId: input.sessionID,
          filePath,
          fileExtension,
          operation: input.tool,
          linesAdded,
          linesRemoved
        })
      }
    }
  }
}
