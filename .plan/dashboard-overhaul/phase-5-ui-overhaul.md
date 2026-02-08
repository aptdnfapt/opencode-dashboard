# Phase 5: UI Overhaul

## Goal
Complete UI rewrite with sidebar, project grouping, and session hierarchy

## Target Layout
```
+------------------------------------------------------------------+
| Header: Logo + Search + WS Status                                |
+----------------+-------------------------------------------------+
| SIDEBAR [240px]|  MAIN CONTENT                                   |
|                |                                                 |
| > Projects     |  Stats Bar: Active * Idle o Error x            |
|   +- proj-a  * |                                                 |
|   |  +- Main   |  +-------------------------------------------+  |
|   |  +- @glm * |  | Session Cards (expandable)                |  |
|   +- proj-b  o |  |  +---------------------------------------+|  |
|   +- proj-c    |  |  | * Fix auth bug      12k tokens        ||  |
|                |  |  |   +- @glm: DB sync  *                 ||  |
| > Filters      |  |  |   +- @general: UI   o                 ||  |
|   Status v     |  |  +---------------------------------------+|  |
|   Hostname v   |  +-------------------------------------------+  |
|----------------|                                                 |
| WS: * Online   |                                                 |
+----------------+-------------------------------------------------+
```

## Changes

### 5.1 Install shadcn components
```bash
cd frontend
npx shadcn@latest add sidebar
npx shadcn@latest add collapsible
npx shadcn@latest add resizable
```

### 5.2 Create ProjectSidebar component
**New file:** `frontend/src/components/sidebar/project-sidebar.tsx`

```typescript
// Structure:
// - SidebarProvider wrapper
// - Sidebar with:
//   - SidebarHeader (logo)
//   - SidebarContent
//     - SidebarGroup "Projects" (collapsible)
//       - ProjectTree items
//     - SidebarGroup "Filters"
//       - Status select
//       - Hostname select
//   - SidebarFooter (WS status)
```

### 5.3 Create SessionTree component
**New file:** `frontend/src/components/sidebar/session-tree.tsx`

```typescript
// Shows sessions grouped by project with hierarchy:
// - Project folder (collapsible)
//   - Main sessions
//     - Child sessions (subagents)

// Uses parent_session_id to build tree
function buildSessionTree(sessions: Session[]): ProjectNode[] {
  // Group by directory
  // Within each directory, nest children under parents
  // Return tree structure
}
```

### 5.4 Update SessionCard - Expandable with children
**File:** `frontend/src/components/sessions/session-card.tsx`

```typescript
// Add props
interface SessionCardProps {
  session: Session
  children?: Session[]  // ADD - child sessions
  expanded?: boolean    // ADD
  onToggle?: () => void // ADD
}

// Render children when expanded
{expanded && children?.map(child => (
  <SessionCard 
    key={child.id} 
    session={child} 
    isChild  // smaller styling
  />
))}
```

### 5.5 Status indicators with animations
**File:** `frontend/src/components/ui/status-indicator.tsx`

```typescript
// New component
export function StatusIndicator({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative rounded-full h-2 w-2 bg-emerald-500" />
      </span>
    )
  }
  // idle: solid amber dot
  // error: solid rose dot
  // stale: gray dot
}
```

### 5.6 WebSocket connection badge
**File:** `frontend/src/components/sidebar/ws-status.tsx`

```typescript
export function WsStatus({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <StatusIndicator status={connected ? 'active' : 'error'} />
      <span>{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  )
}
```

### 5.7 Update App.tsx - New layout structure
**File:** `frontend/src/App.tsx`

```typescript
// Replace current layout with:
<SidebarProvider>
  <ProjectSidebar 
    projects={projects}
    sessions={sessions}
    filters={filters}
    wsConnected={wsConnected}
  />
  <SidebarInset>
    <Header />
    <main>
      <Routes>
        {/* ... */}
      </Routes>
    </main>
  </SidebarInset>
</SidebarProvider>
```

### 5.8 Persist sidebar state
**File:** `frontend/src/hooks/use-sidebar-state.ts`

```typescript
// New hook
export function useSidebarState() {
  const [expanded, setExpanded] = useLocalStorage('sidebar-expanded', true)
  const [expandedProjects, setExpandedProjects] = useLocalStorage('expanded-projects', [])
  // ...
}
```

## New Files Summary
```
frontend/src/components/
  sidebar/
    project-sidebar.tsx
    session-tree.tsx
    ws-status.tsx
  ui/
    status-indicator.tsx
    sidebar.tsx (from shadcn)
    collapsible.tsx (from shadcn)
    resizable.tsx (from shadcn)
  hooks/
    use-sidebar-state.ts
```

## Verification
```bash
cd frontend && bun run dev
# Visual check: sidebar renders, projects group, sessions nest
```

## Dependencies
- Phase 1 (parent_session_id for hierarchy)
- Phase 3 (real-time updates working)
- Phase 4 (/api/projects endpoint)

## Blocks
- None (final UI phase)
