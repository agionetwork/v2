"use client"

import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  overview: string
  overviewDesc: string
  connecting: string
  connectingDesc: string
  connectingStep1: string
  connectingStep2: string
  connectingStep3: string
  connectingStep4: string
  remoteConfig: string
  remoteConfigDesc: string
  localConfig: string
  localConfigDesc: string
  availableTools: string
  availableToolsDesc: string
  freeTools: string
  freeToolsDesc: string
  paidTools: string
  paidToolsDesc: string
  authentication: string
  authenticationDesc: string
  exampleWorkflow: string
  exampleWorkflowDesc: string
  exStep1: string
  exStep2: string
  exStep3: string
  exStep4: string
  exStep5: string
  compatibility: string
  compatibilityDesc: string
  compatClient1: string
  compatClient2: string
  compatClient3: string
  compatClient4: string
  learnMore: string
  learnMoreDesc: string
}> = {
  en: {
    title: "AI Agents",
    lead: "Connect any AI agent to Agio through the Model Context Protocol (MCP). Your agent can browse loans, create offers, accept deals, and manage positions programmatically.",
    overview: "Overview",
    overviewDesc: "Agio exposes a 14-tool MCP server that any AI assistant or autonomous agent can connect to. Through MCP, external agents can interact with the full lending protocol — reading loan data, creating offers, accepting loans, repaying, and even swapping tokens via Jupiter. This is different from the built-in Lending Bot: while the bot follows pre-configured rules, MCP-connected agents can reason about market conditions and make dynamic decisions.",
    connecting: "Connecting Your Agent",
    connectingDesc: "To connect an AI agent to Agio via MCP:",
    connectingStep1: "Point your MCP client to the Agio endpoint: POST https://agio.network/api/mcp",
    connectingStep2: "Set the required headers: Content-Type: application/json and Accept: application/json, text/event-stream",
    connectingStep3: "For read-only operations (listing loans, checking status), no authentication is needed",
    connectingStep4: "For write operations (creating offers, accepting loans), the agent must include an x402 USDC payment header that proves wallet ownership",
    remoteConfig: "Remote Configuration",
    remoteConfigDesc: "Add Agio as an MCP server in your agent's configuration:",
    localConfig: "Local Development",
    localConfigDesc: "For local MCP clients like Claude Desktop, use the stdio transport wrapper:",
    availableTools: "Available Tools",
    availableToolsDesc: "The MCP server provides 14 tools organized into free (read-only) and paid (write) operations.",
    freeTools: "Free Tools",
    freeToolsDesc: "list-loans, get-loan, get-agent-status, get-agent-history, get-agent-config, get-points — these read-only tools require no authentication and let your agent browse the platform state.",
    paidTools: "Paid Tools",
    paidToolsDesc: "create-agent, set-agent-config, create-lend-offer, create-borrow-request, accept-lend-offer, accept-borrow-request, repay-loan, swap-tokens — write operations that modify on-chain state. Most lending operations are free (1% origination fee is collected on-chain). Only create-agent ($0.10) and swap-tokens (0.05%) require x402 payment.",
    authentication: "Authentication via x402",
    authenticationDesc: "Agio uses the x402 protocol for paid tool authentication. Instead of API keys, the agent sends a signed USDC transaction as a payment header. The transaction fee payer address proves wallet ownership — payment doubles as auth. Each payment nonce can only be used once (anti-replay), and there is a rate limit of 1 request per wallet per 60 seconds. On devnet, the DEVNET_FREE_TOOLS=true flag bypasses payment requirements.",
    exampleWorkflow: "Example Workflow",
    exampleWorkflowDesc: "Here is how an AI agent might use Agio through MCP:",
    exStep1: "Call list-loans to scan available lending offers with favorable APY",
    exStep2: "Call get-loan on interesting offers to check collateral ratios and borrower history",
    exStep3: "Decide to accept a loan based on risk analysis",
    exStep4: "Call accept-lend-offer with the loan public key and wallet address",
    exStep5: "Monitor the position with get-loan and repay-loan when conditions are met",
    compatibility: "Compatible Clients",
    compatibilityDesc: "Any MCP-compatible client can connect to Agio:",
    compatClient1: "Claude Desktop — add Agio as a remote MCP server or use the local stdio wrapper",
    compatClient2: "Claude Code — connect via the MCP server configuration",
    compatClient3: "Custom agents — any agent using the MCP SDK can call Agio tools directly",
    compatClient4: "Other MCP clients — Cursor, Windsurf, or any client supporting Streamable HTTP transport",
    learnMore: "Learn More",
    learnMoreDesc: "For detailed tool schemas, parameters, and response formats, see the MCP Integration documentation.",
  },
  es: {
    title: "Agentes IA",
    lead: "Conecta cualquier agente IA a Agio a través del Model Context Protocol (MCP). Tu agente puede explorar préstamos, crear ofertas, aceptar acuerdos y gestionar posiciones programáticamente.",
    overview: "Descripción General",
    overviewDesc: "Agio expone un servidor MCP con 14 herramientas al que cualquier asistente IA o agente autónomo puede conectarse. A través de MCP, agentes externos pueden interactuar con el protocolo completo de préstamos — leyendo datos de préstamos, creando ofertas, aceptando préstamos, pagando e incluso intercambiando tokens vía Jupiter. Esto es diferente del Bot de Préstamos integrado: mientras el bot sigue reglas preconfiguradas, los agentes conectados por MCP pueden razonar sobre condiciones de mercado y tomar decisiones dinámicas.",
    connecting: "Conectar Tu Agente",
    connectingDesc: "Para conectar un agente IA a Agio vía MCP:",
    connectingStep1: "Apunta tu cliente MCP al endpoint de Agio: POST https://agio.network/api/mcp",
    connectingStep2: "Configura los headers requeridos: Content-Type: application/json y Accept: application/json, text/event-stream",
    connectingStep3: "Para operaciones de solo lectura (listar préstamos, verificar estado), no se necesita autenticación",
    connectingStep4: "Para operaciones de escritura (crear ofertas, aceptar préstamos), el agente debe incluir un header de pago x402 USDC que demuestre la propiedad de la wallet",
    remoteConfig: "Configuración Remota",
    remoteConfigDesc: "Agrega Agio como servidor MCP en la configuración de tu agente:",
    localConfig: "Desarrollo Local",
    localConfigDesc: "Para clientes MCP locales como Claude Desktop, usa el wrapper de transporte stdio:",
    availableTools: "Herramientas Disponibles",
    availableToolsDesc: "El servidor MCP provee 14 herramientas organizadas en operaciones gratuitas (solo lectura) y de pago (escritura).",
    freeTools: "Herramientas Gratuitas",
    freeToolsDesc: "list-loans, get-loan, get-agent-status, get-agent-history, get-agent-config, get-points — estas herramientas de solo lectura no requieren autenticación y permiten a tu agente explorar el estado de la plataforma.",
    paidTools: "Herramientas de Pago",
    paidToolsDesc: "create-agent, set-agent-config, create-lend-offer, create-borrow-request, accept-lend-offer, accept-borrow-request, repay-loan, swap-tokens — operaciones de escritura que modifican el estado on-chain. La mayoría de operaciones de préstamo son gratuitas (1% de tarifa de originación se cobra on-chain). Solo create-agent ($0.10) y swap-tokens (0.05%) requieren pago x402.",
    authentication: "Autenticación vía x402",
    authenticationDesc: "Agio usa el protocolo x402 para autenticación de herramientas de pago. En lugar de claves API, el agente envía una transacción USDC firmada como header de pago. La dirección del pagador de la tarifa demuestra la propiedad de la wallet — el pago funciona como autenticación. Cada nonce de pago solo puede usarse una vez (anti-replay), y hay un límite de 1 solicitud por wallet cada 60 segundos. En devnet, la flag DEVNET_FREE_TOOLS=true omite los requisitos de pago.",
    exampleWorkflow: "Flujo de Trabajo de Ejemplo",
    exampleWorkflowDesc: "Así es como un agente IA podría usar Agio a través de MCP:",
    exStep1: "Llamar list-loans para escanear ofertas de préstamo disponibles con APY favorable",
    exStep2: "Llamar get-loan en ofertas interesantes para verificar ratios de garantía e historial del prestatario",
    exStep3: "Decidir aceptar un préstamo basado en análisis de riesgo",
    exStep4: "Llamar accept-lend-offer con la clave pública del préstamo y la dirección de la wallet",
    exStep5: "Monitorear la posición con get-loan y repay-loan cuando se cumplan las condiciones",
    compatibility: "Clientes Compatibles",
    compatibilityDesc: "Cualquier cliente compatible con MCP puede conectarse a Agio:",
    compatClient1: "Claude Desktop — agrega Agio como servidor MCP remoto o usa el wrapper stdio local",
    compatClient2: "Claude Code — conecta vía la configuración del servidor MCP",
    compatClient3: "Agentes personalizados — cualquier agente que use el SDK MCP puede llamar las herramientas de Agio directamente",
    compatClient4: "Otros clientes MCP — Cursor, Windsurf, o cualquier cliente que soporte transporte Streamable HTTP",
    learnMore: "Más Información",
    learnMoreDesc: "Para esquemas detallados de herramientas, parámetros y formatos de respuesta, consulta la documentación de Integración MCP.",
  },
  pt: {
    title: "Agentes IA",
    lead: "Conecte qualquer agente IA ao Agio através do Model Context Protocol (MCP). Seu agente pode navegar empréstimos, criar ofertas, aceitar acordos e gerenciar posições programaticamente.",
    overview: "Visão Geral",
    overviewDesc: "O Agio expõe um servidor MCP com 14 ferramentas ao qual qualquer assistente IA ou agente autônomo pode se conectar. Através do MCP, agentes externos podem interagir com o protocolo completo de empréstimos — lendo dados de empréstimos, criando ofertas, aceitando empréstimos, pagando e até trocando tokens via Jupiter. Isso é diferente do Bot de Empréstimos integrado: enquanto o bot segue regras pré-configuradas, agentes conectados por MCP podem raciocinar sobre condições de mercado e tomar decisões dinâmicas.",
    connecting: "Conectar Seu Agente",
    connectingDesc: "Para conectar um agente IA ao Agio via MCP:",
    connectingStep1: "Aponte seu cliente MCP para o endpoint do Agio: POST https://agio.network/api/mcp",
    connectingStep2: "Configure os headers necessários: Content-Type: application/json e Accept: application/json, text/event-stream",
    connectingStep3: "Para operações somente leitura (listar empréstimos, verificar status), não é necessária autenticação",
    connectingStep4: "Para operações de escrita (criar ofertas, aceitar empréstimos), o agente deve incluir um header de pagamento x402 USDC que comprove a propriedade da wallet",
    remoteConfig: "Configuração Remota",
    remoteConfigDesc: "Adicione o Agio como servidor MCP na configuração do seu agente:",
    localConfig: "Desenvolvimento Local",
    localConfigDesc: "Para clientes MCP locais como Claude Desktop, use o wrapper de transporte stdio:",
    availableTools: "Ferramentas Disponíveis",
    availableToolsDesc: "O servidor MCP fornece 14 ferramentas organizadas em operações gratuitas (somente leitura) e pagas (escrita).",
    freeTools: "Ferramentas Gratuitas",
    freeToolsDesc: "list-loans, get-loan, get-agent-status, get-agent-history, get-agent-config, get-points — essas ferramentas somente leitura não requerem autenticação e permitem que seu agente explore o estado da plataforma.",
    paidTools: "Ferramentas Pagas",
    paidToolsDesc: "create-agent, set-agent-config, create-lend-offer, create-borrow-request, accept-lend-offer, accept-borrow-request, repay-loan, swap-tokens — operações de escrita que modificam o estado on-chain. A maioria das operações de empréstimo são gratuitas (1% de taxa de originação é cobrada on-chain). Apenas create-agent ($0.10) e swap-tokens (0.05%) requerem pagamento x402.",
    authentication: "Autenticação via x402",
    authenticationDesc: "O Agio usa o protocolo x402 para autenticação de ferramentas pagas. Em vez de chaves API, o agente envia uma transação USDC assinada como header de pagamento. O endereço do pagador da taxa comprova a propriedade da wallet — o pagamento funciona como autenticação. Cada nonce de pagamento só pode ser usado uma vez (anti-replay), e há um limite de 1 solicitação por wallet a cada 60 segundos. Na devnet, a flag DEVNET_FREE_TOOLS=true ignora os requisitos de pagamento.",
    exampleWorkflow: "Fluxo de Trabalho Exemplo",
    exampleWorkflowDesc: "Veja como um agente IA pode usar o Agio através do MCP:",
    exStep1: "Chamar list-loans para escanear ofertas de empréstimo disponíveis com APY favorável",
    exStep2: "Chamar get-loan em ofertas interessantes para verificar índices de garantia e histórico do tomador",
    exStep3: "Decidir aceitar um empréstimo com base na análise de risco",
    exStep4: "Chamar accept-lend-offer com a chave pública do empréstimo e endereço da wallet",
    exStep5: "Monitorar a posição com get-loan e repay-loan quando as condições forem atendidas",
    compatibility: "Clientes Compatíveis",
    compatibilityDesc: "Qualquer cliente compatível com MCP pode se conectar ao Agio:",
    compatClient1: "Claude Desktop — adicione o Agio como servidor MCP remoto ou use o wrapper stdio local",
    compatClient2: "Claude Code — conecte via a configuração do servidor MCP",
    compatClient3: "Agentes personalizados — qualquer agente usando o SDK MCP pode chamar as ferramentas do Agio diretamente",
    compatClient4: "Outros clientes MCP — Cursor, Windsurf, ou qualquer cliente que suporte transporte Streamable HTTP",
    learnMore: "Saiba Mais",
    learnMoreDesc: "Para esquemas detalhados de ferramentas, parâmetros e formatos de resposta, consulte a documentação de Integração MCP.",
  },
  zh: {
    title: "AI 代理",
    lead: "通过模型上下文协议 (MCP) 将任何 AI 代理连接到 Agio。您的代理可以浏览贷款、创建报价、接受交易并以编程方式管理仓位。",
    overview: "概述",
    overviewDesc: "Agio 公开了一个 14 工具的 MCP 服务器，任何 AI 助手或自主代理都可以连接。通过 MCP，外部代理可以与完整的借贷协议交互——读取贷款数据、创建报价、接受贷款、还款，甚至通过 Jupiter 兑换代币。这与内置的借贷机器人不同：机器人遵循预配置的规则，而通过 MCP 连接的代理可以推理市场条件并做出动态决策。",
    connecting: "连接您的代理",
    connectingDesc: "通过 MCP 将 AI 代理连接到 Agio：",
    connectingStep1: "将您的 MCP 客户端指向 Agio 端点：POST https://agio.network/api/mcp",
    connectingStep2: "设置所需的请求头：Content-Type: application/json 和 Accept: application/json, text/event-stream",
    connectingStep3: "只读操作（列出贷款、检查状态）不需要身份验证",
    connectingStep4: "写操作（创建报价、接受贷款）需要代理包含一个 x402 USDC 支付头来证明钱包所有权",
    remoteConfig: "远程配置",
    remoteConfigDesc: "在代理配置中添加 Agio 作为 MCP 服务器：",
    localConfig: "本地开发",
    localConfigDesc: "对于 Claude Desktop 等本地 MCP 客户端，使用 stdio 传输包装器：",
    availableTools: "可用工具",
    availableToolsDesc: "MCP 服务器提供 14 个工具，分为免费（只读）和付费（写入）操作。",
    freeTools: "免费工具",
    freeToolsDesc: "list-loans、get-loan、get-agent-status、get-agent-history、get-agent-config、get-points——这些只读工具不需要身份验证，让您的代理浏览平台状态。",
    paidTools: "付费工具",
    paidToolsDesc: "create-agent、set-agent-config、create-lend-offer、create-borrow-request、accept-lend-offer、accept-borrow-request、repay-loan、swap-tokens——修改链上状态的写操作。大多数借贷操作免费（1% 手续费在链上收取）。只有 create-agent ($0.10) 和 swap-tokens (0.05%) 需要 x402 支付。",
    authentication: "通过 x402 认证",
    authenticationDesc: "Agio 使用 x402 协议进行付费工具认证。代理发送签名的 USDC 交易作为支付头，而不是 API 密钥。交易费支付者地址证明钱包所有权——支付即认证。每个支付 nonce 只能使用一次（防重放），每个钱包每 60 秒限制 1 个请求。在 devnet 上，DEVNET_FREE_TOOLS=true 标志绕过支付要求。",
    exampleWorkflow: "示例工作流",
    exampleWorkflowDesc: "以下是 AI 代理如何通过 MCP 使用 Agio：",
    exStep1: "调用 list-loans 扫描具有有利 APY 的可用借贷报价",
    exStep2: "对感兴趣的报价调用 get-loan 检查抵押率和借款人历史",
    exStep3: "基于风险分析决定接受贷款",
    exStep4: "使用贷款公钥和钱包地址调用 accept-lend-offer",
    exStep5: "使用 get-loan 监控仓位，条件满足时调用 repay-loan",
    compatibility: "兼容客户端",
    compatibilityDesc: "任何兼容 MCP 的客户端都可以连接到 Agio：",
    compatClient1: "Claude Desktop——添加 Agio 作为远程 MCP 服务器或使用本地 stdio 包装器",
    compatClient2: "Claude Code——通过 MCP 服务器配置连接",
    compatClient3: "自定义代理——任何使用 MCP SDK 的代理都可以直接调用 Agio 工具",
    compatClient4: "其他 MCP 客户端——Cursor、Windsurf 或任何支持 Streamable HTTP 传输的客户端",
    learnMore: "了解更多",
    learnMoreDesc: "有关详细的工具模式、参数和响应格式，请参阅 MCP 集成文档。",
  },
}

export default function AgentsPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.overview}</h2>
      <p>{s.overviewDesc}</p>

      <h2>{s.connecting}</h2>
      <p>{s.connectingDesc}</p>
      <ol>
        <li>{s.connectingStep1}</li>
        <li>{s.connectingStep2}</li>
        <li>{s.connectingStep3}</li>
        <li>{s.connectingStep4}</li>
      </ol>

      <h2>{s.remoteConfig}</h2>
      <p>{s.remoteConfigDesc}</p>
      <div className="not-prose my-4 rounded-lg border border-border/60 bg-card p-4">
        <pre className="text-sm"><code>{`{
  "mcpServers": {
    "agio": {
      "url": "https://agio.network/api/mcp"
    }
  }
}`}</code></pre>
      </div>

      <h2>{s.localConfig}</h2>
      <p>{s.localConfigDesc}</p>
      <div className="not-prose my-4 rounded-lg border border-border/60 bg-card p-4">
        <pre className="text-sm"><code>{`{
  "mcpServers": {
    "agio": {
      "command": "npx",
      "args": ["ts-node", "scripts/mcp-stdio.ts"]
    }
  }
}`}</code></pre>
      </div>

      <h2>{s.availableTools}</h2>
      <p>{s.availableToolsDesc}</p>

      <h3>{s.freeTools}</h3>
      <p>{s.freeToolsDesc}</p>

      <h3>{s.paidTools}</h3>
      <p>{s.paidToolsDesc}</p>

      <h2>{s.authentication}</h2>
      <p>{s.authenticationDesc}</p>

      <h2>{s.exampleWorkflow}</h2>
      <p>{s.exampleWorkflowDesc}</p>
      <ol>
        <li>{s.exStep1}</li>
        <li>{s.exStep2}</li>
        <li>{s.exStep3}</li>
        <li>{s.exStep4}</li>
        <li>{s.exStep5}</li>
      </ol>

      <h2>{s.compatibility}</h2>
      <p>{s.compatibilityDesc}</p>
      <ul>
        <li>{s.compatClient1}</li>
        <li>{s.compatClient2}</li>
        <li>{s.compatClient3}</li>
        <li>{s.compatClient4}</li>
      </ul>

      <h2>{s.learnMore}</h2>
      <p>{s.learnMoreDesc}</p>
    </>
  )
}
