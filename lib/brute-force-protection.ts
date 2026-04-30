import { Redis } from '@upstash/redis'
import { securityLogger } from './security-logger'

interface BruteForceConfig {
  maxAttempts: number
  windowMs: number
  blockDuration: number
}

class BruteForceProtection {
  private static instance: BruteForceProtection
  private redis: Redis
  private config: BruteForceConfig

  private constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })

    this.config = {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutos
      blockDuration: 60 * 60 * 1000, // 1 hora
    }
  }

  static getInstance(): BruteForceProtection {
    if (!BruteForceProtection.instance) {
      BruteForceProtection.instance = new BruteForceProtection()
    }
    return BruteForceProtection.instance
  }

  private getKey(identifier: string, type: string): string {
    return `brute_force:${type}:${identifier}`
  }

  async isBlocked(identifier: string, type: string): Promise<boolean> {
    const blockKey = `blocked:${this.getKey(identifier, type)}`
    const isBlocked = await this.redis.get(blockKey)
    return !!isBlocked
  }

  async recordAttempt(identifier: string, type: string): Promise<boolean> {
    const key = this.getKey(identifier, type)
    const blockKey = `blocked:${key}`

    // Verifica se está bloqueado
    if (await this.isBlocked(identifier, type)) {
      return true
    }

    // Incrementa contador de tentativas
    const attempts = await this.redis.incr(key)
    
    // Se for a primeira tentativa, define o TTL
    if (attempts === 1) {
      await this.redis.expire(key, this.config.windowMs / 1000)
    }

    // Se excedeu o limite de tentativas, bloqueia
    if (attempts > this.config.maxAttempts) {
      await this.redis.set(blockKey, '1', { ex: this.config.blockDuration / 1000 })
      
      // Log do evento
      securityLogger.log({
        type: 'brute_force_attempt',
        ip: identifier,
        details: {
          type,
          attempts,
          blocked: true
        }
      })

      return true
    }

    return false
  }

  async resetAttempts(identifier: string, type: string): Promise<void> {
    const key = this.getKey(identifier, type)
    const blockKey = `blocked:${key}`
    
    await this.redis.del(key)
    await this.redis.del(blockKey)
  }
}

export const bruteForceProtection = BruteForceProtection.getInstance() 