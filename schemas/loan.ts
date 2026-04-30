import { z } from "zod"
import { TokenType, OperationType } from "@/types/loan"

export const loanFormSchema = z.object({
  loanAmount: z.number()
    .positive("O valor do empréstimo deve ser maior que zero")
    .min(1, "Valor mínimo é 1")
    .max(1000000, "Valor máximo é 1,000,000"),

  loanTerm: z.number()
    .int("O prazo deve ser em dias inteiros")
    .min(1, "Prazo mínimo é 1 dia")
    .max(365, "Prazo máximo é 365 dias"),

  apy: z.number()
    .min(0, "APY não pode ser negativo")
    .max(100, "APY máximo é 100%"),

  token: z.custom<TokenType>(
    (val) => ["SOL", "USDC", "USDT", "mSOL"].includes(val as TokenType),
    "Token inválido"
  ),

  tokenCollateral: z.custom<TokenType>(
    (val) => ["SOL", "USDC", "USDT", "mSOL"].includes(val as TokenType),
    "Token de colateral inválido"
  ),

  collateralAmount: z.number()
    .positive("Collateral amount must be greater than zero")
    .min(1, "Minimum value is 1"),

  receiverAddress: z.string()
    .min(1, "Endereço da carteira é obrigatório")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Endereço da carteira inválido"),

  operationType: z.custom<OperationType>(
    (val) => ["LEND", "BORROW"].includes(val as OperationType),
    "Tipo de operação inválido"
  )
})

export type LoanFormSchema = z.infer<typeof loanFormSchema>

export const validateLoanForm = (data: unknown) => {
  try {
    const validatedData = loanFormSchema.parse(data)
    return { success: true, data: validatedData, errors: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.reduce((acc, err) => ({
        ...acc,
        [err.path[0]]: err.message
      }), {})
      return { success: false, data: null, errors }
    }
    return { 
      success: false, 
      data: null, 
      errors: { submit: "Erro de validação desconhecido" } 
    }
  }
} 