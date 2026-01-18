import { Shield, Activity, Clock } from "lucide-react"

interface HeaderProps {
  currentTime: Date
  isMonitoring: boolean
}

export function Header({ currentTime, isMonitoring }: HeaderProps) {
  return (
    <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              {isMonitoring && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-success animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">RealityCheck</h1>
              <p className="text-xs text-muted-foreground">AI Detection Learning Tool</p>
            </div>
          </div>

          {/* Center - Status */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border">
              <Activity className={`w-4 h-4 ${isMonitoring ? "text-success animate-pulse" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium">
                {isMonitoring ? "Analyzing Content" : "Ready to Learn"}
              </span>
            </div>
          </div>

          {/* Right - Time & Info */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <div className="flex items-center gap-2 text-sm font-mono">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">
                  {currentTime.toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {currentTime.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="w-px h-8 bg-border hidden sm:block" />
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
              <span className="text-xs font-medium">RC</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

