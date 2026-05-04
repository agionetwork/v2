"use client"

import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  whatIsIt: string
  whatIsItDesc: string
  howItWorks: string
  howItWorksDesc: string
  strategies: string
  lendingLabel: string
  lendingDesc: string
  borrowingLabel: string
  borrowingDesc: string
  swapsLabel: string
  swapsDesc: string
  socialLabel: string
  socialDesc: string
  executionCycle: string
  execStep1: string
  execStep2: string
  execStep3: string
  execStep4: string
  security: string
  secNonCustodial: string
  secNonCustodialDesc: string
  secAllowlist: string
  secAllowlistDesc: string
  secUserControls: string
  secUserControlsDesc: string
  activation: string
  activationDesc: string
}> = {
  en: {
    title: "Auto Loan",
    lead: "An automated bot that manages lending and borrowing positions 24/7 based on your configured strategy.",
    whatIsIt: "What is Auto Loan?",
    whatIsItDesc: "Auto Loan is the automation system built into Agio that executes lending operations on your behalf. It is not an AI agent. It is a deterministic bot that follows pre-configured rules. Each user can activate one Auto Loan instance with its own dedicated Solana wallet managed by Privy.",
    howItWorks: "How It Works",
    howItWorksDesc: "When you activate the bot, Agio creates a dedicated Solana keypair for it via Privy's server-side wallet infrastructure. The bot runs on scheduled cron cycles: it scans pending offers on the platform, matches them against your configured strategy parameters, and executes transactions automatically. All actions are logged to Redis with a full history of the last 200 entries.",
    strategies: "Strategies",
    lendingLabel: "Lending",
    lendingDesc: "Set min/max APY, loan size range, accepted collateral tokens, and enable auto-foreclosure for under-collateralized loans.",
    borrowingLabel: "Borrowing",
    borrowingDesc: "Set max APY you will pay, loan size range, collateral tokens to use, and enable auto-repay before loan expiry.",
    swapsLabel: "Swaps",
    swapsDesc: "Auto-rebalance tokens via Jupiter aggregator when the bot needs a different token to execute a strategy.",
    socialLabel: "Social",
    socialDesc: "Auto-accept incoming friend requests to grow your network passively.",
    executionCycle: "Execution Cycle",
    execStep1: "Check bot wallet balance (auto-airdrop SOL on devnet if below 0.05)",
    execStep2: "Scan all pending offers matching configured strategy rules",
    execStep3: "Build and sign transactions via Privy, broadcast via Helius RPC",
    execStep4: "Log actions to Redis (last 200 entries), send Dialect notifications",
    security: "Security",
    secNonCustodial: "Non-custodial",
    secNonCustodialDesc: "Privy manages the keypair server-side; Agio never has access to private keys",
    secAllowlist: "Instruction allowlist",
    secAllowlistDesc: "The bot can only execute pre-approved instruction types (lending ops, token transfers, price updates)",
    secUserControls: "User controls",
    secUserControlsDesc: "Activate/deactivate, withdraw funds, update strategy config at any time from the dashboard",
    activation: "Activation",
    activationDesc: "You can activate Auto Loan from the Agent tab in your dashboard. Once activated, fund the Auto Loan wallet with SOL (for transaction fees) and the tokens you want it to use. Configure your strategy parameters, and Auto Loan will start operating on the next cron cycle.",
  },
  es: {
    title: "Auto Loan",
    lead: "Un bot automatizado que gestiona posiciones de préstamos 24/7 según tu estrategia configurada.",
    whatIsIt: "Qué es Auto Loan?",
    whatIsItDesc: "Auto Loan es el sistema de automatización integrado en Agio que ejecuta operaciones de préstamos en tu nombre. No es un agente de IA. Es un bot determinístico que sigue reglas preconfiguradas. Cada usuario puede activar una instancia de Auto Loan con su propia wallet Solana dedicada gestionada por Privy.",
    howItWorks: "Cómo Funciona",
    howItWorksDesc: "Cuando activas el bot, Agio crea un par de claves Solana dedicado a través de la infraestructura de wallets del lado del servidor de Privy. El bot se ejecuta en ciclos cron programados: escanea ofertas pendientes en la plataforma, las compara con los parámetros de tu estrategia configurada y ejecuta transacciones automáticamente. Todas las acciones se registran en Redis con un historial completo de las últimas 200 entradas.",
    strategies: "Estrategias",
    lendingLabel: "Préstamos",
    lendingDesc: "Configura APY mín/máx, rango de tamaño de préstamo, tokens de garantía aceptados y habilita la auto-ejecución para préstamos sub-colateralizados.",
    borrowingLabel: "Endeudamiento",
    borrowingDesc: "Configura el APY máximo que pagarás, rango de tamaño de préstamo, tokens de garantía a usar y habilita el auto-pago antes del vencimiento.",
    swapsLabel: "Intercambios",
    swapsDesc: "Rebalancea tokens automáticamente vía el agregador Jupiter cuando el bot necesita un token diferente para ejecutar una estrategia.",
    socialLabel: "Social",
    socialDesc: "Acepta automáticamente solicitudes de amistad entrantes para hacer crecer tu red pasivamente.",
    executionCycle: "Ciclo de Ejecución",
    execStep1: "Verificar saldo de la wallet del bot (airdrop automático de SOL en devnet si está por debajo de 0.05)",
    execStep2: "Escanear todas las ofertas pendientes que coincidan con las reglas de estrategia configuradas",
    execStep3: "Construir y firmar transacciones vía Privy, transmitir vía Helius RPC",
    execStep4: "Registrar acciones en Redis (últimas 200 entradas), enviar notificaciones Dialect",
    security: "Seguridad",
    secNonCustodial: "Sin custodia",
    secNonCustodialDesc: "Privy gestiona el par de claves del lado del servidor; Agio nunca tiene acceso a las claves privadas",
    secAllowlist: "Lista de instrucciones permitidas",
    secAllowlistDesc: "El bot solo puede ejecutar tipos de instrucciones pre-aprobados (operaciones de préstamo, transferencias de tokens, actualizaciones de precios)",
    secUserControls: "Controles del usuario",
    secUserControlsDesc: "Activar/desactivar, retirar fondos, actualizar configuración de estrategia en cualquier momento desde el dashboard",
    activation: "Activación",
    activationDesc: "Puedes activar Auto Loan desde la pestaña Agente en tu dashboard. Una vez activado, fondea la wallet de Auto Loan con SOL (para tarifas de transacción) y los tokens que quieras que use. Configura los parámetros de tu estrategia y Auto Loan comenzará a operar en el próximo ciclo cron.",
  },
  pt: {
    title: "Auto Loan",
    lead: "Um bot automatizado que gerencia posições de empréstimos 24/7 com base na sua estratégia configurada.",
    whatIsIt: "O que é Auto Loan?",
    whatIsItDesc: "Auto Loan é o sistema de automação integrado ao Agio que executa operações de empréstimos em seu nome. Não é um agente de IA. É um bot determinístico que segue regras pré-configuradas. Cada usuário pode ativar uma instância do Auto Loan com sua própria wallet Solana dedicada gerenciada pelo Privy.",
    howItWorks: "Como Funciona",
    howItWorksDesc: "Quando você ativa o bot, o Agio cria um par de chaves Solana dedicado através da infraestrutura de wallets do lado do servidor do Privy. O bot é executado em ciclos cron programados: ele escaneia ofertas pendentes na plataforma, compara com os parâmetros da sua estratégia configurada e executa transações automaticamente. Todas as ações são registradas no Redis com um histórico completo das últimas 200 entradas.",
    strategies: "Estratégias",
    lendingLabel: "Empréstimos",
    lendingDesc: "Defina APY mín/máx, faixa de tamanho de empréstimo, tokens de garantia aceitos e habilite auto-execução para empréstimos sub-colateralizados.",
    borrowingLabel: "Endividamento",
    borrowingDesc: "Defina o APY máximo que pagará, faixa de tamanho de empréstimo, tokens de garantia a usar e habilite auto-pagamento antes do vencimento.",
    swapsLabel: "Trocas",
    swapsDesc: "Rebalanceie tokens automaticamente via agregador Jupiter quando o bot precisa de um token diferente para executar uma estratégia.",
    socialLabel: "Social",
    socialDesc: "Aceite automaticamente solicitações de amizade recebidas para expandir sua rede passivamente.",
    executionCycle: "Ciclo de Execução",
    execStep1: "Verificar saldo da wallet do bot (airdrop automático de SOL na devnet se abaixo de 0.05)",
    execStep2: "Escanear todas as ofertas pendentes que correspondam às regras de estratégia configuradas",
    execStep3: "Construir e assinar transações via Privy, transmitir via Helius RPC",
    execStep4: "Registrar ações no Redis (últimas 200 entradas), enviar notificações Dialect",
    security: "Segurança",
    secNonCustodial: "Sem custódia",
    secNonCustodialDesc: "Privy gerencia o par de chaves do lado do servidor; Agio nunca tem acesso às chaves privadas",
    secAllowlist: "Lista de instruções permitidas",
    secAllowlistDesc: "O bot só pode executar tipos de instruções pré-aprovados (operações de empréstimo, transferências de tokens, atualizações de preços)",
    secUserControls: "Controles do usuário",
    secUserControlsDesc: "Ativar/desativar, sacar fundos, atualizar configuração de estratégia a qualquer momento pelo dashboard",
    activation: "Ativação",
    activationDesc: "Você pode ativar o Auto Loan na aba Agente do seu dashboard. Uma vez ativado, financie a wallet do Auto Loan com SOL (para taxas de transação) e os tokens que você quer que ele use. Configure os parâmetros da sua estratégia e o Auto Loan começará a operar no próximo ciclo cron.",
  },
  zh: {
    title: "Auto Loan",
    lead: "一个自动化机器人，根据您配置的策略全天候管理借贷仓位。",
    whatIsIt: "什么是 Auto Loan？",
    whatIsItDesc: "Auto Loan 是 Agio 内置的自动化系统，代表您执行借贷操作。它不是 AI 代理。它是一个遵循预配置规则的确定性机器人。每个用户可以激活一个 Auto Loan 实例，拥有由 Privy 管理的专用 Solana 钱包。",
    howItWorks: "工作原理",
    howItWorksDesc: "当您激活机器人时，Agio 通过 Privy 的服务端钱包基础设施创建一个专用的 Solana 密钥对。机器人按计划 cron 周期运行：扫描平台上的待处理报价，与您配置的策略参数匹配，并自动执行交易。所有操作都记录到 Redis，保留最近 200 条的完整历史。",
    strategies: "策略",
    lendingLabel: "出借",
    lendingDesc: "设置最低/最高 APY、贷款规模范围、接受的抵押代币，并启用对抵押不足贷款的自动清算。",
    borrowingLabel: "借入",
    borrowingDesc: "设置您愿意支付的最高 APY、贷款规模范围、使用的抵押代币，并启用到期前自动还款。",
    swapsLabel: "兑换",
    swapsDesc: "当机器人需要不同代币来执行策略时，通过 Jupiter 聚合器自动再平衡代币。",
    socialLabel: "社交",
    socialDesc: "自动接受收到的好友请求，被动扩展您的网络。",
    executionCycle: "执行周期",
    execStep1: "检查机器人钱包余额（devnet 上余额低于 0.05 时自动空投 SOL）",
    execStep2: "扫描所有与配置策略规则匹配的待处理报价",
    execStep3: "通过 Privy 构建和签名交易，通过 Helius RPC 广播",
    execStep4: "将操作记录到 Redis（最近 200 条），发送 Dialect 通知",
    security: "安全性",
    secNonCustodial: "非托管",
    secNonCustodialDesc: "Privy 在服务端管理密钥对；Agio 永远无法访问私钥",
    secAllowlist: "指令白名单",
    secAllowlistDesc: "机器人只能执行预批准的指令类型（借贷操作、代币转账、价格更新）",
    secUserControls: "用户控制",
    secUserControlsDesc: "随时从仪表板激活/停用、提取资金、更新策略配置",
    activation: "激活",
    activationDesc: "您可以从仪表板的代理标签页激活 Auto Loan。激活后，用 SOL（用于交易费）和您希望 Auto Loan 使用的代币为其钱包充值。配置您的策略参数，Auto Loan 将在下一个 cron 周期开始运行。",
  },
}

export default function LendingBotPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.whatIsIt}</h2>
      <p>{s.whatIsItDesc}</p>

      <h2>{s.howItWorks}</h2>
      <p>{s.howItWorksDesc}</p>

      <h2>{s.strategies}</h2>

      <div className="not-prose my-6 space-y-4">
        <div className="rounded-lg border border-border/60 bg-card p-5">
          <h4 className="mb-2 text-sm font-semibold">{s.lendingLabel}</h4>
          <p className="text-sm text-muted-foreground">{s.lendingDesc}</p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-5">
          <h4 className="mb-2 text-sm font-semibold">{s.borrowingLabel}</h4>
          <p className="text-sm text-muted-foreground">{s.borrowingDesc}</p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-5">
          <h4 className="mb-2 text-sm font-semibold">{s.swapsLabel}</h4>
          <p className="text-sm text-muted-foreground">{s.swapsDesc}</p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-5">
          <h4 className="mb-2 text-sm font-semibold">{s.socialLabel}</h4>
          <p className="text-sm text-muted-foreground">{s.socialDesc}</p>
        </div>
      </div>

      <h2>{s.executionCycle}</h2>
      <ol>
        <li>{s.execStep1}</li>
        <li>{s.execStep2}</li>
        <li>{s.execStep3}</li>
        <li>{s.execStep4}</li>
      </ol>

      <h2>{s.security}</h2>
      <ul>
        <li><strong>{s.secNonCustodial}</strong>: {s.secNonCustodialDesc}</li>
        <li><strong>{s.secAllowlist}</strong>: {s.secAllowlistDesc}</li>
        <li><strong>{s.secUserControls}</strong>: {s.secUserControlsDesc}</li>
      </ul>

      <h2>{s.activation}</h2>
      <p>{s.activationDesc}</p>
    </>
  )
}
