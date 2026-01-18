import { useState } from "react"
import { AlertTriangle, AlertCircle, Info, Clock, ExternalLink, Filter, ChevronDown } from "lucide-react"
import type { ThreatEntry } from "../types"

interface ThreatLogProps {
  threats: ThreatEntry[]
}

export function ThreatLog({ threats }: ThreatLogProps) {
  const [filter, setFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL")
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const filteredThreats = filter === "ALL" 
    ? threats 
    : threats.filter(t => t.riskLevel === filter)

  const getRiskStyles = (threat: ThreatEntry) => {
    const confidence = threat.score;
    const is_ai = threat.is_ai;
    
    // is_ai=true, confidence > 80: likely AI → HIGH (red)
    if (is_ai && confidence > 80) {
      return {
        icon: AlertTriangle,
        bg: "bg-destructive/10",
        border: "border-destructive/30",
        text: "text-destructive",
        badge: "bg-destructive/20 text-destructive",
        label: "LIKELY AI",
      }
    }
    
    // is_ai=true, confidence 60-80: possibly AI → MEDIUM (orange)
    if (is_ai && confidence >= 60 && confidence <= 80) {
      return {
        icon: AlertCircle,
        bg: "bg-warning/10",
        border: "border-warning/30",
        text: "text-warning",
        badge: "bg-warning/20 text-warning",
        label: "POSSIBLY AI",
      }
    }
    
    // is_ai=false, confidence > 60: likely real → LOW (green)
    if (!is_ai && confidence > 60) {
      return {
        icon: Info,
        bg: "bg-success/10",
        border: "border-success/30",
        text: "text-success",
        badge: "bg-success/20 text-success",
        label: "LIKELY REAL",
      }
    }
    
    // confidence < 60: unclear → LOW (muted)
    return {
      icon: Info,
      bg: "bg-muted/10",
      border: "border-border/30",
      text: "text-muted-foreground",
      badge: "bg-muted/20 text-muted-foreground",
      label: "UNCLEAR",
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Detection Log</h2>
          <p className="text-sm text-muted-foreground">
            {filteredThreats.length} {filter === "ALL" ? "total" : filter.toLowerCase()} AI content {filteredThreats.length === 1 ? "item" : "items"} found
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  filter === level
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Threat list */}
      <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {filteredThreats.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <Info className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No AI content detected</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Start monitoring to learn about AI-generated content
            </p>
          </div>
        ) : (
          filteredThreats.map((threat) => {
            const styles = getRiskStyles(threat)
            const isExpanded = expandedId === threat.id

            return (
              <div
                key={threat.id}
                className={`group transition-all duration-200 ${styles.bg} hover:${styles.bg}`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : threat.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-4">
                    {/* Risk icon */}
                    <div className={`p-2 rounded-lg ${styles.bg} ${styles.border} border`}>
                      <styles.icon className={`w-4 h-4 ${styles.text}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles.badge}`}>
                              {styles.label}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-secondary text-xs font-medium text-muted-foreground">
                              {threat.threatType}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground line-clamp-1">
                            {threat.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatTimestamp(threat.timestamp)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Score: <span className={`font-mono font-semibold ${styles.text}`}>{threat.score}</span>
                            </div>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="ml-12 pl-4 border-l-2 border-border space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Indicators
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {threat.indicators.map((indicator, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-secondary rounded text-xs text-foreground"
                            >
                              {indicator}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 pt-2">
                        <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

