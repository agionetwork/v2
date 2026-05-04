"use client"

import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  p2pVsPooled: string
  thAgio: string
  thPooled: string
  capitalIsolation: string
  capitalP2P: string
  capitalPooled: string
  terms: string
  termsP2P: string
  termsPooled: string
  counterparty: string
  counterpartyP2P: string
  counterpartyPooled: string
  cascadeRisk: string
  cascadeP2P: string
  cascadePooled: string
  loanLifecycle: string
  steps: string[]
  step1Label: string
  step1Desc: string
  step2Label: string
  step2Desc: string
  step3Label: string
  step3Desc: string
  step4Label: string
  step4Desc: string
  collateralTitle: string
  offerCreation: string
  acceptance: string
  foreclosureTrigger: string
  collateralDesc: string
  interestTitle: string
  interestDesc: string
  feesTitle: string
  fee1: string
  fee2: string
  accountsTitle: string
  loanPDA: string
  vaultPDA: string
  priceFeedPDA: string
}> = {
  en: {
    title: "How It Works?",
    lead: "The core mechanics behind Agio\u2019s P2P lending protocol.",
    p2pVsPooled: "P2P vs Pooled Lending",
    thAgio: "Agio (P2P)",
    thPooled: "Pooled (Aave/Compound)",
    capitalIsolation: "Capital isolation",
    capitalP2P: "Each loan is independent",
    capitalPooled: "All depositors share one pool",
    terms: "Terms",
    termsP2P: "Custom per loan",
    termsPooled: "Algorithmic, one-size-fits-all",
    counterparty: "Counterparty",
    counterpartyP2P: "Known — visible wallet",
    counterpartyPooled: "Anonymous pool",
    cascadeRisk: "Cascade risk",
    cascadeP2P: "None — one default is contained",
    cascadePooled: "Bad debt socialised across pool",
    loanLifecycle: "Loan Lifecycle",
    steps: ["Pending", "Accepted", "Repaid / Foreclosed"],
    step1Label: "Pending",
    step1Desc: "offer created on-chain. Lend offers escrow debt tokens in the vault; borrow requests hold no funds yet. Either party can rescind.",
    step2Label: "Accepted",
    step2Desc: "counterparty matches. Collateral deposited to vault, debt tokens released to borrower, 1% origination fee to treasury. Loan clock starts.",
    step3Label: "Repaid",
    step3Desc: "borrower pays principal + full-term interest. Collateral returned.",
    step4Label: "Foreclosed",
    step4Desc: "collateral ratio drops below 120%. Lender seizes collateral.",
    collateralTitle: "Collateral & Pyth Oracles",
    offerCreation: "Offer creation:",
    acceptance: "Acceptance: minimum",
    foreclosureTrigger: "Foreclosure trigger: ratio falls",
    collateralDesc: "Prices come from Pyth Network. Before every collateral-sensitive operation (accept, foreclose), the client fetches signed price attestations from Pyth Hermes and posts them on-chain via post_update_atomic. The program rejects prices older than 5 minutes (MAX_PYTH_PRICE_AGE_SECS = 300).",
    interestTitle: "Interest",
    interestDesc: "Full-term interest is charged regardless of early repayment. A 30-day loan repaid on day 10 still pays 30 days of interest. This gives lenders predictable yield.",
    feesTitle: "Fees",
    fee1: "1% origination fee on the loan amount, collected at acceptance, sent to the protocol treasury (VaultAuthority PDA).",
    fee2: "Solana tx fees — fractions of a cent per transaction.",
    accountsTitle: "On-Chain Accounts",
    loanPDA: "stores both parties, amounts, rates, status, timestamps.",
    vaultPDA: "program-owned escrow for collateral + treasury address + fee basis points.",
    priceFeedPDA: "cached Pyth oracle data per token mint.",
  },
  es: {
    title: "¿Cómo Funciona?",
    lead: "Los mecanismos fundamentales del protocolo de préstamos P2P de Agio.",
    p2pVsPooled: "P2P vs Préstamos en Pool",
    thAgio: "Agio (P2P)",
    thPooled: "Pool (Aave/Compound)",
    capitalIsolation: "Aislamiento de capital",
    capitalP2P: "Cada préstamo es independiente",
    capitalPooled: "Todos los depositantes comparten un pool",
    terms: "Términos",
    termsP2P: "Personalizado por préstamo",
    termsPooled: "Algorítmico, igual para todos",
    counterparty: "Contraparte",
    counterpartyP2P: "Conocida — wallet visible",
    counterpartyPooled: "Pool anónimo",
    cascadeRisk: "Riesgo en cascada",
    cascadeP2P: "Ninguno — un impago queda contenido",
    cascadePooled: "La deuda incobrable se socializa en el pool",
    loanLifecycle: "Ciclo de Vida del Préstamo",
    steps: ["Pendiente", "Aceptado", "Pagado / Ejecutado"],
    step1Label: "Pendiente",
    step1Desc: "oferta creada on-chain. Las ofertas de préstamo depositan tokens de deuda en la bóveda; las solicitudes de préstamo aún no retienen fondos. Cualquier parte puede rescindir.",
    step2Label: "Aceptado",
    step2Desc: "la contraparte acepta. La garantía se deposita en la bóveda, los tokens de deuda se liberan al prestatario, comisión de originación del 1% al tesoro. El reloj del préstamo comienza.",
    step3Label: "Pagado",
    step3Desc: "el prestatario paga principal + intereses del plazo completo. Se devuelve la garantía.",
    step4Label: "Ejecutado",
    step4Desc: "el ratio de garantía cae por debajo del 120%. El prestamista confisca la garantía.",
    collateralTitle: "Garantía y Oráculos Pyth",
    offerCreation: "Creación de oferta:",
    acceptance: "Aceptación: mínimo",
    foreclosureTrigger: "Activación de ejecución: el ratio cae",
    collateralDesc: "Los precios provienen de Pyth Network. Antes de cada operación sensible a la garantía (aceptar, ejecutar), el cliente obtiene atestaciones de precios firmadas de Pyth Hermes y las publica on-chain vía post_update_atomic. El programa rechaza precios con más de 5 minutos (MAX_PYTH_PRICE_AGE_SECS = 300).",
    interestTitle: "Intereses",
    interestDesc: "Se cobran los intereses del plazo completo independientemente del pago anticipado. Un préstamo de 30 días pagado el día 10 sigue pagando 30 días de intereses. Esto da a los prestamistas un rendimiento predecible.",
    feesTitle: "Comisiones",
    fee1: "Comisión de originación del 1% sobre el monto del préstamo, cobrada en la aceptación, enviada al tesoro del protocolo (VaultAuthority PDA).",
    fee2: "Comisiones de tx de Solana — fracciones de centavo por transacción.",
    accountsTitle: "Cuentas On-Chain",
    loanPDA: "almacena ambas partes, montos, tasas, estado, marcas de tiempo.",
    vaultPDA: "custodia del programa para garantía + dirección del tesoro + puntos base de comisión.",
    priceFeedPDA: "datos de oráculo Pyth en caché por token mint.",
  },
  pt: {
    title: "Como Funciona?",
    lead: "Os mecanismos fundamentais por trás do protocolo de empréstimos P2P da Agio.",
    p2pVsPooled: "P2P vs Empréstimos em Pool",
    thAgio: "Agio (P2P)",
    thPooled: "Pool (Aave/Compound)",
    capitalIsolation: "Isolamento de capital",
    capitalP2P: "Cada empréstimo é independente",
    capitalPooled: "Todos os depositantes compartilham um pool",
    terms: "Termos",
    termsP2P: "Personalizado por empréstimo",
    termsPooled: "Algorítmico, igual para todos",
    counterparty: "Contraparte",
    counterpartyP2P: "Conhecida — wallet visível",
    counterpartyPooled: "Pool anônimo",
    cascadeRisk: "Risco em cascata",
    cascadeP2P: "Nenhum — um default fica contido",
    cascadePooled: "Dívida ruim socializada no pool",
    loanLifecycle: "Ciclo de Vida do Empréstimo",
    steps: ["Pendente", "Aceito", "Pago / Executado"],
    step1Label: "Pendente",
    step1Desc: "oferta criada on-chain. Ofertas de empréstimo depositam tokens de dívida no cofre; solicitações de empréstimo ainda não retêm fundos. Qualquer parte pode rescindir.",
    step2Label: "Aceito",
    step2Desc: "contraparte aceita. Garantia depositada no cofre, tokens de dívida liberados ao mutuário, taxa de originação de 1% para o tesouro. O relógio do empréstimo começa.",
    step3Label: "Pago",
    step3Desc: "mutuário paga principal + juros do prazo completo. Garantia devolvida.",
    step4Label: "Executado",
    step4Desc: "taxa de garantia cai abaixo de 120%. O credor confisca a garantia.",
    collateralTitle: "Garantia e Oráculos Pyth",
    offerCreation: "Criação de oferta:",
    acceptance: "Aceitação: mínimo",
    foreclosureTrigger: "Gatilho de execução: a taxa cai",
    collateralDesc: "Os preços vêm da Pyth Network. Antes de cada operação sensível à garantia (aceitar, executar), o cliente obtém atestações de preços assinadas do Pyth Hermes e as publica on-chain via post_update_atomic. O programa rejeita preços com mais de 5 minutos (MAX_PYTH_PRICE_AGE_SECS = 300).",
    interestTitle: "Juros",
    interestDesc: "Os juros do prazo completo são cobrados independentemente do pagamento antecipado. Um empréstimo de 30 dias pago no dia 10 ainda paga 30 dias de juros. Isso dá aos credores um rendimento previsível.",
    feesTitle: "Taxas",
    fee1: "Taxa de originação de 1% sobre o valor do empréstimo, cobrada na aceitação, enviada ao tesouro do protocolo (VaultAuthority PDA).",
    fee2: "Taxas de tx da Solana — frações de centavo por transação.",
    accountsTitle: "Contas On-Chain",
    loanPDA: "armazena ambas as partes, valores, taxas, status, timestamps.",
    vaultPDA: "custódia do programa para garantia + endereço do tesouro + pontos base de taxa.",
    priceFeedPDA: "dados de oráculo Pyth em cache por token mint.",
  },
  zh: {
    title: "工作原理？",
    lead: "Agio P2P 借贷协议的核心机制。",
    p2pVsPooled: "P2P 与池化借贷对比",
    thAgio: "Agio (P2P)",
    thPooled: "池化 (Aave/Compound)",
    capitalIsolation: "资金隔离",
    capitalP2P: "每笔贷款独立运作",
    capitalPooled: "所有存款人共享一个资金池",
    terms: "条款",
    termsP2P: "每笔贷款自定义",
    termsPooled: "算法化，一刀切",
    counterparty: "交易对手",
    counterpartyP2P: "已知——钱包可见",
    counterpartyPooled: "匿名资金池",
    cascadeRisk: "级联风险",
    cascadeP2P: "无——单笔违约被隔离",
    cascadePooled: "坏账在资金池中社会化分摊",
    loanLifecycle: "贷款生命周期",
    steps: ["待处理", "已接受", "已偿还 / 已清算"],
    step1Label: "待处理",
    step1Desc: "报价在链上创建。出借报价将债务代币托管在金库中；借款请求尚未锁定资金。任何一方都可以撤销。",
    step2Label: "已接受",
    step2Desc: "交易对手匹配。抵押品存入金库，债务代币释放给借款人，1% 发起费进入国库。贷款计时开始。",
    step3Label: "已偿还",
    step3Desc: "借款人支付本金 + 全期利息。抵押品返还。",
    step4Label: "已清算",
    step4Desc: "抵押率降至 120% 以下。出借方没收抵押品。",
    collateralTitle: "抵押品与 Pyth 预言机",
    offerCreation: "创建报价：",
    acceptance: "接受：最低",
    foreclosureTrigger: "清算触发：比率降至",
    collateralDesc: "价格来自 Pyth Network。在每次抵押品敏感操作（接受、清算）之前，客户端从 Pyth Hermes 获取签名价格证明并通过 post_update_atomic 发布到链上。程序会拒绝超过 5 分钟的价格（MAX_PYTH_PRICE_AGE_SECS = 300）。",
    interestTitle: "利息",
    interestDesc: "无论是否提前还款，均按全期收取利息。30 天贷款在第 10 天偿还仍需支付 30 天利息。这为出借方提供了可预测的收益。",
    feesTitle: "费用",
    fee1: "贷款金额的 1% 发起费，在接受时收取，发送至协议国库（VaultAuthority PDA）。",
    fee2: "Solana 交易费——每笔交易不到一美分。",
    accountsTitle: "链上账户",
    loanPDA: "存储双方信息、金额、利率、状态、时间戳。",
    vaultPDA: "程序拥有的抵押品托管 + 国库地址 + 费率基点。",
    priceFeedPDA: "每个代币 mint 的缓存 Pyth 预言机数据。",
  },
}

export default function CoreConceptsPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.p2pVsPooled}</h2>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 font-medium"></th>
              <th className="pb-2 font-medium">{s.thAgio}</th>
              <th className="pb-2 font-medium">{s.thPooled}</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.capitalIsolation}</td>
              <td>{s.capitalP2P}</td>
              <td>{s.capitalPooled}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.terms}</td>
              <td>{s.termsP2P}</td>
              <td>{s.termsPooled}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.counterparty}</td>
              <td>{s.counterpartyP2P}</td>
              <td>{s.counterpartyPooled}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.cascadeRisk}</td>
              <td>{s.cascadeP2P}</td>
              <td>{s.cascadePooled}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>{s.loanLifecycle}</h2>
      <div className="not-prose my-6 flex flex-wrap items-center gap-2 text-sm">
        {s.steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <span className="flex h-8 items-center rounded-full bg-primary/10 px-4 font-medium text-primary">
              {step}
            </span>
            {i < 2 && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-muted-foreground">
                <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <ol>
        <li><strong>{s.step1Label}</strong> — {s.step1Desc}</li>
        <li><strong>{s.step2Label}</strong> — {s.step2Desc}</li>
        <li><strong>{s.step3Label}</strong> — {s.step3Desc}</li>
        <li><strong>{s.step4Label}</strong> — {s.step4Desc}</li>
      </ol>

      <h2>{s.collateralTitle}</h2>
      <div className="not-prose my-6 rounded-lg border border-border/60 bg-card p-5">
        <code className="block rounded bg-muted px-4 py-3 text-sm">
          collateral_ratio = (collateral_value_usd / debt_value_usd) &times; 100%
        </code>
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          <li>{s.offerCreation} <strong>150% &ndash; 300%</strong></li>
          <li>{s.acceptance} <strong>130%</strong> (on-chain enforced)</li>
          <li>{s.foreclosureTrigger} <strong>below 120%</strong></li>
        </ul>
      </div>
      <p>
        {s.collateralDesc}
      </p>

      <h2>{s.interestTitle}</h2>
      <div className="not-prose my-6 rounded-lg border border-border/60 bg-card p-5">
        <code className="block rounded bg-muted px-4 py-3 text-sm">
          interest = principal &times; APY &times; duration_seconds / (100 &times; 365 &times; 86400)
        </code>
        <p className="mt-3 text-sm text-muted-foreground">
          {s.interestDesc}
        </p>
      </div>

      <h2>{s.feesTitle}</h2>
      <ul>
        <li><strong>{s.fee1}</strong></li>
        <li><strong>{s.fee2}</strong></li>
      </ul>

      <h2>{s.accountsTitle}</h2>
      <ul>
        <li><strong>Loan PDA</strong> <code>[&quot;loan&quot;, createKey]</code> — {s.loanPDA}</li>
        <li><strong>VaultAuthority PDA</strong> <code>[&quot;vault_authority&quot;]</code> — {s.vaultPDA}</li>
        <li><strong>PriceFeedConfig PDA</strong> <code>[&quot;price_feed&quot;, mint]</code> — {s.priceFeedPDA}</li>
      </ul>
    </>
  )
}
