import { Loader, DollarSign, Circle, Coins, Bitcoin, CheckCircle, AlertCircle, Info } from "lucide-react"

export const Icons = {
  spinner: Loader,
  loan: DollarSign,
  solana: Circle,
  usdc: Coins,
  usdt: Coins,
  msol: Bitcoin,
  ethereum: Coins, // Corrigido: usando Coins em vez de Ethereum
  checkCircle: CheckCircle,
  alertCircle: AlertCircle,
  info: Info,
}