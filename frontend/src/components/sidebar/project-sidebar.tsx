import { useState, useMemo } from 'react'
import { ChevronRight, Folder, FolderOpen, Filter, Terminal } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { WsStatus } from './ws-status'
import type { Session } from '@/store'

interface ProjectSidebarProps {
  sessions: Session[]
  wsConnected: boolean
  selectedDirectory: string
  onSelectDirectory: (dir: string) => void
}

// Group sessions by directory
function groupByDirectory(sessions: Session[]) {
  const groups = new Map<string, Session[]>()
  
  for (const session of sessions) {
    const dir = session.directory || 'Unknown'
    const existing = groups.get(dir) || []
    groups.set(dir, [...existing, session])
  }
  
  return groups
}

// Get dominant status for a project (priority: active > error > idle > old)
function getProjectStatus(sessions: Session[]): 'active' | 'idle' | 'error' | 'old' {
  if (sessions.some(s => s.status === 'active')) return 'active'
  if (sessions.some(s => s.status === 'error')) return 'error'
  if (sessions.some(s => s.status === 'idle')) return 'idle'
  return 'old'
}

export function ProjectSidebar({ 
  sessions, 
  wsConnected, 
  selectedDirectory,
  onSelectDirectory 
}: ProjectSidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  
  // Group sessions by directory
  const projectGroups = useMemo(() => groupByDirectory(sessions), [sessions])
  
  // Sort projects: active first, then by name
  const sortedProjects = useMemo(() => {
    return Array.from(projectGroups.entries()).sort(([dirA, sessionsA], [dirB, sessionsB]) => {
      const statusA = getProjectStatus(sessionsA)
      const statusB = getProjectStatus(sessionsB)
      
      // Active projects first
      if (statusA === 'active' && statusB !== 'active') return -1
      if (statusB === 'active' && statusA !== 'active') return 1
      
      // Then alphabetical
      return dirA.localeCompare(dirB)
    })
  }, [projectGroups])

  const toggleProject = (dir: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(dir)) {
        next.delete(dir)
      } else {
        next.add(dir)
      }
      return next
    })
  }

  const handleSelectDirectory = (dir: string) => {
    // Toggle: if already selected, clear filter
    onSelectDirectory(selectedDirectory === dir ? '' : dir)
  }

  // Extract just the project name from full path
  const getProjectName = (dir: string) => {
    const parts = dir.split('/')
    return parts[parts.length - 1] || dir
  }

  return (
    <Sidebar>
      {/* Header with logo */}
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2">
          <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Terminal className="size-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">OpenCode</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Projects section */}
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sortedProjects.map(([dir, projectSessions]) => {
                const isExpanded = expandedProjects.has(dir)
                const projectStatus = getProjectStatus(projectSessions)
                const activeCount = projectSessions.filter(s => s.status === 'active').length
                const isSelected = selectedDirectory === dir
                
                return (
                  <Collapsible
                    key={dir}
                    open={isExpanded}
                    onOpenChange={() => toggleProject(dir)}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton 
                          isActive={isSelected}
                          onClick={(e) => {
                            // Right side click = toggle expand, left side = filter
                            const rect = e.currentTarget.getBoundingClientRect()
                            const clickX = e.clientX - rect.left
                            if (clickX > rect.width - 40) {
                              // Click on chevron area - just toggle
                              return
                            }
                            e.preventDefault()
                            handleSelectDirectory(dir)
                          }}
                        >
                          {isExpanded ? (
                            <FolderOpen className="size-4 text-amber-500" />
                          ) : (
                            <Folder className="size-4 text-muted-foreground" />
                          )}
                          <span className="flex-1 truncate">{getProjectName(dir)}</span>
                          <div className="flex items-center gap-2">
                            {activeCount > 0 && (
                              <span className="text-xs text-muted-foreground">{activeCount}</span>
                            )}
                            <StatusIndicator status={projectStatus} />
                            <ChevronRight className={`size-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {projectSessions.slice(0, 5).map(session => (
                            <SidebarMenuSubItem key={session.id}>
                              <SidebarMenuSubButton asChild>
                                <a href={`/session/${session.id}`} className="flex items-center gap-2">
                                  <StatusIndicator status={session.status} />
                                  <span className="truncate flex-1">{session.title || 'Untitled'}</span>
                                </a>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                          {projectSessions.length > 5 && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild>
                                <span className="text-muted-foreground text-xs">
                                  +{projectSessions.length - 5} more
                                </span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
              
              {sortedProjects.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-muted-foreground text-sm">No projects yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Filters section */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Filter className="size-4 mr-2" />
            Filters
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={selectedDirectory === ''}
                  onClick={() => onSelectDirectory('')}
                >
                  <span>All Projects</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with WS status */}
      <SidebarFooter>
        <WsStatus connected={wsConnected} />
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  )
}
