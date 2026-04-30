"use client"

import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  twoWays: string
  acceptLendOffer: string
  acceptLendOfferDesc: string
  createBorrowRequest: string
  createBorrowRequestDesc: string
  collateral: string
  collateralDesc: string
  exampleTitle: string
  onChainMin: string
  foreclosureTrigger: string
  addCollateral: string
  solAutoWrap: string
  repayment: string
  repayFull: string
  collateralReturned: string
  statusRepaid: string
  reputationPoints: string
  foreclosureRiskTitle: string
  foreclosureRiskDesc: string
}> = {
  en: {
    title: "Borrowing",
    lead: "Access liquidity by depositing collateral. No credit checks, no KYC.",
    twoWays: "Two Ways to Borrow",
    acceptLendOffer: "Accept a Lend Offer",
    acceptLendOfferDesc: "Browse Loan Offers, filter by token/APY/amount, and accept an offer that fits. You deposit collateral, receive debt tokens, and the loan starts immediately.",
    createBorrowRequest: "Create a Borrow Request",
    createBorrowRequestDesc: "Post your own terms from Borrow & Lend. Lenders see your request and can choose to fund it. No funds are locked until a lender matches.",
    collateral: "Collateral",
    collateralDesc: "All loans are over-collateralized. The required amount is calculated in real-time using Pyth oracle prices:",
    exampleTitle: "Example: borrow 1,000 USDC, 150% ratio, SOL at $150",
    onChainMin: "On-chain minimum: 130% at acceptance",
    foreclosureTrigger: "Foreclosure trigger: ratio falls below 130%",
    addCollateral: "You can add collateral at any time to improve your margin",
    solAutoWrap: "SOL is auto-wrapped to wSOL and unwrapped on return — transparent to you",
    repayment: "Repayment",
    repayFull: "Pay principal + full-term interest (early repay still pays the full duration)",
    collateralReturned: "Collateral is returned to your wallet",
    statusRepaid: "Loan status changes to Repaid",
    reputationPoints: "You earn reputation points for successful repayment",
    foreclosureRiskTitle: "Foreclosure Risk",
    foreclosureRiskDesc: "If your collateral ratio drops below 130%, the lender can foreclose and seize your collateral irreversibly. Monitor your ratio and add collateral proactively during volatile markets.",
  },
  es: {
    title: "Pedir Prestado",
    lead: "Accede a liquidez depositando garantía. Sin verificación crediticia, sin KYC.",
    twoWays: "Dos Formas de Pedir Prestado",
    acceptLendOffer: "Aceptar una Oferta de Préstamo",
    acceptLendOfferDesc: "Explora las Ofertas de Préstamo, filtra por token/APY/monto y acepta una oferta que se ajuste. Depositas garantía, recibes tokens de deuda y el préstamo comienza inmediatamente.",
    createBorrowRequest: "Crear una Solicitud de Préstamo",
    createBorrowRequestDesc: "Publica tus propios términos desde Pedir & Prestar. Los prestamistas ven tu solicitud y pueden elegir financiarla. No se bloquean fondos hasta que un prestamista acepte.",
    collateral: "Garantía",
    collateralDesc: "Todos los préstamos están sobre-colateralizados. El monto requerido se calcula en tiempo real usando los precios de los oráculos Pyth:",
    exampleTitle: "Ejemplo: pedir prestados 1.000 USDC, ratio 150%, SOL a $150",
    onChainMin: "Mínimo on-chain: 130% en la aceptación",
    foreclosureTrigger: "Activación de ejecución: el ratio cae por debajo del 130%",
    addCollateral: "Puedes añadir garantía en cualquier momento para mejorar tu margen",
    solAutoWrap: "SOL se envuelve automáticamente a wSOL y se desenvuelve al devolverlo — transparente para ti",
    repayment: "Pago",
    repayFull: "Pagar principal + intereses del plazo completo (el pago anticipado sigue pagando la duración completa)",
    collateralReturned: "La garantía se devuelve a tu wallet",
    statusRepaid: "El estado del préstamo cambia a Pagado",
    reputationPoints: "Ganas puntos de reputación por un pago exitoso",
    foreclosureRiskTitle: "Riesgo de Ejecución",
    foreclosureRiskDesc: "Si tu ratio de garantía cae por debajo del 130%, el prestamista puede ejecutar y confiscar tu garantía irreversiblemente. Monitorea tu ratio y añade garantía proactivamente durante mercados volátiles.",
  },
  pt: {
    title: "Tomar Emprestado",
    lead: "Acesse liquidez depositando garantia. Sem verificação de crédito, sem KYC.",
    twoWays: "Duas Formas de Tomar Emprestado",
    acceptLendOffer: "Aceitar uma Oferta de Empréstimo",
    acceptLendOfferDesc: "Navegue pelas Ofertas de Empréstimo, filtre por token/APY/valor e aceite uma oferta adequada. Você deposita garantia, recebe tokens de dívida e o empréstimo começa imediatamente.",
    createBorrowRequest: "Criar uma Solicitação de Empréstimo",
    createBorrowRequestDesc: "Publique seus próprios termos em Emprestar & Tomar Emprestado. Os credores veem sua solicitação e podem escolher financiá-la. Nenhum fundo é bloqueado até que um credor aceite.",
    collateral: "Garantia",
    collateralDesc: "Todos os empréstimos são sobre-colateralizados. O valor exigido é calculado em tempo real usando os preços dos oráculos Pyth:",
    exampleTitle: "Exemplo: tomar emprestados 1.000 USDC, taxa 150%, SOL a $150",
    onChainMin: "Mínimo on-chain: 130% na aceitação",
    foreclosureTrigger: "Gatilho de execução: a taxa cai abaixo de 130%",
    addCollateral: "Você pode adicionar garantia a qualquer momento para melhorar sua margem",
    solAutoWrap: "SOL é automaticamente convertido para wSOL e desconvertido na devolução — transparente para você",
    repayment: "Pagamento",
    repayFull: "Pagar principal + juros do prazo completo (pagamento antecipado ainda paga a duração completa)",
    collateralReturned: "A garantia é devolvida à sua wallet",
    statusRepaid: "O status do empréstimo muda para Pago",
    reputationPoints: "Você ganha pontos de reputação por pagamento bem-sucedido",
    foreclosureRiskTitle: "Risco de Execução",
    foreclosureRiskDesc: "Se sua taxa de garantia cair abaixo de 130%, o credor pode executar e confiscar sua garantia irreversivelmente. Monitore sua taxa e adicione garantia proativamente durante mercados voláteis.",
  },
  zh: {
    title: "借入",
    lead: "通过存入抵押品获取流动性。无需信用检查，无需 KYC。",
    twoWays: "两种借款方式",
    acceptLendOffer: "接受出借报价",
    acceptLendOfferDesc: "浏览贷款报价，按代币/APY/金额筛选，接受合适的报价。您存入抵押品，收到债务代币，贷款立即开始。",
    createBorrowRequest: "创建借款请求",
    createBorrowRequestDesc: "在「借贷」页面发布您自己的条款。出借方可以看到您的请求并选择资助。在出借方匹配之前不会锁定任何资金。",
    collateral: "抵押品",
    collateralDesc: "所有贷款均为超额抵押。所需金额使用 Pyth 预言机价格实时计算：",
    exampleTitle: "示例：借入 1,000 USDC，150% 抵押率，SOL 价格 $150",
    onChainMin: "链上最低要求：接受时 130%",
    foreclosureTrigger: "清算触发：比率降至 130% 以下",
    addCollateral: "您可以随时追加抵押品以改善保证金",
    solAutoWrap: "SOL 自动包装为 wSOL，归还时自动解包——对您完全透明",
    repayment: "还款",
    repayFull: "支付本金 + 全期利息（提前还款仍需支付全部期限的利息）",
    collateralReturned: "抵押品返还到您的钱包",
    statusRepaid: "贷款状态变更为已偿还",
    reputationPoints: "成功还款可获得声誉积分",
    foreclosureRiskTitle: "清算风险",
    foreclosureRiskDesc: "如果您的抵押率降至 130% 以下，出借方可以清算并不可逆地没收您的抵押品。请监控您的比率，在市场波动期间主动追加抵押品。",
  },
}

export default function BorrowingPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.twoWays}</h2>

      <h3>{s.acceptLendOffer}</h3>
      <p>
        {s.acceptLendOfferDesc}
      </p>

      <h3>{s.createBorrowRequest}</h3>
      <p>
        {s.createBorrowRequestDesc}
      </p>

      <h2>{s.collateral}</h2>
      <p>
        {s.collateralDesc}
      </p>
      <div className="not-prose my-6 rounded-lg border border-border/60 bg-card p-5">
        <p className="text-sm font-medium">{s.exampleTitle}</p>
        <code className="mt-2 block rounded bg-muted px-4 py-3 text-sm">
          required = (1,000 &times; 1.50) / 150 = 10 SOL
        </code>
      </div>

      <ul>
        <li>{s.onChainMin}</li>
        <li>{s.foreclosureTrigger}</li>
        <li>{s.addCollateral}</li>
        <li>{s.solAutoWrap}</li>
      </ul>

      <h2>{s.repayment}</h2>
      <ul>
        <li>{s.repayFull}</li>
        <li>{s.collateralReturned}</li>
        <li>{s.statusRepaid}</li>
        <li>{s.reputationPoints}</li>
      </ul>

      <div className="not-prose my-6 rounded-lg border border-destructive/20 bg-destructive/5 p-5">
        <p className="text-sm font-medium text-destructive mb-1">{s.foreclosureRiskTitle}</p>
        <p className="text-sm text-muted-foreground">
          {s.foreclosureRiskDesc}
        </p>
      </div>
    </>
  )
}
