type EventName = 
  | 'wallet_connected'
  | 'transaction_started'
  | 'transaction_completed'
  | 'transaction_failed'
  | 'loan_created'
  | 'loan_repayed'
  | 'error_occurred'
  | 'security_event'

interface EventProperties {
  [key: string]: any
}

class Analytics {
  private static instance: Analytics
  private events: Map<string, number> = new Map()

  private constructor() {}

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics()
    }
    return Analytics.instance
  }

  trackEvent(eventName: EventName, properties?: EventProperties) {
    // Incrementa contador de eventos
    const count = this.events.get(eventName) || 0
    this.events.set(eventName, count + 1)

    // Envia para o console em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${eventName}:`, properties)
    }

    // Aqui você pode adicionar integração com serviços de analytics
    // como Google Analytics, Mixpanel, etc.
  }

  getEventCount(eventName: EventName): number {
    return this.events.get(eventName) || 0
  }

  resetEvents() {
    this.events.clear()
  }
}

export const analytics = Analytics.getInstance() 