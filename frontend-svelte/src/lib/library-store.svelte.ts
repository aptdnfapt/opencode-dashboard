import type { ActivityWindow, LibraryActivitySummary, Session } from './types'

const MARKER_STEP_MS = 4 * 60 * 60 * 1000
const DEFAULT_SEGMENT_GAP_MINUTES = 30
const DEFAULT_GROUP_GAP_MINUTES = 10
const PX_PER_HOUR = 128
const PX_PER_MS = PX_PER_HOUR / (60 * 60 * 1000)
const MIN_BLOCK_WIDTH = 120
const CANVAS_LEFT_PAD = 80
const CANVAS_RIGHT_PAD = 240
const FILTERS_STORAGE_KEY = 'library_filters_v2'
const VIEW_STORAGE_KEY = 'library_view_v2'
const GROUP_GAP_STORAGE_KEY = 'dashboard_library_group_gap_minutes'
const ACTIVITY_GAP_STORAGE_KEY = 'dashboard_library_activity_gap_minutes'

export type LibraryView = 'timeline' | 'database'
export type LibraryTimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'all'
export type ChamberFilter = 'all' | 'tracked-or-done' | 'tracked-only' | 'done-only' | 'non-chamber'
export type LaneType = 'tag' | 'tracked' | 'manual'

export interface LibraryFilters {
  projects: string[]
  tags: string[]
  search: string
  timeRange: LibraryTimeRange
  chamber: ChamberFilter
  showTagged: boolean
  showManual: boolean
}

export interface TimeMarker {
  time: number
  left: number
  label: string
}

export interface TimelineBlock {
  id: string
  sessionId: string
  projectId: string
  title: string
  status: Session['status']
  groupTag: string | null
  isTracked: boolean
  isCompletedViaChamber: boolean
  isSubagent: boolean
  hasSubagentActivity: boolean
  segmentIndex: number
  segmentCount: number
  startAt: number
  endAt: number
  left: number
  renderLeft: number
  width: number
  stackIndex: number
  overlapCount: number
  zIndex: number
  displayName: string
  displayMeta: string
  lineageLabel: string | null
}

export interface GroupedContainer {
  id: string
  projectId: string
  groupTag: string
  left: number
  width: number
  startAt: number
  endAt: number
  blocks: TimelineBlock[]
  maxStack: number
}

export interface TimelineLane {
  id: string
  type: LaneType
  label: string
  tag: string | null
  blocks: TimelineBlock[]
  containers: GroupedContainer[]
  maxStack: number
}

export interface ProjectTrack {
  projectId: string
  projectName: string
  lanes: TimelineLane[]
  height: number
  lastActivity: number
}

export interface DatabaseRow {
  session: Session
  activity: LibraryActivitySummary | null
  projectName: string
  relationLabel: string
  relationTone: 'tag' | 'done' | 'tracked' | 'manual' | 'subagent'
  lastActiveAt: number
  durationMs: number
}

export interface TimelineModel {
  startTime: number
  endTime: number
  markers: TimeMarker[]
  canvasWidth: number
  tracks: ProjectTrack[]
  totalProjects: number
  totalSessions: number
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function cloneFilters(filters: LibraryFilters): LibraryFilters {
  return {
    projects: [...filters.projects],
    tags: [...filters.tags],
    search: filters.search,
    timeRange: filters.timeRange,
    chamber: filters.chamber,
    showTagged: filters.showTagged,
    showManual: filters.showManual
  }
}

class LibraryStore {
  sessions = $state<Session[]>([])
  activityMap = $state<Map<string, LibraryActivitySummary>>(new Map())
  activityGapMinutes = $state(DEFAULT_SEGMENT_GAP_MINUTES)
  groupGapMinutes = $state(DEFAULT_GROUP_GAP_MINUTES)
  initializedFromBrowser = $state(false)
  selectedSessionId = $state<string | null>(null)
  activeView = $state<LibraryView>('timeline')
  filters = $state<LibraryFilters>({
    projects: [],
    tags: [],
    search: '',
    timeRange: '6h',
    chamber: 'all',
    showTagged: true,
    showManual: true
  })

  availableProjects = $derived(this.computeAvailableProjects())
  availableTags = $derived(this.computeAvailableTags())
  filteredSessions = $derived(this.computeFilteredSessions())
  timelineModel = $derived(this.computeTimelineModel())
  databaseRows = $derived(this.computeDatabaseRows())

  hydrateFromBrowser() {
    if (!isBrowser() || this.initializedFromBrowser) return
    this.initializedFromBrowser = true

    try {
      const rawFilters = window.localStorage.getItem(FILTERS_STORAGE_KEY)
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters) as Partial<LibraryFilters>
        this.filters = {
          projects: Array.isArray(parsed.projects) ? parsed.projects : [],
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          search: typeof parsed.search === 'string' ? parsed.search : '',
          timeRange: parsed.timeRange ?? '6h',
          chamber: parsed.chamber ?? 'all',
          showTagged: parsed.showTagged ?? true,
          showManual: parsed.showManual ?? true
        }
      }

      const rawView = window.localStorage.getItem(VIEW_STORAGE_KEY)
      if (rawView === 'timeline' || rawView === 'database') {
        this.activeView = rawView
      }

      const rawGroupGap = window.localStorage.getItem(GROUP_GAP_STORAGE_KEY)
      if (rawGroupGap) {
        const parsed = parseInt(rawGroupGap, 10)
        if (!Number.isNaN(parsed)) this.groupGapMinutes = Math.max(1, Math.min(parsed, 120))
      }

      const rawActivityGap = window.localStorage.getItem(ACTIVITY_GAP_STORAGE_KEY)
      if (rawActivityGap) {
        const parsed = parseInt(rawActivityGap, 10)
        if (!Number.isNaN(parsed)) this.activityGapMinutes = Math.max(5, Math.min(parsed, 180))
      }
    } catch (error) {
      console.warn('Failed to hydrate Library preferences', error)
    }
  }

  setSessions(sessions: Session[]) {
    this.sessions = [...sessions].sort((a, b) => b.updated_at - a.updated_at)
  }

  setActivities(activities: LibraryActivitySummary[], gapMinutes = DEFAULT_SEGMENT_GAP_MINUTES) {
    this.activityGapMinutes = gapMinutes
    this.activityMap = new Map(activities.map((item) => [item.sessionId, item]))
  }

  setGroupGapMinutes(minutes: number) {
    this.groupGapMinutes = Math.max(1, Math.min(minutes, 120))
    if (isBrowser()) window.localStorage.setItem(GROUP_GAP_STORAGE_KEY, String(this.groupGapMinutes))
  }

  setActivityGapMinutes(minutes: number) {
    this.activityGapMinutes = Math.max(5, Math.min(minutes, 180))
    if (isBrowser()) window.localStorage.setItem(ACTIVITY_GAP_STORAGE_KEY, String(this.activityGapMinutes))
  }

  setSelected(sessionId: string | null) {
    this.selectedSessionId = sessionId
  }

  setView(view: LibraryView) {
    this.activeView = view
    if (isBrowser()) {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view)
    }
  }

  toggleProject(project: string) {
    this.filters = {
      ...this.filters,
      projects: this.filters.projects.includes(project)
        ? this.filters.projects.filter((item) => item !== project)
        : [...this.filters.projects, project]
    }
    this.persistFilters()
  }

  toggleTag(tag: string) {
    this.filters = {
      ...this.filters,
      tags: this.filters.tags.includes(tag)
        ? this.filters.tags.filter((item) => item !== tag)
        : [...this.filters.tags, tag]
    }
    this.persistFilters()
  }

  setTimeRange(timeRange: LibraryTimeRange) {
    this.filters = { ...this.filters, timeRange }
    this.persistFilters()
  }

  setSearch(search: string) {
    this.filters = { ...this.filters, search }
    this.persistFilters()
  }

  setChamberFilter(chamber: ChamberFilter) {
    this.filters = { ...this.filters, chamber }
    this.persistFilters()
  }

  setVisibility(type: 'tagged' | 'manual', enabled: boolean) {
    if (type === 'tagged') {
      this.filters = { ...this.filters, showTagged: enabled }
    } else {
      this.filters = { ...this.filters, showManual: enabled }
    }
    this.persistFilters()
  }

  clearFilters() {
    this.filters = {
      projects: [],
      tags: [],
      search: '',
      timeRange: '6h',
      chamber: 'all',
      showTagged: true,
      showManual: true
    }
    this.persistFilters()
  }

  persistFilters() {
    if (!isBrowser()) return
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(cloneFilters(this.filters)))
  }

  private computeAvailableProjects(): string[] {
    return Array.from(new Set(this.sessions.map((session) => session.directory || 'unknown'))).sort()
  }

  private computeAvailableTags(): string[] {
    return Array.from(
      new Set(
        this.sessions
          .map((session) => session.group_tag)
          .filter((tag): tag is string => Boolean(tag))
      )
    ).sort()
  }

  private computeFilteredSessions(): Session[] {
    const now = Date.now()
    const rangeStart = this.getRangeStart(now)

    return this.sessions.filter((session) => {
      const projectId = session.directory || 'unknown'
      const activity = this.activityMap.get(session.id)
      const windows = activity?.continuityWindows.length
        ? activity.continuityWindows
        : [{ start: session.created_at, end: session.updated_at, source: 'self' as const }]

      if (this.filters.search) {
        const needle = this.filters.search.toLowerCase()
        const haystack = `${session.title} ${projectId} ${session.group_tag || ''}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }

      if (this.filters.projects.length > 0 && !this.filters.projects.includes(projectId)) {
        return false
      }

      if (this.filters.tags.length > 0 && (!session.group_tag || !this.filters.tags.includes(session.group_tag))) {
        return false
      }

      if (session.group_tag && !this.filters.showTagged) return false
      if (!session.group_tag && !session.is_tracked && !session.completed_at && !this.filters.showManual) return false

      switch (this.filters.chamber) {
        case 'tracked-or-done':
          if (!session.is_tracked && !session.completed_at) return false
          break
        case 'tracked-only':
          if (!session.is_tracked) return false
          break
        case 'done-only':
          if (!(session.completed_at && session.completed_reason === 'cc_done')) return false
          break
        case 'non-chamber':
          if (session.is_tracked || session.completed_at) return false
          break
      }

      if (rangeStart !== null) {
        const intersectsRange = windows.some((window) => window.end >= rangeStart)
        if (!intersectsRange) return false
      }

      return true
    })
  }

  private computeDatabaseRows(): DatabaseRow[] {
    return this.filteredSessions
      .map((session) => {
        const activity = this.activityMap.get(session.id) || null
        const lastActiveAt = activity?.continuityWindows.length
          ? Math.max(...activity.continuityWindows.map((window) => window.end))
          : session.updated_at
        const relationTone: DatabaseRow['relationTone'] = session.parent_session_id
          ? 'subagent'
          : session.group_tag
            ? 'tag'
            : session.completed_at && session.completed_reason === 'cc_done'
              ? 'done'
              : session.is_tracked
                ? 'tracked'
                : 'manual'
        const relationLabel = session.parent_session_id
          ? 'Subagent'
          : session.group_tag
            ? session.group_tag
            : session.completed_at && session.completed_reason === 'cc_done'
              ? 'Chamber Done'
              : session.is_tracked
                ? 'Tracked'
                : 'Manual'

        return {
          session,
          activity,
          projectName: this.extractProjectName(session.directory || 'unknown'),
          relationLabel,
          relationTone,
          lastActiveAt,
          durationMs: Math.max(lastActiveAt - session.created_at, session.updated_at - session.created_at)
        }
      })
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  }

  private computeTimelineModel(): TimelineModel {
    const sessionMap = new Map(this.filteredSessions.map((session) => [session.id, session]))
    const topLevelSessions = this.filteredSessions.filter(
      (session) => !session.parent_session_id || !sessionMap.has(session.parent_session_id)
    )

    const blocks = topLevelSessions.flatMap((session) => this.createBlocksForSession(session))
    if (blocks.length === 0) {
      const start = Date.now() - 12 * 60 * 60 * 1000
      const end = Date.now() + 12 * 60 * 60 * 1000
      return {
        startTime: start,
        endTime: end,
        markers: this.buildMarkers(start, end),
        canvasWidth: 1600,
        tracks: [],
        totalProjects: 0,
        totalSessions: 0
      }
    }

    const minStart = Math.min(...blocks.map((block) => block.startAt))
    const maxEnd = Math.max(...blocks.map((block) => block.endAt))
    const timelineStart = this.floorToMarker(minStart)
    const timelineEnd = this.ceilToMarker(maxEnd + MARKER_STEP_MS)

    for (const block of blocks) {
      block.left = CANVAS_LEFT_PAD + Math.round((block.startAt - timelineStart) * PX_PER_MS)
      block.width = Math.max(Math.round((block.endAt - block.startAt) * PX_PER_MS), MIN_BLOCK_WIDTH)
      block.renderLeft = block.left
    }

    const blocksByProject = new Map<string, TimelineBlock[]>()
    for (const block of blocks) {
      const arr = blocksByProject.get(block.projectId) || []
      arr.push(block)
      blocksByProject.set(block.projectId, arr)
    }

    const tracks = Array.from(blocksByProject.entries()).map(([projectId, projectBlocks]) =>
      this.buildProjectTrack(projectId, projectBlocks)
    ).sort((a, b) => b.lastActivity - a.lastActivity)

    const canvasWidth = CANVAS_LEFT_PAD + Math.round((timelineEnd - timelineStart) * PX_PER_MS) + CANVAS_RIGHT_PAD

    return {
      startTime: timelineStart,
      endTime: timelineEnd,
      markers: this.buildMarkers(timelineStart, timelineEnd),
      canvasWidth,
      tracks,
      totalProjects: tracks.length,
      totalSessions: topLevelSessions.length
    }
  }

  private buildProjectTrack(projectId: string, blocks: TimelineBlock[]): ProjectTrack {
    const tagGroups = new Map<string, TimelineBlock[]>()
    const trackedBlocks: TimelineBlock[] = []
    const manualBlocks: TimelineBlock[] = []

    for (const block of blocks.sort((a, b) => a.startAt - b.startAt)) {
      if (block.groupTag) {
        const arr = tagGroups.get(block.groupTag) || []
        arr.push(block)
        tagGroups.set(block.groupTag, arr)
      } else if (block.isTracked || block.isCompletedViaChamber) {
        trackedBlocks.push(block)
      } else {
        manualBlocks.push(block)
      }
    }

    const lanes: TimelineLane[] = []

    for (const [tag, tagBlocks] of Array.from(tagGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const overlapped = this.applyOverlap(tagBlocks)
      const containers = this.buildContainers(projectId, tag, overlapped)
      lanes.push({
        id: `${projectId}-tag-${tag}`,
        type: 'tag',
        label: `Tag: ${tag}`,
        tag,
        blocks: overlapped,
        containers,
        maxStack: Math.max(0, ...overlapped.map((block) => block.stackIndex))
      })
    }

    if (trackedBlocks.length > 0) {
      const overlapped = this.applyOverlap(trackedBlocks)
      lanes.push({
        id: `${projectId}-tracked`,
        type: 'tracked',
        label: 'Tracked / Chamber',
        tag: null,
        blocks: overlapped,
        containers: [],
        maxStack: Math.max(0, ...overlapped.map((block) => block.stackIndex))
      })
    }

    if (manualBlocks.length > 0) {
      const overlapped = this.applyOverlap(manualBlocks)
      lanes.push({
        id: `${projectId}-manual`,
        type: 'manual',
        label: 'Manual / General',
        tag: null,
        blocks: overlapped,
        containers: [],
        maxStack: Math.max(0, ...overlapped.map((block) => block.stackIndex))
      })
    }

    const laneBase = 72
    const laneGap = 14
    const laneHeight = (lane: TimelineLane) => laneBase + Math.min(lane.maxStack, 3) * 10 + (lane.type === 'tag' ? 16 : 0)
    const totalHeight = lanes.reduce((sum, lane) => sum + laneHeight(lane), 0) + Math.max(0, lanes.length - 1) * laneGap + 32

    return {
      projectId,
      projectName: this.extractProjectName(projectId),
      lanes,
      height: totalHeight,
      lastActivity: Math.max(...blocks.map((block) => block.endAt))
    }
  }

  private createBlocksForSession(session: Session): TimelineBlock[] {
    const activity = this.activityMap.get(session.id)
    const windows = activity?.continuityWindows.length
      ? activity.continuityWindows
      : [{ start: session.created_at, end: session.updated_at, source: 'self' as const }]

    return windows.map((window, index) => {
      const segmentCount = windows.length
      const durationMs = Math.max(window.end - window.start, 60 * 1000)
      const lineageBits: string[] = [this.formatDuration(durationMs)]
      if (segmentCount > 1) lineageBits.push(`seg ${index + 1}/${segmentCount}`)
      if (activity?.hasSubagentActivity) lineageBits.push('subagents')

      return {
        id: `${session.id}::${index}`,
        sessionId: session.id,
        projectId: session.directory || 'unknown',
        title: session.title,
        status: session.status,
        groupTag: session.group_tag,
        isTracked: Boolean(session.is_tracked),
        isCompletedViaChamber: Boolean(session.completed_at && session.completed_reason === 'cc_done'),
        isSubagent: Boolean(session.parent_session_id),
        hasSubagentActivity: activity?.hasSubagentActivity ?? false,
        segmentIndex: index,
        segmentCount,
        startAt: window.start,
        endAt: window.end,
        left: 0,
        renderLeft: 0,
        width: MIN_BLOCK_WIDTH,
        stackIndex: 0,
        overlapCount: 1,
        zIndex: 1,
        displayName: this.truncateTitle(session.title),
        displayMeta: lineageBits.join(' • '),
        lineageLabel: segmentCount > 1 ? `continued ${index + 1}/${segmentCount}` : null
      }
    })
  }

  private applyOverlap(blocks: TimelineBlock[]): TimelineBlock[] {
    const sorted = [...blocks].sort((a, b) => a.startAt - b.startAt)
    const active: TimelineBlock[] = []

    for (const block of sorted) {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        if (active[i].endAt <= block.startAt) active.splice(i, 1)
      }

      const used = new Set(active.map((item) => item.stackIndex))
      let stackIndex = 0
      while (used.has(stackIndex)) stackIndex += 1
      block.stackIndex = stackIndex
      active.push(block)

      const overlapCount = active.length
      for (const item of active) {
        item.overlapCount = Math.max(item.overlapCount, overlapCount)
        item.zIndex = 10 + item.stackIndex
      }
    }

    return sorted
  }

  private buildContainers(projectId: string, tag: string, blocks: TimelineBlock[]): GroupedContainer[] {
    const containers: GroupedContainer[] = []
    let current: TimelineBlock[] = []

    for (const block of blocks) {
      const last = current[current.length - 1]
      if (!last || (block.startAt - last.endAt) <= this.groupGapMinutes * 60 * 1000) {
        current.push(block)
      } else {
        containers.push(this.finalizeContainer(projectId, tag, current))
        current = [block]
      }
    }

    if (current.length > 0) {
      containers.push(this.finalizeContainer(projectId, tag, current))
    }

    return containers
  }

  private finalizeContainer(projectId: string, tag: string, blocks: TimelineBlock[]): GroupedContainer {
    const left = Math.min(...blocks.map((block) => block.left))
    const right = Math.max(...blocks.map((block) => block.left + block.width))
    const startAt = Math.min(...blocks.map((block) => block.startAt))
    const endAt = Math.max(...blocks.map((block) => block.endAt))

    for (const block of blocks) {
      block.renderLeft = block.left - left
    }

    return {
      id: `${projectId}-${tag}-${startAt}`,
      projectId,
      groupTag: tag,
      left,
      width: Math.max(right - left, MIN_BLOCK_WIDTH),
      startAt,
      endAt,
      blocks,
      maxStack: Math.max(0, ...blocks.map((block) => block.stackIndex))
    }
  }

  private buildMarkers(startTime: number, endTime: number): TimeMarker[] {
    const markers: TimeMarker[] = []
    for (let time = startTime; time <= endTime; time += MARKER_STEP_MS) {
      markers.push({
        time,
        left: CANVAS_LEFT_PAD + Math.round((time - startTime) * PX_PER_MS),
        label: this.formatMarkerLabel(time)
      })
    }
    return markers
  }

  private getRangeStart(now: number): number | null {
    switch (this.filters.timeRange) {
      case '1h': return now - 60 * 60 * 1000
      case '6h': return now - 6 * 60 * 60 * 1000
      case '24h': return now - 24 * 60 * 60 * 1000
      case '7d': return now - 7 * 24 * 60 * 60 * 1000
      case '30d': return now - 30 * 24 * 60 * 60 * 1000
      default: return null
    }
  }

  getFetchSince(now = Date.now()): number | null {
    return this.getRangeStart(now)
  }

  private floorToMarker(time: number): number {
    return Math.floor(time / MARKER_STEP_MS) * MARKER_STEP_MS
  }

  private ceilToMarker(time: number): number {
    return Math.ceil(time / MARKER_STEP_MS) * MARKER_STEP_MS
  }

  private formatMarkerLabel(time: number): string {
    return new Date(time).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  private extractProjectName(path: string): string {
    const parts = path.split(/[\/]/)
    return parts[parts.length - 1] || path
  }

  private truncateTitle(title: string, maxLen = 40): string {
    return title.length <= maxLen ? title : `${title.slice(0, maxLen - 3)}...`
  }

  private formatDuration(ms: number): string {
    const mins = Math.round(ms / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remaining = mins % 60
    return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`
  }
}

export const libraryStore = new LibraryStore()
