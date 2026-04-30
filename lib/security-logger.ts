import { analytics } from './analytics'

type SecurityEventType = 
  | 'auth_attempt'
  | 'auth_success'
  | 'auth_failure'
  | 'rate_limit_exceeded'
  | 'brute_force_attempt'
  | 'invalid_input'
  | 'suspicious_activity'
  | 'transaction_attempt'
  | 'transaction_success'
  | 'transaction_failure'

interface SecurityEvent {
  type: SecurityEventType
  ip: string
  userId?: string
  details: Record<string, any>
  timestamp: Date
}

class SecurityLogger {
  private static instance: SecurityLogger
  private events: SecurityEvent[] = []
  private readonly MAX_EVENTS = 1000

  private constructor() {}

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger()
    }
    return SecurityLogger.instance
  }

  log(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    }

    // Adiciona ao array de eventos
    this.events.push(securityEvent)
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift()
    }

    // Envia para o analytics
    analytics.trackEvent('security_event', {
      type: event.type,
      ip: event.ip,
      userId: event.userId,
      details: event.details
    })

    // Log em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('[Security]', securityEvent)
    }

    // Aqui você pode adicionar integração com serviços de logging
    // como Sentry, LogRocket, etc.
  }

  getEvents(type?: SecurityEventType): SecurityEvent[] {
    return type 
      ? this.events.filter(event => event.type === type)
      : this.events
  }

  getRecentEvents(minutes: number = 5): SecurityEvent[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000)
    return this.events.filter(event => event.timestamp > cutoff)
  }

  clearEvents() {
    this.events = []
  }
}

export const securityLogger = SecurityLogger.getInstance() 