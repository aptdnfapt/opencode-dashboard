import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { ProjectSidebar } from '@/components/sidebar/project-sidebar'
import type { Session } from '@/store'

interface AppLayoutProps {
  children: React.ReactNode
  sessions: Session[]
  wsConnected: boolean
  selectedDirectory: string
  onSelectDirectory: (dir: string) => void
}

export function AppLayout({ 
  children, 
  sessions, 
  wsConnected,
  selectedDirectory,
  onSelectDirectory 
}: AppLayoutProps) {
  return (
    <SidebarProvider>
      <ProjectSidebar 
        sessions={sessions}
        wsConnected={wsConnected}
        selectedDirectory={selectedDirectory}
        onSelectDirectory={onSelectDirectory}
      />
      <SidebarInset>
        {/* Mobile header with sidebar trigger */}
        <header className="md:hidden flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="font-semibold">OpenCode</span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
