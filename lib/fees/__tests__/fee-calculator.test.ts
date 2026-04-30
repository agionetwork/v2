import {
  calculateFee,
  calculateBatchFee,
  isFreeOperation,
  isProportionalFee,
  getFeeDescription,
  MIN_FEE_USDC,
  MAX_FEE_USDC,
} from '../fee-calculator'

describe('calculateFee', () => {
  // --- Lending operations (0.1% rate) ---
  test('create-lend-offer: $10 volume → min fee $0.01', () => {
    expect(calculateFee('create-lend-offer', 10)).toBe(0.01)
  })

  test('create-lend-offer: $100 volume → $0.10', () => {
    expect(calculateFee('create-lend-offer', 100)).toBe(0.10)
  })

  test('create-lend-offer: $1000 volume → $1.00', () => {
    expect(calculateFee('create-lend-offer', 1000)).toBe(1.00)
  })

  test('create-lend-offer: $50000 volume → max fee $10.00', () => {
    expect(calculateFee('create-lend-offer', 50000)).toBe(10.00)
  })

  test('create-borrow-request: $500 volume → $0.50', () => {
    expect(calculateFee('create-borrow-request', 500)).toBe(0.50)
  })

  test('accept-lend-offer: $2500 volume → $2.50', () => {
    expect(calculateFee('accept-lend-offer', 2500)).toBe(2.50)
  })

  test('accept-borrow-request: $100000 volume → capped at $10.00', () => {
    expect(calculateFee('accept-borrow-request', 100000)).toBe(10.00)
  })

  // --- Settlement operations (0.05% rate) ---
  test('repay-loan: $1000 volume → $0.50', () => {
    expect(calculateFee('repay-loan', 1000)).toBe(0.50)
  })

  test('swap-tokens: $200 volume → $0.10', () => {
    expect(calculateFee('swap-tokens', 200)).toBe(0.10)
  })

  test('foreclose-loan: $5000 volume → $2.50', () => {
    expect(calculateFee('foreclose-loan', 5000)).toBe(2.50)
  })

  test('repay-loan: $1 volume → min fee $0.01', () => {
    expect(calculateFee('repay-loan', 1)).toBe(0.01)
  })

  test('swap-tokens: $1000000 volume → max fee $10.00', () => {
    expect(calculateFee('swap-tokens', 1000000)).toBe(10.00)
  })

  // --- Flat fee ---
  test('create-agent: flat $0.10 regardless of volume', () => {
    expect(calculateFee('create-agent', 0)).toBe(0.10)
    expect(calculateFee('create-agent', 999999)).toBe(0.10)
  })

  // --- Free operations ---
  test('list-loans: always free', () => {
    expect(calculateFee('list-loans', 999999)).toBe(0)
  })

  test('run-agent-cycle: always free', () => {
    expect(calculateFee('run-agent-cycle', 0)).toBe(0)
  })

  test('create-profile: always free', () => {
    expect(calculateFee('create-profile', 0)).toBe(0)
  })

  test('configure-agent: always free', () => {
    expect(calculateFee('configure-agent', 0)).toBe(0)
  })

  test('follow-user: always free', () => {
    expect(calculateFee('follow-user', 0)).toBe(0)
  })

  test('rescind-offer: always free', () => {
    expect(calculateFee('rescind-offer', 0)).toBe(0)
  })

  test('add-collateral: always free', () => {
    expect(calculateFee('add-collateral', 0)).toBe(0)
  })

  test('withdraw-funds: always free', () => {
    expect(calculateFee('withdraw-funds', 0)).toBe(0)
  })

  test('unknown-tool: always free', () => {
    expect(calculateFee('unknown-tool', 1000)).toBe(0)
  })

  // --- Edge cases ---
  test('volume 0 on proportional tool → min fee', () => {
    expect(calculateFee('create-lend-offer', 0)).toBe(MIN_FEE_USDC)
  })

  test('negative volume → min fee', () => {
    expect(calculateFee('create-lend-offer', -100)).toBe(MIN_FEE_USDC)
  })

  test('rounding to 2 decimal places', () => {
    // $333 * 0.001 = $0.333 → should round to $0.33
    expect(calculateFee('create-lend-offer', 333)).toBe(0.33)
  })
})

describe('calculateBatchFee', () => {
  test('single paid op with discount', () => {
    const fee = calculateBatchFee([
      { tool: 'create-lend-offer', volumeUsd: 100 },
    ])
    // $0.10 * 0.9 = $0.09
    expect(fee).toBe(0.09)
  })

  test('mixed free + paid ops', () => {
    const fee = calculateBatchFee([
      { tool: 'configure-agent', volumeUsd: 0 },
      { tool: 'create-lend-offer', volumeUsd: 100 },
    ])
    // Only the paid op: $0.10 * 0.9 = $0.09
    expect(fee).toBe(0.09)
  })

  test('multiple paid ops with discount', () => {
    const fee = calculateBatchFee([
      { tool: 'create-lend-offer', volumeUsd: 1000 },  // $1.00
      { tool: 'create-borrow-request', volumeUsd: 500 }, // $0.50
    ])
    // ($1.00 + $0.50) * 0.9 = $1.35
    expect(fee).toBe(1.35)
  })

  test('all free ops → 0', () => {
    const fee = calculateBatchFee([
      { tool: 'configure-agent', volumeUsd: 0 },
      { tool: 'activate-agent', volumeUsd: 0 },
    ])
    expect(fee).toBe(0)
  })

  test('empty batch → 0', () => {
    expect(calculateBatchFee([])).toBe(0)
  })
})

describe('isFreeOperation', () => {
  test('free tools', () => {
    expect(isFreeOperation('list-loans')).toBe(true)
    expect(isFreeOperation('run-agent-cycle')).toBe(true)
    expect(isFreeOperation('create-profile')).toBe(true)
    expect(isFreeOperation('follow-user')).toBe(true)
    expect(isFreeOperation('rescind-offer')).toBe(true)
    expect(isFreeOperation('add-collateral')).toBe(true)
    expect(isFreeOperation('unknown-tool')).toBe(true)
  })

  test('paid tools', () => {
    expect(isFreeOperation('create-lend-offer')).toBe(false)
    expect(isFreeOperation('accept-borrow-request')).toBe(false)
    expect(isFreeOperation('repay-loan')).toBe(false)
    expect(isFreeOperation('swap-tokens')).toBe(false)
    expect(isFreeOperation('create-agent')).toBe(false)
  })
})

describe('isProportionalFee', () => {
  test('proportional tools', () => {
    expect(isProportionalFee('create-lend-offer')).toBe(true)
    expect(isProportionalFee('repay-loan')).toBe(true)
    expect(isProportionalFee('swap-tokens')).toBe(true)
  })

  test('non-proportional tools', () => {
    expect(isProportionalFee('create-agent')).toBe(false)
    expect(isProportionalFee('list-loans')).toBe(false)
  })
})

describe('getFeeDescription', () => {
  test('free tool', () => {
    expect(getFeeDescription('list-loans')).toBe('Free — no payment required.')
  })

  test('flat fee tool', () => {
    expect(getFeeDescription('create-agent')).toBe('Flat fee: $0.10 USDC.')
  })

  test('proportional tool without volume', () => {
    expect(getFeeDescription('create-lend-offer')).toContain('0.10%')
    expect(getFeeDescription('create-lend-offer')).toContain('min $0.01')
  })

  test('proportional tool with volume', () => {
    const desc = getFeeDescription('create-lend-offer', 500)
    expect(desc).toContain('$0.50')
    expect(desc).toContain('$500.00')
  })
})
