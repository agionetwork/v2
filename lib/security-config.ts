/**
 * Security configuration for Agio Network
 * Centralized security settings and validation rules
 */

export const SECURITY_CONFIG = {
  // Environment validation
  REQUIRED_ENV_VARS: [
    'NEXT_PUBLIC_SOLANA_RPC_URL',
    'NEXT_PUBLIC_PROGRAM_ID'
  ],

  // Rate limiting
  RATE_LIMITS: {
    WALLET_CONNECTIONS: {
      MAX_ATTEMPTS: 5,
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      BLOCK_DURATION: 60 * 60 * 1000, // 1 hour
    },
    API_REQUESTS: {
      MAX_REQUESTS: 100,
      WINDOW_MS: 60 * 1000, // 1 minute
    },
    FORM_SUBMISSIONS: {
      MAX_ATTEMPTS: 10,
      WINDOW_MS: 5 * 60 * 1000, // 5 minutes
    }
  },

  // Input validation
  VALIDATION: {
    MAX_INPUT_LENGTH: 256,
    MAX_DECIMALS: 8,
    MIN_LOAN_AMOUNT: 1,
    MAX_LOAN_AMOUNT: 1_000_000,
    MIN_LOAN_TERM: 1,
    MAX_LOAN_TERM: 365,
    MIN_APY: 0,
    MAX_APY: Number(process.env.PROTOCOL_MAX_APY) || 200, // env override, default 200%
    MIN_COLLATERAL_RATIO: Number(process.env.PROTOCOL_MIN_COLLATERAL_RATIO) || 150, // env override, default 150%
    MIN_ACCEPT_COLLATERAL_RATIO: Number(process.env.PROTOCOL_MIN_ACCEPT_COLLATERAL_RATIO) || 130, // accept threshold, default 130%
    MAX_COLLATERAL_RATIO: 1000, // 1000%
    MIN_DEBT_USD: Number(process.env.PROTOCOL_MIN_DEBT_USD) || 1.0, // env override, default $1.00
  },

  // Security headers
  SECURITY_HEADERS: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  },

  // Content Security Policy (reference — actual CSP set in middleware.ts with nonces)
  CSP: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'nonce-<per-request>'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", "data:", "https:"],
    'connect-src': ["'self'", "https://hermes.pyth.network", "https://api.coingecko.com", "https://api.devnet.solana.com", "https://api.mainnet-beta.solana.com", "https://api.testnet.solana.com", "https://*.helius-rpc.com", "wss://*.helius-rpc.com", "wss://api.devnet.solana.com", "wss://api.mainnet-beta.solana.com", "wss://api.testnet.solana.com", "https://alerts-api.dial.to", "https://dialectapi.to"],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
};

// Validate environment variables on startup
export function validateEnvironment(): void {
  const missing = SECURITY_CONFIG.REQUIRED_ENV_VARS.filter(
    varName => !process.env[varName]
  );

  if (missing.length > 0) {
    console.warn(
      `[Agio] Missing recommended environment variables: ${missing.join(', ')}. Using defaults (devnet).`
    );
  }
}

// Security event types for logging
export enum SecurityEventType {
  WALLET_CONNECTION_ATTEMPT = 'wallet_connection_attempt',
  WALLET_CONNECTION_SUCCESS = 'wallet_connection_success',
  WALLET_CONNECTION_FAILURE = 'wallet_connection_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_INPUT = 'invalid_input',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  API_ERROR = 'api_error',
  SECURITY_VIOLATION = 'security_violation'
}

// Input sanitization utilities
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, SECURITY_CONFIG.VALIDATION.MAX_INPUT_LENGTH);
};

// Enhanced address validation
export const validateAddress = (address: string, type: 'SOL' | 'ETH'): boolean => {
  if (!address || typeof address !== 'string') return false;
  
  const sanitized = sanitizeInput(address);
  
  if (type === 'SOL') {
    // Solana address validation
    if (sanitized.length < 32 || sanitized.length > 44) return false;
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(sanitized)) return false;
    if (/[0OIl]/.test(sanitized)) return false; // Invalid base58 characters
    return true;
  }
  
  if (type === 'ETH') {
    // Ethereum address validation
    return /^0x[a-fA-F0-9]{40}$/.test(sanitized);
  }
  
  return false;
};

// Rate limiting utilities
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  isAllowed(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < windowMs);
    
    if (validAttempts.length >= limit) {
      return false;
    }
    
    // Add current attempt
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    
    return true;
  }
  
  getRemainingAttempts(key: string, limit: number, windowMs: number): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const validAttempts = attempts.filter(time => now - time < windowMs);
    
    return Math.max(0, limit - validAttempts.length);
  }
  
  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter();
