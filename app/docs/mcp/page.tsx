"use client"

import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  endpoint: string
  endpointDesc: string
  freeTools: string
  thTool: string
  thDescription: string
  thFee: string
  listLoansDesc: string
  getLoanDesc: string
  getAgentStatusDesc: string
  getAgentHistoryDesc: string
  getAgentConfigDesc: string
  getPointsDesc: string
  paidTools: string
  paidToolsDesc: string
  createAgentDesc: string
  setAgentConfigDesc: string
  createLendOfferDesc: string
  createBorrowRequestDesc: string
  acceptLendOfferDesc: string
  acceptBorrowRequestDesc: string
  repayLoanDesc: string
  swapTokensDesc: string
  x402Protocol: string
  antiReplay: string
  rateLimiting: string
  dynamicPricing: string
  devnetMode: string
  localDev: string
  localDevDesc: string
}> = {
  en: {
    title: "MCP Integration",
    lead: "14-tool Model Context Protocol server that lets any AI assistant interact with Agio programmatically. Paid tools use x402 USDC payments as auth.",
    endpoint: "Endpoint",
    endpointDesc: "Stateless, Web Standard Streamable HTTP transport. Compatible with any MCP client.",
    freeTools: "Free Tools (Read-Only)",
    thTool: "Tool",
    thDescription: "Description",
    thFee: "Fee",
    listLoansDesc: "Filter loans by status, type, token, wallet. Paginated.",
    getLoanDesc: "Fetch single loan with counterparty details",
    getAgentStatusDesc: "Check if user has an active agent",
    getAgentHistoryDesc: "Last 200 agent actions",
    getAgentConfigDesc: "Current agent strategy config",
    getPointsDesc: "Points balance with breakdown",
    paidTools: "Paid Tools (x402)",
    paidToolsDesc: "Write operations require an x402 payment header. The USDC transaction fee payer proves wallet ownership (payment = auth). All fees go to the protocol treasury.",
    createAgentDesc: "Initialize agent wallet via Privy",
    setAgentConfigDesc: "Update agent strategy",
    createLendOfferDesc: "Create lending offer",
    createBorrowRequestDesc: "Create borrow request",
    acceptLendOfferDesc: "Accept as borrower",
    acceptBorrowRequestDesc: "Accept as lender",
    repayLoanDesc: "Repay active loan",
    swapTokensDesc: "Swap via Jupiter aggregator",
    x402Protocol: "x402 Protocol",
    antiReplay: "Anti-replay — each payment nonce used once",
    rateLimiting: "Rate limiting — 1 request per wallet per 60s",
    dynamicPricing: "Dynamic pricing — tool prices configurable via Redis",
    devnetMode: "Devnet mode",
    localDev: "Local Development",
    localDevDesc: "For Claude Desktop or other local MCP clients, use the stdio transport wrapper:",
  },
  es: {
    title: "Integración MCP",
    lead: "Servidor del Protocolo de Contexto de Modelo con 14 herramientas que permite a cualquier asistente IA interactuar con Agio programáticamente. Las herramientas de pago usan pagos x402 USDC como autenticación.",
    endpoint: "Endpoint",
    endpointDesc: "Transporte HTTP Streamable estándar web sin estado. Compatible con cualquier cliente MCP.",
    freeTools: "Herramientas Gratuitas (Solo Lectura)",
    thTool: "Herramienta",
    thDescription: "Descripción",
    thFee: "Tarifa",
    listLoansDesc: "Filtrar préstamos por estado, tipo, token, wallet. Paginado.",
    getLoanDesc: "Obtener un préstamo individual con detalles de la contraparte",
    getAgentStatusDesc: "Verificar si el usuario tiene un agente activo",
    getAgentHistoryDesc: "Últimas 200 acciones del agente",
    getAgentConfigDesc: "Configuración actual de estrategia del agente",
    getPointsDesc: "Saldo de puntos con desglose",
    paidTools: "Herramientas de Pago (x402)",
    paidToolsDesc: "Las operaciones de escritura requieren un header de pago x402. El pagador de la tarifa de transacción USDC demuestra la propiedad de la wallet (pago = autenticación). Todas las tarifas van al tesoro del protocolo.",
    createAgentDesc: "Inicializar wallet del agente vía Privy",
    setAgentConfigDesc: "Actualizar estrategia del agente",
    createLendOfferDesc: "Crear oferta de préstamo",
    createBorrowRequestDesc: "Crear solicitud de préstamo",
    acceptLendOfferDesc: "Aceptar como prestatario",
    acceptBorrowRequestDesc: "Aceptar como prestamista",
    repayLoanDesc: "Pagar préstamo activo",
    swapTokensDesc: "Intercambiar vía agregador Jupiter",
    x402Protocol: "Protocolo x402",
    antiReplay: "Anti-replay — cada nonce de pago se usa una vez",
    rateLimiting: "Límite de tasa — 1 solicitud por wallet cada 60s",
    dynamicPricing: "Precios dinámicos — precios de herramientas configurables vía Redis",
    devnetMode: "Modo Devnet",
    localDev: "Desarrollo Local",
    localDevDesc: "Para Claude Desktop u otros clientes MCP locales, usa el wrapper de transporte stdio:",
  },
  pt: {
    title: "Integração MCP",
    lead: "Servidor do Protocolo de Contexto de Modelo com 14 ferramentas que permite a qualquer assistente IA interagir com o Agio programaticamente. Ferramentas pagas usam pagamentos x402 USDC como autenticação.",
    endpoint: "Endpoint",
    endpointDesc: "Transporte HTTP Streamable padrão web sem estado. Compatível com qualquer cliente MCP.",
    freeTools: "Ferramentas Gratuitas (Somente Leitura)",
    thTool: "Ferramenta",
    thDescription: "Descrição",
    thFee: "Taxa",
    listLoansDesc: "Filtrar empréstimos por status, tipo, token, wallet. Paginado.",
    getLoanDesc: "Buscar empréstimo individual com detalhes da contraparte",
    getAgentStatusDesc: "Verificar se o usuário tem um agente ativo",
    getAgentHistoryDesc: "Últimas 200 ações do agente",
    getAgentConfigDesc: "Configuração atual de estratégia do agente",
    getPointsDesc: "Saldo de pontos com detalhamento",
    paidTools: "Ferramentas Pagas (x402)",
    paidToolsDesc: "Operações de escrita requerem um header de pagamento x402. O pagador da taxa de transação USDC comprova a propriedade da wallet (pagamento = autenticação). Todas as taxas vão para o tesouro do protocolo.",
    createAgentDesc: "Inicializar wallet do agente via Privy",
    setAgentConfigDesc: "Atualizar estratégia do agente",
    createLendOfferDesc: "Criar oferta de empréstimo",
    createBorrowRequestDesc: "Criar solicitação de empréstimo",
    acceptLendOfferDesc: "Aceitar como mutuário",
    acceptBorrowRequestDesc: "Aceitar como credor",
    repayLoanDesc: "Pagar empréstimo ativo",
    swapTokensDesc: "Trocar via agregador Jupiter",
    x402Protocol: "Protocolo x402",
    antiReplay: "Anti-replay — cada nonce de pagamento usado uma vez",
    rateLimiting: "Limite de taxa — 1 solicitação por wallet a cada 60s",
    dynamicPricing: "Preços dinâmicos — preços das ferramentas configuráveis via Redis",
    devnetMode: "Modo Devnet",
    localDev: "Desenvolvimento Local",
    localDevDesc: "Para Claude Desktop ou outros clientes MCP locais, use o wrapper de transporte stdio:",
  },
  zh: {
    title: "MCP 集成",
    lead: "14 工具模型上下文协议服务器，让任何 AI 助手都能以编程方式与 Agio 交互。付费工具使用 x402 USDC 支付作为身份验证。",
    endpoint: "端点",
    endpointDesc: "无状态 Web 标准流式 HTTP 传输。兼容任何 MCP 客户端。",
    freeTools: "免费工具（只读）",
    thTool: "工具",
    thDescription: "说明",
    thFee: "费用",
    listLoansDesc: "按状态、类型、代币、钱包筛选贷款。支持分页。",
    getLoanDesc: "获取单笔贷款及交易对手详情",
    getAgentStatusDesc: "检查用户是否有活跃代理",
    getAgentHistoryDesc: "最近 200 条代理操作",
    getAgentConfigDesc: "当前代理策略配置",
    getPointsDesc: "积分余额及明细",
    paidTools: "付费工具 (x402)",
    paidToolsDesc: "写操作需要 x402 支付头。USDC 交易手续费支付者证明钱包所有权（支付 = 身份验证）。所有费用进入协议国库。",
    createAgentDesc: "通过 Privy 初始化代理钱包",
    setAgentConfigDesc: "更新代理策略",
    createLendOfferDesc: "创建出借报价",
    createBorrowRequestDesc: "创建借款请求",
    acceptLendOfferDesc: "作为借款人接受",
    acceptBorrowRequestDesc: "作为出借人接受",
    repayLoanDesc: "偿还活跃贷款",
    swapTokensDesc: "通过 Jupiter 聚合器兑换",
    x402Protocol: "x402 协议",
    antiReplay: "防重放——每个支付 nonce 仅使用一次",
    rateLimiting: "速率限制——每个钱包每 60 秒 1 个请求",
    dynamicPricing: "动态定价——工具价格可通过 Redis 配置",
    devnetMode: "Devnet 模式",
    localDev: "本地开发",
    localDevDesc: "对于 Claude Desktop 或其他本地 MCP 客户端，使用 stdio 传输包装器：",
  },
}

export default function McpPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.endpoint}</h2>
      <div className="not-prose my-4 rounded-lg border border-border/60 bg-card p-4">
        <code className="text-sm">POST /api/mcp</code>
        <p className="mt-2 text-sm text-muted-foreground">
          {s.endpointDesc}
          <br />
          Headers: <code>Content-Type: application/json</code>, <code>Accept: application/json, text/event-stream</code>
        </p>
      </div>

      <h2>{s.freeTools}</h2>
      <div className="not-prose my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 font-medium">{s.thTool}</th>
              <th className="pb-2 font-medium">{s.thDescription}</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">list-loans</td>
              <td>{s.listLoansDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">get-loan</td>
              <td>{s.getLoanDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">get-agent-status</td>
              <td>{s.getAgentStatusDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">get-agent-history</td>
              <td>{s.getAgentHistoryDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">get-agent-config</td>
              <td>{s.getAgentConfigDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">get-points</td>
              <td>{s.getPointsDesc}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>{s.paidTools}</h2>
      <p>
        {s.paidToolsDesc}
      </p>
      <div className="not-prose my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 font-medium">{s.thTool}</th>
              <th className="pb-2 font-medium">{s.thFee}</th>
              <th className="pb-2 font-medium">{s.thDescription}</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">create-agent</td>
              <td>$0.10</td>
              <td>{s.createAgentDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">set-agent-config</td>
              <td>Free</td>
              <td>{s.setAgentConfigDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">create-lend-offer</td>
              <td>Free</td>
              <td>{s.createLendOfferDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">create-borrow-request</td>
              <td>Free</td>
              <td>{s.createBorrowRequestDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">accept-lend-offer</td>
              <td>Free</td>
              <td>{s.acceptLendOfferDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">accept-borrow-request</td>
              <td>Free</td>
              <td>{s.acceptBorrowRequestDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">repay-loan</td>
              <td>Free</td>
              <td>{s.repayLoanDesc}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">swap-tokens</td>
              <td>0.05%</td>
              <td>{s.swapTokensDesc}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>{s.x402Protocol}</h2>
      <ul>
        <li><strong>{s.antiReplay}</strong></li>
        <li><strong>{s.rateLimiting}</strong></li>
        <li><strong>{s.dynamicPricing}</strong></li>
        <li><strong>{s.devnetMode}</strong> — <code>DEVNET_FREE_TOOLS=true</code> bypasses payment with API key auth</li>
      </ul>

      <h2>{s.localDev}</h2>
      <p>
        {s.localDevDesc}
      </p>
      <div className="not-prose my-4 rounded-lg border border-border/60 bg-card p-4">
        <code className="text-sm">npx ts-node scripts/mcp-stdio.ts</code>
      </div>
    </>
  )
}
