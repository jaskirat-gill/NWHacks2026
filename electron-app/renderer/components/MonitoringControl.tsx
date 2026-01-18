import { Play, Square, Zap, Radio } from "lucide-react"

interface MonitoringControlProps {
  isMonitoring: boolean
  onStart: () => void
  onStop: () => void
}

export function MonitoringControl({ isMonitoring, onStart, onStop }: MonitoringControlProps) {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Monitoring
        </h2>
        <div className={`px-2 py-1 rounded-md text-xs font-medium ${
          isMonitoring 
            ? "bg-success/10 text-success border border-success/20" 
            : "bg-muted text-muted-foreground border border-border"
        }`}>
          {isMonitoring ? "ONLINE" : "OFFLINE"}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="relative">
        <div className={`aspect-square rounded-xl border-2 ${
          isMonitoring ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"
        } flex items-center justify-center overflow-hidden transition-all duration-500`}>
          {/* Animated rings */}
          {isMonitoring && (
            <>
              <div className="absolute w-16 h-16 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: "2s" }} />
              <div className="absolute w-24 h-24 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: "3s" }} />
              <div className="absolute w-32 h-32 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: "4s" }} />
            </>
          )}
          
          {/* Center icon */}
          <div className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            isMonitoring 
              ? "bg-primary/20 shadow-[0_0_30px_rgba(0,200,200,0.3)]" 
              : "bg-muted"
          }`}>
            {isMonitoring ? (
              <Radio className="w-6 h-6 text-primary" />
            ) : (
              <Zap className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Metrics when active */}
      {isMonitoring && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold font-mono text-primary">24/7</div>
            <div className="text-xs text-muted-foreground">Coverage</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold font-mono text-primary">{'<'}1s</div>
            <div className="text-xs text-muted-foreground">Latency</div>
          </div>
        </div>
      )}

      {/* Control Button */}
      {!isMonitoring ? (
        <button
          onClick={onStart}
          className="w-full py-3.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,200,200,0.2)] hover:shadow-[0_0_30px_rgba(0,200,200,0.3)]"
        >
          <Play className="w-4 h-4" />
          Start Learning
        </button>
      ) : (
        <button
          onClick={onStop}
          className="w-full py-3.5 px-4 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4" />
          Stop Analysis
        </button>
      )}
    </div>
  )
}

