"use client"

import { useState, useEffect } from 'react'

interface TokenPrice {
  symbol: string
  price: number
  lastUpdated: Date
  source: 'pyth' | 'coingecko' | 'mock'
}

interface PythPriceData {
  [key: string]: TokenPrice
}

// Pyth Hermes price feed IDs (mainnet)
const PYTH_FEED_IDS: Record<string, string> = {
  'SOL': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'USDC': 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'EURC': '76fa85158bf14ede77087fe3ae472f66213f6ea2f5b411cb2de472794990fa5c',
}

const HERMES_BASE_URL = 'https://hermes.pyth.network'

// Fallback prices used when both Pyth and CoinGecko fail
const MOCK_PRICES: PythPriceData = {
  'SOL': { symbol: 'SOL', price: 80.00, lastUpdated: new Date(), source: 'mock' },
  'USDC': { symbol: 'USDC', price: 1.00, lastUpdated: new Date(), source: 'mock' },
  'EURC': { symbol: 'EURC', price: 1.08, lastUpdated: new Date(), source: 'mock' },
}

// CoinGecko IDs for fallback
const COINGECKO_IDS: Record<string, string> = {
  'SOL': 'solana',
  'USDC': 'usd-coin',
  'EURC': 'euro-coin',
}

export function useTokenPrices() {
  const [prices, setPrices] = useState<PythPriceData>(MOCK_PRICES)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSource, setCurrentSource] = useState<'pyth' | 'coingecko' | 'mock'>('mock')

  // Fetch real prices from Pyth Hermes API
  const fetchPythPrices = async (): Promise<PythPriceData | null> => {
    try {
      const idsParam = Object.values(PYTH_FEED_IDS)
        .map(id => `ids[]=0x${id}`)
        .join('&')
      const url = `${HERMES_BASE_URL}/v2/updates/price/latest?${idsParam}&parsed=true`

      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error(`Hermes API error: ${response.status}`)

      const data = await response.json()
      const parsed: Array<{ id: string; price: { price: string; expo: number; publish_time: number } }> = data.parsed

      if (!parsed || parsed.length === 0) throw new Error('No parsed prices returned')

      // Map feed IDs back to token symbols
      const idToSymbol: Record<string, string> = {}
      for (const [symbol, feedId] of Object.entries(PYTH_FEED_IDS)) {
        idToSymbol[feedId] = symbol
      }

      const pythPrices: PythPriceData = {}
      for (const feed of parsed) {
        const symbol = idToSymbol[feed.id]
        if (!symbol) continue
        const rawPrice = parseInt(feed.price.price, 10)
        const expo = feed.price.expo
        const usdPrice = rawPrice * Math.pow(10, expo)
        pythPrices[symbol] = {
          symbol,
          price: Math.round(usdPrice * 10000) / 10000,
          lastUpdated: new Date(feed.price.publish_time * 1000),
          source: 'pyth',
        }
      }

      // Verify we got all tokens
      const missing = Object.keys(PYTH_FEED_IDS).filter(s => !pythPrices[s])
      if (missing.length > 0) {
        console.warn('Pyth: missing feeds for', missing.join(', '))
      }

      return Object.keys(pythPrices).length > 0 ? pythPrices : null
    } catch (error) {
      console.warn('Pyth Network failed:', error)
      return null
    }
  }

  // Buscar preços da CoinGecko como fallback
  const fetchCoinGeckoPrices = async (): Promise<PythPriceData | null> => {
    try {
      const tokenIds = Object.values(COINGECKO_IDS).join(',')
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=usd`
      )
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      const coingeckoPrices: PythPriceData = {
        'SOL': { 
          symbol: 'SOL', 
          price: data.solana?.usd || 80.00,
          lastUpdated: new Date(), 
          source: 'coingecko' 
        },
        'USDC': { 
          symbol: 'USDC', 
          price: data['usd-coin']?.usd || 1.00, 
          lastUpdated: new Date(), 
          source: 'coingecko' 
        },
        'EURC': {
          symbol: 'EURC',
          price: data['euro-coin']?.usd || 1.08,
          lastUpdated: new Date(),
          source: 'coingecko'
        },
      }
      
      return coingeckoPrices
    } catch (error) {
      console.warn('CoinGecko API failed:', error)
      return null
    }
  }

  // Função principal para buscar preços com fallback
  const fetchPrices = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Tentar Pyth Network primeiro
      let fetchedPrices = await fetchPythPrices()
      let source: 'pyth' | 'coingecko' | 'mock' = 'pyth'
      
      // Se Pyth falhar, usar CoinGecko como fallback
      if (!fetchedPrices) {
        fetchedPrices = await fetchCoinGeckoPrices()
        source = 'coingecko'
      }
      
      // Se ambos falharem, usar preços mock
      if (!fetchedPrices) {
        fetchedPrices = MOCK_PRICES
        source = 'mock'
      }
      
      setPrices(fetchedPrices)
      setCurrentSource(source)

    } catch (err) {
      setError('Erro ao buscar preços dos tokens')
      console.error('Erro ao buscar preços:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Buscar preços inicialmente e depois a cada 30 segundos
  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 30000) // 30 segundos
    
    return () => clearInterval(interval)
  }, [])

  // Função para calcular conversão entre tokens
  const convertToken = (amount: number, fromToken: string, toToken: string): number => {
    if (fromToken === toToken) return amount
    
    const fromPrice = prices[fromToken]?.price || 0
    const toPrice = prices[toToken]?.price || 0
    
    if (fromPrice === 0 || toPrice === 0) return 0
    
    return (amount * fromPrice) / toPrice
  }

  // Função para calcular valor em USD
  const getValueInUSD = (amount: number, token: string): number => {
    const price = prices[token]?.price || 0
    return amount * price
  }

  // Função para obter preço de um token
  const getTokenPrice = (token: string): number => {
    return prices[token]?.price || 0
  }

  // Função para obter informações da fonte atual
  const getSourceInfo = () => {
    return {
      source: currentSource,
      isPyth: currentSource === 'pyth',
      isCoinGecko: currentSource === 'coingecko',
      isMock: currentSource === 'mock',
      lastUpdated: prices.SOL?.lastUpdated || new Date()
    }
  }

  const isPriceReliable = currentSource !== 'mock'

  return {
    prices,
    isLoading,
    error,
    convertToken,
    getValueInUSD,
    getTokenPrice,
    refreshPrices: fetchPrices,
    getSourceInfo,
    currentSource,
    isPriceReliable,
  }
}