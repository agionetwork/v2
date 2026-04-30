"use client"

import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  creatingOffer: string
  creatingOfferDesc: string
  thParameter: string
  thDescription: string
  thConstraints: string
  debtToken: string
  debtTokenDesc: string
  debtTokenConstraint: string
  amount: string
  amountDesc: string
  amountConstraint: string
  apy: string
  apyDesc: string
  duration: string
  durationDesc: string
  collateralRatio: string
  collateralRatioDesc: string
  submissionDesc: string
  acceptanceFlow: string
  acceptanceDesc: string
  acceptStep1: string
  acceptStep2: string
  acceptStep3: string
  acceptStep4: string
  returns: string
  returnsExample: string
  foreclosure: string
  foreclosureDesc: string
}> = {
  en: {
    title: "Lending",
    lead: "Earn yield by lending directly to borrowers on your own terms.",
    creatingOffer: "Creating an Offer",
    creatingOfferDesc: "From the Borrow & Lend page, select \u201cLend\u201d and configure:",
    thParameter: "Parameter",
    thDescription: "Description",
    thConstraints: "Constraints",
    debtToken: "Debt Token",
    debtTokenDesc: "Token you are lending",
    debtTokenConstraint: "USDC or EURC",
    amount: "Amount",
    amountDesc: "How much to lend",
    amountConstraint: "Must have balance",
    apy: "APY",
    apyDesc: "Annual yield you earn",
    duration: "Duration",
    durationDesc: "Loan term",
    collateralRatio: "Collateral Ratio",
    collateralRatioDesc: "Required over-collateralization",
    submissionDesc: "On submission, your debt tokens are transferred to the program vault. The offer stays Pending until a borrower accepts or you rescind.",
    acceptanceFlow: "Acceptance Flow",
    acceptanceDesc: "When a borrower accepts, a single atomic transaction:",
    acceptStep1: "Transfers borrower\u2019s collateral to the vault",
    acceptStep2: "Releases your debt tokens to the borrower (minus 1% origination fee)",
    acceptStep3: "Sets loan status to Accepted, starts the clock",
    acceptStep4: "Triggers Dialect notifications to both parties",
    returns: "Returns",
    returnsExample: "Example: 1,000 USDC at 12% APY for 30 days = ~9.86 USDC interest.",
    foreclosure: "Foreclosure",
    foreclosureDesc: "If the borrower\u2019s collateral ratio drops below 130%, you can foreclose and seize the collateral. Fresh Pyth prices are posted on-chain to verify the under-collateralization before the program allows it.",
  },
  es: {
    title: "Préstamos",
    lead: "Obtén rendimiento prestando directamente a prestatarios en tus propios términos.",
    creatingOffer: "Crear una Oferta",
    creatingOfferDesc: "Desde la página Pedir & Prestar, selecciona \u201cPrestar\u201d y configura:",
    thParameter: "Parámetro",
    thDescription: "Descripción",
    thConstraints: "Restricciones",
    debtToken: "Token de Deuda",
    debtTokenDesc: "Token que estás prestando",
    debtTokenConstraint: "USDC o EURC",
    amount: "Monto",
    amountDesc: "Cuánto prestar",
    amountConstraint: "Debe tener saldo",
    apy: "APY",
    apyDesc: "Rendimiento anual que ganas",
    duration: "Duración",
    durationDesc: "Plazo del préstamo",
    collateralRatio: "Ratio de Garantía",
    collateralRatioDesc: "Sobre-colateralización requerida",
    submissionDesc: "Al enviar, tus tokens de deuda se transfieren a la bóveda del programa. La oferta permanece Pendiente hasta que un prestatario acepte o la rescindas.",
    acceptanceFlow: "Flujo de Aceptación",
    acceptanceDesc: "Cuando un prestatario acepta, una sola transacción atómica:",
    acceptStep1: "Transfiere la garantía del prestatario a la bóveda",
    acceptStep2: "Libera tus tokens de deuda al prestatario (menos 1% de comisión de originación)",
    acceptStep3: "Establece el estado del préstamo a Aceptado, inicia el reloj",
    acceptStep4: "Activa notificaciones Dialect para ambas partes",
    returns: "Rendimientos",
    returnsExample: "Ejemplo: 1.000 USDC al 12% APY por 30 días = ~9,86 USDC de interés.",
    foreclosure: "Ejecución",
    foreclosureDesc: "Si el ratio de garantía del prestatario cae por debajo del 130%, puedes ejecutar y confiscar la garantía. Se publican precios Pyth actualizados on-chain para verificar la sub-colateralización antes de que el programa lo permita.",
  },
  pt: {
    title: "Empréstimos",
    lead: "Ganhe rendimento emprestando diretamente a mutuários nos seus próprios termos.",
    creatingOffer: "Criar uma Oferta",
    creatingOfferDesc: "Na página Emprestar & Tomar Emprestado, selecione \u201cEmprestar\u201d e configure:",
    thParameter: "Parâmetro",
    thDescription: "Descrição",
    thConstraints: "Restrições",
    debtToken: "Token de Dívida",
    debtTokenDesc: "Token que você está emprestando",
    debtTokenConstraint: "USDC ou EURC",
    amount: "Valor",
    amountDesc: "Quanto emprestar",
    amountConstraint: "Deve ter saldo",
    apy: "APY",
    apyDesc: "Rendimento anual que você ganha",
    duration: "Duração",
    durationDesc: "Prazo do empréstimo",
    collateralRatio: "Taxa de Garantia",
    collateralRatioDesc: "Sobre-colateralização exigida",
    submissionDesc: "Ao enviar, seus tokens de dívida são transferidos para o cofre do programa. A oferta permanece Pendente até que um mutuário aceite ou você rescinda.",
    acceptanceFlow: "Fluxo de Aceitação",
    acceptanceDesc: "Quando um mutuário aceita, uma única transação atômica:",
    acceptStep1: "Transfere a garantia do mutuário para o cofre",
    acceptStep2: "Libera seus tokens de dívida para o mutuário (menos 1% de taxa de originação)",
    acceptStep3: "Define o status do empréstimo como Aceito, inicia o relógio",
    acceptStep4: "Aciona notificações Dialect para ambas as partes",
    returns: "Retornos",
    returnsExample: "Exemplo: 1.000 USDC a 12% APY por 30 dias = ~9,86 USDC de juros.",
    foreclosure: "Execução",
    foreclosureDesc: "Se a taxa de garantia do mutuário cair abaixo de 130%, você pode executar e confiscar a garantia. Preços Pyth atualizados são publicados on-chain para verificar a sub-colateralização antes que o programa permita.",
  },
  zh: {
    title: "出借",
    lead: "按照您自己的条款直接借给借款人，赚取收益。",
    creatingOffer: "创建报价",
    creatingOfferDesc: "在「借贷」页面，选择「出借」并配置：",
    thParameter: "参数",
    thDescription: "说明",
    thConstraints: "约束",
    debtToken: "债务代币",
    debtTokenDesc: "您出借的代币",
    debtTokenConstraint: "USDC 或 EURC",
    amount: "金额",
    amountDesc: "出借多少",
    amountConstraint: "必须有余额",
    apy: "APY",
    apyDesc: "您赚取的年化收益",
    duration: "期限",
    durationDesc: "贷款期限",
    collateralRatio: "抵押率",
    collateralRatioDesc: "所需的超额抵押",
    submissionDesc: "提交后，您的债务代币将转入程序金库。报价保持待处理状态，直到借款人接受或您撤销。",
    acceptanceFlow: "接受流程",
    acceptanceDesc: "当借款人接受时，一笔原子交易完成以下操作：",
    acceptStep1: "将借款人的抵押品转入金库",
    acceptStep2: "将您的债务代币释放给借款人（减去 1% 发起费）",
    acceptStep3: "将贷款状态设为已接受，开始计时",
    acceptStep4: "向双方触发 Dialect 通知",
    returns: "收益",
    returnsExample: "示例：1,000 USDC，12% APY，30 天 = 约 9.86 USDC 利息。",
    foreclosure: "清算",
    foreclosureDesc: "如果借款人的抵押率降至 130% 以下，您可以清算并没收抵押品。清算前会在链上发布最新的 Pyth 价格以验证抵押不足。",
  },
}

export default function LendingPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.creatingOffer}</h2>
      <p>
        {s.creatingOfferDesc}
      </p>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 font-medium">{s.thParameter}</th>
              <th className="pb-2 font-medium">{s.thDescription}</th>
              <th className="pb-2 font-medium">{s.thConstraints}</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.debtToken}</td>
              <td>{s.debtTokenDesc}</td>
              <td>{s.debtTokenConstraint}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.amount}</td>
              <td>{s.amountDesc}</td>
              <td>{s.amountConstraint}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.apy}</td>
              <td>{s.apyDesc}</td>
              <td>0.1% &ndash; 100%</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.duration}</td>
              <td>{s.durationDesc}</td>
              <td>1 &ndash; 365 days</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.collateralRatio}</td>
              <td>{s.collateralRatioDesc}</td>
              <td>150% &ndash; 300%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        {s.submissionDesc}
      </p>

      <h2>{s.acceptanceFlow}</h2>
      <p>{s.acceptanceDesc}</p>
      <ol>
        <li>{s.acceptStep1}</li>
        <li>{s.acceptStep2}</li>
        <li>{s.acceptStep3}</li>
        <li>{s.acceptStep4}</li>
      </ol>

      <h2>{s.returns}</h2>
      <div className="not-prose my-4 rounded-lg border border-border/60 bg-card p-4">
        <code className="text-sm">
          return = principal + (principal &times; APY &times; days / 365 / 100)
        </code>
        <p className="mt-2 text-sm text-muted-foreground">
          {s.returnsExample}
        </p>
      </div>

      <h2>{s.foreclosure}</h2>
      <p>
        {s.foreclosureDesc}
      </p>

    </>
  )
}
