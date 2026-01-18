import React, { useState } from "react"
import { Bell, Eye, Zap, Shield } from "lucide-react"

interface SettingToggle {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  enabled: boolean
}

export function Settings() {
  const [settings, setSettings] = useState<SettingToggle[]>([
    {
      id: "notifications",
      label: "Push Notifications",
      description: "Get alerts when AI content is detected",
      icon: Bell,
      enabled: true,
    },
    {
      id: "autoScan",
      label: "Auto-scan",
      description: "Continuously monitor new content",
      icon: Eye,
      enabled: true,
    },
    {
      id: "realtime",
      label: "Real-time Analysis",
      description: "Analyze content as it appears",
      icon: Zap,
      enabled: false,
    },
    {
      id: "enhanced",
      label: "Enhanced Detection",
      description: "Deep learning AI detection models",
      icon: Shield,
      enabled: true,
    },
  ])

  const toggleSetting = (id: string) => {
    setSettings(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    )
  }

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Configuration
      </h2>

      <div className="space-y-3">
        {settings.map((setting) => {
          const Icon = setting.icon
          return (
            <div
              key={setting.id}
              className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50 hover:border-border transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${setting.enabled ? "bg-primary/10" : "bg-muted"}`}>
                  <Icon className={`w-4 h-4 ${setting.enabled ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{setting.label}</p>
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                onClick={() => toggleSetting(setting.id)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  setting.enabled ? "bg-primary" : "bg-muted"
                }`}
                aria-label={`Toggle ${setting.label}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-foreground transition-transform duration-200 ${
                    setting.enabled ? "translate-x-5 bg-primary-foreground" : "bg-muted-foreground"
                  }`}
                />
              </button>
            </div>
          )
        })}
      </div>

      {/* Version info */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Version 2.4.1</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            System Healthy
          </span>
        </div>
      </div>
    </div>
  )
}

