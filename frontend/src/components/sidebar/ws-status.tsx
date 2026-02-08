import { StatusIndicator } from '@/components/ui/status-indicator'

interface WsStatusProps {
  connected: boolean
}

export function WsStatus({ connected }: WsStatusProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
      <StatusIndicator status={connected ? 'active' : 'error'} />
      <span>{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  )
}
