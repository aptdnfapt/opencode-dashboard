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
  
  // Track message start times for duration calculation
  const messageStartTimes = new Map<string, number>()
  
  // Send event to backend
  function send(payload: any) {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (config.apiKey) {
      headers["X-API-Key"] = config.apiKey
    }
    
    fetch(BACKEND_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ 
        ...payload, 
        instance: directory,
        hostname: config.hostname,
        timestamp: Date.now() 
      })
    }).catch(() => {})
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
              // Send pending message first
              const msg = pendingMessages.get(sessionId)
              if (msg) {
                send({
                  type: "timeline",
                  eventType: "message",
                  sessionId,
                  summary: msg
                })
                pendingMessages.delete(sessionId)
              }
              // Just update session status in DB, no timeline entry
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
        
        case "message.updated": {
          // Only count tokens when message is FINISHED (has finish field)
          // message.updated fires on every streaming update - we only want final count
          const msg = props?.info
          if (msg?.role === "assistant" && msg?.tokens && msg?.finish) {
            // Calculate duration from step-start to now
            const startTime = messageStartTimes.get(msg.id)
            const durationMs = startTime ? Date.now() - startTime : null
            if (startTime) {
              messageStartTimes.delete(msg.id)
            }
            
            // For Anthropic: actual input = input + cache_read (cache_read IS the cached input)
            // For OpenAI: input already contains full count
            const rawInput = msg.tokens.input || 0
            const cacheRead = msg.tokens.cache?.read || 0
            const cacheWrite = msg.tokens.cache?.write || 0
            // Total input = raw input + cache read (Anthropic puts cached tokens in cache.read)
            const totalInput = rawInput + cacheRead
            
            send({
              type: "tokens",
              sessionId: msg.sessionID,
              messageId: msg.id,
              providerId: msg.providerID,
              modelId: msg.modelID,
              agent: msg.mode || "unknown",  // agent mode: code, ask, plan, etc.
              tokensIn: totalInput,
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
          
          // Track when assistant message starts (step-start) for duration calc
          if (part?.type === "step-start" && part?.messageID) {
            messageStartTimes.set(part.messageID, Date.now())
          }
          
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
