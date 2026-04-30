import { securityLogger } from './security-logger'
import { bruteForceProtection } from './brute-force-protection'
import { analytics } from './analytics'

interface SecurityAlert {
  type: string
  severity: 'low' | 'medium' | 'high'
  message: string
  details: Record<string, any>
  timestamp: Date
}

class SecurityMonitor {
  private static instance: SecurityMonitor
  private alerts: SecurityAlert[] = []
  private readonly MAX_ALERTS = 100

  private constructor() {
    this.startMonitoring()
  }

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor()
    }
    return SecurityMonitor.instance
  }

  private startMonitoring() {
    // Monitora eventos de segurança a cada 5 minutos
    setInterval(() => {
      this.checkSecurityEvents()
    }, 5 * 60 * 1000)
  }

  private async checkSecurityEvents() {
    const recentEvents = securityLogger.getRecentEvents(5) // últimos 5 minutos

    // Analisa eventos para detectar padrões suspeitos
    const bruteForceEvents = recentEvents.filter(
      event => event.type === 'brute_force_attempt'
    )

    const authFailures = recentEvents.filter(
      event => event.type === 'auth_failure'
    )

    const suspiciousActivities = recentEvents.filter(
      event => event.type === 'suspicious_activity'
    )

    // Gera alertas baseados nos eventos
    if (bruteForceEvents.length > 0) {
      this.createAlert({
        type: 'brute_force_detected',
        severity: 'high',
        message: 'Detectado possível ataque de força bruta',
        details: {
          attempts: bruteForceEvents.length,
          ips: [...new Set(bruteForceEvents.map(e => e.ip))]
        }
      })
    }

    if (authFailures.length > 10) {
      this.createAlert({
        type: 'multiple_auth_failures',
        severity: 'medium',
        message: 'Múltiplas falhas de autenticação detectadas',
        details: {
          failures: authFailures.length,
          ips: [...new Set(authFailures.map(e => e.ip))]
        }
      })
    }

    if (suspiciousActivities.length > 0) {
      this.createAlert({
        type: 'suspicious_activity_detected',
        severity: 'high',
        message: 'Atividade suspeita detectada',
        details: {
          activities: suspiciousActivities
        }
      })
    }
  }

  createAlert(alert: Omit<SecurityAlert, 'timestamp'>) {
    const securityAlert: SecurityAlert = {
      ...alert,
      timestamp: new Date()
    }

    // Adiciona ao array de alertas
    this.alerts.push(securityAlert)
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.shift()
    }

    // Envia para o analytics
    analytics.trackEvent('security_event', {
      type: 'security_alert',
      severity: alert.severity,
      message: alert.message,
      details: alert.details
    })

    // Log em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('[Security Alert]', securityAlert)
    }

    // Aqui você pode adicionar integração com serviços de monitoramento
    // como Sentry, Datadog, etc.
  }

  getAlerts(severity?: SecurityAlert['severity']): SecurityAlert[] {
    return severity
      ? this.alerts.filter(alert => alert.severity === severity)
      : this.alerts
  }

  getRecentAlerts(minutes: number = 5): SecurityAlert[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000)
    return this.alerts.filter(alert => alert.timestamp > cutoff)
  }

  clearAlerts() {
    this.alerts = []
  }
}

export const securityMonitor = SecurityMonitor.getInstance() 