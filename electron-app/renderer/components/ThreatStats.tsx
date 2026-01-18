import { AlertTriangle, AlertCircle, Info, Shield, TrendingUp } from "lucide-react"

interface ThreatStatsProps {
  threatCounts: {
    high: number
    medium: number
    low: number
  }
  isMonitoring: boolean
}

export function ThreatStats({ threatCounts, isMonitoring }: ThreatStatsProps) {
  const total = threatCounts.high + threatCounts.medium + threatCounts.low

  const stats = [
    {
      label: "High Confidence AI",
      value: threatCounts.high,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
    },
    {
      label: "Possible AI",
      value: threatCounts.medium,
      icon: AlertCircle,
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/20",
    },
    {
      label: "Not AI",
      value: threatCounts.low,
      icon: Info,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: "Total Analyzed",
      value: total,
      icon: Shield,
      color: "text-foreground",
      bg: "bg-secondary",
      border: "border-border",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`relative overflow-hidden ${stat.bg} border ${stat.border} rounded-xl p-4 transition-all duration-300 hover:scale-[1.02]`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {stat.label}
              </p>
              <p className={`text-3xl font-bold font-mono ${stat.color}`}>
                {stat.value}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
          </div>

          {/* Trend indicator */}
          {isMonitoring && stat.value > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>Live tracking</span>
            </div>
          )}

          {/* Decorative gradient */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 ${stat.bg} opacity-50`} />
        </div>
      ))}
    </div>
  )
}

