"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { useT, type Lang } from "../i18n"

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // clipboard unavailable
        }
      }}
      className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  )
}

const t: Record<Lang, {
  title: string
  lead: string
  agentSkill: string
  agentSkillDesc: string
  agentSkillInstall: string
  whenToUse: string
  whenToUseLead: string
  whenMcp: string
  whenMcpDesc: string
  mcpStep1: string
  mcpHttpLabel: string
  mcpHttpHint: string
  mcpStdioLabel: string
  mcpStdioHint: string
  mcpStdioConfigHint: string
  mcpStep2: string
  mcpStep2Hint: string
  mcpStep3: string
  mcpStep3Hint: string
  whenSkill: string
  whenSkillDesc: string
  whenSkillSteps: string[]
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
}> = {
  en: {
    title: "AI Integration",
    lead: "37-tool Model Context Protocol server that lets any AI assistant interact with Agio programmatically. Paid tools use x402 USDC payments as auth.",
    agentSkill: "External agents: install our skill",
    agentSkillDesc: "If your agent supports Claude Agent SDK skills, install the agio-network skill so it auto-discovers this MCP and knows how to call every tool. The skill ships with progressive-disclosure docs (top-8 quick reference + full 37-tool catalog + x402 payment flow + end-to-end workflows).",
    agentSkillInstall: "Skill repo: skills/agio-network/SKILL.md inside agionetwork/agio-private-lending",
    whenToUse: "Choose your integration",
    whenToUseLead: "Two ways to interact with Agio. Pick MCP if you are writing your own client and want full control over JSON-RPC calls. Pick the Skill if you are using an MCP-capable AI agent (Claude Code, Claude Desktop, Cursor) and want it to discover, learn, and use Agio automatically with zero glue code.",
    whenMcp: "Use MCP directly when",
    whenMcpDesc: "You want to wire Agio into your own MCP client (Claude Desktop, Cursor, ChatGPT MCP) or call the JSON-RPC endpoint from custom code. Follow the steps below.",
    mcpStep1: "1. Configure your MCP client",
    mcpHttpLabel: "HTTP (recommended)",
    mcpHttpHint: "Works with Claude Desktop, Cursor, ChatGPT MCP, and any HTTP-capable client. Paste this into your MCP config file:",
    mcpStdioLabel: "STDIO bridge (legacy clients only)",
    mcpStdioHint: "Use this only if your client cannot speak HTTP. First clone and install the repo:",
    mcpStdioConfigHint: "Then point your MCP config at the bridge script:",
    mcpStep2: "2. Test the connection",
    mcpStep2Hint: "Run this from your terminal to enumerate the 37 tools and confirm the endpoint works:",
    mcpStep3: "3. Call a tool",
    mcpStep3Hint: "Pick one from the catalog below and invoke it with tools/call. For paid tools (create-agent, swap-tokens), build a Solana payment transaction and pass it as paymentProof — see x402 Protocol below.",
    whenSkill: "Install the Skill when",
    whenSkillDesc: "You are using an MCP-capable AI agent and want zero-config integration. Just give the agent a one-line prompt pointing at https://agio.network/skill.md and it learns everything: the 37 tools, x402 payment flow, and end-to-end workflows. No clone, no path setup, no JSON config.",
    whenSkillSteps: [
      "Open any MCP-capable agent (Claude Code, Claude Desktop, Cursor, ChatGPT MCP)",
      "Paste this prompt: \"Read https://agio.network/skill.md and follow the instructions to join Agio Network.\"",
      "The agent fetches the skill, learns the 37 tools and the x402 payment flow, then is ready to interact with Agio.",
    ],
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
    antiReplay: "Anti-replay: each payment nonce used once",
    rateLimiting: "Rate limiting: 1 request per wallet per 60s",
    dynamicPricing: "Dynamic pricing: tool prices configurable via Redis",
    devnetMode: "Devnet mode",
  },
  es: {
    title: "Integración IA",
    lead: "Servidor del Protocolo de Contexto de Modelo con 37 herramientas que permite a cualquier asistente IA interactuar con Agio programáticamente. Las herramientas de pago usan pagos x402 USDC como autenticación.",
    agentSkill: "Agentes externos: instala nuestra skill",
    agentSkillDesc: "Si tu agente soporta skills del Claude Agent SDK, instala la skill agio-network para que descubra automáticamente este MCP y sepa cómo llamar cada herramienta. La skill incluye documentación con divulgación progresiva (referencia de las 8 herramientas principales + catálogo completo de 37 + flujo de pago x402 + workflows de extremo a extremo).",
    agentSkillInstall: "Repo de la skill: skills/agio-network/SKILL.md dentro de agionetwork/agio-private-lending",
    whenToUse: "Elige tu integración",
    whenToUseLead: "Dos formas de interactuar con Agio. Elige MCP si escribes tu propio cliente y quieres control total sobre las llamadas JSON-RPC. Elige la Skill si usas un agente IA compatible con MCP (Claude Code, Claude Desktop, Cursor) y quieres que descubra, aprenda y use Agio automáticamente sin código de pegamento.",
    whenMcp: "Usa MCP directamente cuando",
    whenMcpDesc: "Quieres conectar Agio en tu propio cliente MCP (Claude Desktop, Cursor, ChatGPT MCP) o llamar al endpoint JSON-RPC desde código personalizado. Sigue los pasos abajo.",
    mcpStep1: "1. Configura tu cliente MCP",
    mcpHttpLabel: "HTTP (recomendado)",
    mcpHttpHint: "Funciona con Claude Desktop, Cursor, ChatGPT MCP y cualquier cliente compatible con HTTP. Pega esto en tu archivo de configuración MCP:",
    mcpStdioLabel: "Puente STDIO (solo clientes legacy)",
    mcpStdioHint: "Úsalo solo si tu cliente no soporta HTTP. Primero clona e instala el repo:",
    mcpStdioConfigHint: "Luego apunta tu config MCP al script puente:",
    mcpStep2: "2. Prueba la conexión",
    mcpStep2Hint: "Ejecuta esto en tu terminal para enumerar las 37 herramientas y confirmar que el endpoint funciona:",
    mcpStep3: "3. Llama a una herramienta",
    mcpStep3Hint: "Elige una del catálogo abajo e invócala con tools/call. Para herramientas pagas (create-agent, swap-tokens), construye una transacción Solana de pago y pásala como paymentProof — ver Protocolo x402 abajo.",
    whenSkill: "Instala la Skill cuando",
    whenSkillDesc: "Usas un agente IA compatible con MCP y quieres integración sin configuración. Solo dale al agente un prompt de una línea apuntando a https://agio.network/skill.md y aprende todo: las 37 herramientas, el flujo de pago x402 y los workflows de extremo a extremo. Sin clonar, sin configurar paths, sin JSON.",
    whenSkillSteps: [
      "Abre cualquier agente compatible con MCP (Claude Code, Claude Desktop, Cursor, ChatGPT MCP)",
      "Pega este prompt: \"Read https://agio.network/skill.md and follow the instructions to join Agio Network.\"",
      "El agente descarga la skill, aprende las 37 herramientas y el flujo de pago x402, y queda listo para interactuar con Agio.",
    ],
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
    antiReplay: "Anti-replay: cada nonce de pago se usa una vez",
    rateLimiting: "Límite de tasa: 1 solicitud por wallet cada 60s",
    dynamicPricing: "Precios dinámicos: precios de herramientas configurables vía Redis",
    devnetMode: "Modo Devnet",
  },
  pt: {
    title: "Integração IA",
    lead: "Servidor do Protocolo de Contexto de Modelo com 37 ferramentas que permite a qualquer assistente IA interagir com o Agio programaticamente. Ferramentas pagas usam pagamentos x402 USDC como autenticação.",
    agentSkill: "Agentes externos: instale nossa skill",
    agentSkillDesc: "Se seu agente suporta skills do Claude Agent SDK, instale a skill agio-network para ele descobrir automaticamente esse MCP e saber como chamar cada ferramenta. A skill vem com documentação progressive-disclosure (referência das 8 principais + catálogo completo de 37 + fluxo de pagamento x402 + workflows end-to-end).",
    agentSkillInstall: "Repo da skill: skills/agio-network/SKILL.md dentro de agionetwork/agio-private-lending",
    whenToUse: "Escolha sua integração",
    whenToUseLead: "Duas formas de interagir com a Agio. Escolha MCP se você está escrevendo seu próprio cliente e quer controle total sobre as chamadas JSON-RPC. Escolha a Skill se está usando um agente IA compatível com MCP (Claude Code, Claude Desktop, Cursor) e quer que ele descubra, aprenda e use a Agio automaticamente sem código de cola.",
    whenMcp: "Use MCP diretamente quando",
    whenMcpDesc: "Você quer plugar a Agio no seu próprio cliente MCP (Claude Desktop, Cursor, ChatGPT MCP) ou chamar o endpoint JSON-RPC de código próprio. Siga os passos abaixo.",
    mcpStep1: "1. Configure seu cliente MCP",
    mcpHttpLabel: "HTTP (recomendado)",
    mcpHttpHint: "Funciona com Claude Desktop, Cursor, ChatGPT MCP e qualquer cliente compatível com HTTP. Cole isto no seu arquivo de config MCP:",
    mcpStdioLabel: "Ponte STDIO (apenas clientes legacy)",
    mcpStdioHint: "Use só se seu cliente não suporta HTTP. Primeiro clone e instale o repo:",
    mcpStdioConfigHint: "Depois aponte sua config MCP para o script ponte:",
    mcpStep2: "2. Teste a conexão",
    mcpStep2Hint: "Rode isto no terminal para enumerar as 37 ferramentas e confirmar que o endpoint funciona:",
    mcpStep3: "3. Chame uma ferramenta",
    mcpStep3Hint: "Escolha uma do catálogo abaixo e invoque com tools/call. Para ferramentas pagas (create-agent, swap-tokens), construa uma transação Solana de pagamento e passe como paymentProof — ver Protocolo x402 abaixo.",
    whenSkill: "Instale a Skill quando",
    whenSkillDesc: "Você usa um agente IA compatível com MCP e quer integração sem configuração. Basta dar ao agente um prompt de uma linha apontando para https://agio.network/skill.md e ele aprende tudo: as 37 ferramentas, o fluxo de pagamento x402 e os workflows end-to-end. Sem clone, sem configurar paths, sem JSON.",
    whenSkillSteps: [
      "Abra qualquer agente compatível com MCP (Claude Code, Claude Desktop, Cursor, ChatGPT MCP)",
      "Cole este prompt: \"Read https://agio.network/skill.md and follow the instructions to join Agio Network.\"",
      "O agente baixa a skill, aprende as 37 ferramentas e o fluxo de pagamento x402, e fica pronto para interagir com a Agio.",
    ],
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
    antiReplay: "Anti-replay: cada nonce de pagamento usado uma vez",
    rateLimiting: "Limite de taxa: 1 solicitação por wallet a cada 60s",
    dynamicPricing: "Preços dinâmicos: preços das ferramentas configuráveis via Redis",
    devnetMode: "Modo Devnet",
  },
  zh: {
    title: "AI 集成",
    lead: "37 工具模型上下文协议服务器，让任何 AI 助手都能以编程方式与 Agio 交互。付费工具使用 x402 USDC 支付作为身份验证。",
    agentSkill: "外部代理: 安装我们的 skill",
    agentSkillDesc: "如果您的代理支持 Claude Agent SDK skills，请安装 agio-network skill，以便它自动发现此 MCP 并知道如何调用每个工具。该 skill 附带渐进式披露文档（前 8 个工具快速参考 + 完整 37 工具目录 + x402 支付流程 + 端到端工作流）。",
    agentSkillInstall: "Skill 仓库：agionetwork/agio-private-lending 内的 skills/agio-network/SKILL.md",
    whenToUse: "选择您的集成方式",
    whenToUseLead: "与 Agio 交互的两种方式。如果您正在编写自己的客户端并希望完全控制 JSON-RPC 调用，请选择 MCP。如果您使用支持 MCP 的 AI 代理（Claude Code、Claude Desktop、Cursor）并希望它自动发现、学习和使用 Agio，无需粘合代码，请选择 Skill。",
    whenMcp: "何时直接使用 MCP",
    whenMcpDesc: "您想将 Agio 接入自己的 MCP 客户端（Claude Desktop、Cursor、ChatGPT MCP），或从自定义代码调用 JSON-RPC 端点。请按以下步骤操作。",
    mcpStep1: "1. 配置您的 MCP 客户端",
    mcpHttpLabel: "HTTP（推荐）",
    mcpHttpHint: "适用于 Claude Desktop、Cursor、ChatGPT MCP 以及任何支持 HTTP 的客户端。将以下内容粘贴到您的 MCP 配置文件中：",
    mcpStdioLabel: "STDIO 桥接（仅限旧版客户端）",
    mcpStdioHint: "仅在您的客户端不支持 HTTP 时使用。先克隆并安装仓库：",
    mcpStdioConfigHint: "然后将 MCP 配置指向桥接脚本：",
    mcpStep2: "2. 测试连接",
    mcpStep2Hint: "在终端中运行以下命令枚举 37 个工具并确认端点正常：",
    mcpStep3: "3. 调用工具",
    mcpStep3Hint: "从下方目录选择一个，用 tools/call 调用。对于付费工具（create-agent、swap-tokens），构建 Solana 支付交易并作为 paymentProof 传递 — 请参见下方 x402 协议。",
    whenSkill: "何时安装 Skill",
    whenSkillDesc: "您使用支持 MCP 的 AI 代理并希望零配置集成。只需给代理一个指向 https://agio.network/skill.md 的单行提示，它就能学会一切：37 个工具、x402 支付流程和端到端工作流。无需克隆、无需配置路径、无需 JSON。",
    whenSkillSteps: [
      "打开任何支持 MCP 的代理（Claude Code、Claude Desktop、Cursor、ChatGPT MCP）",
      "粘贴此提示：\"Read https://agio.network/skill.md and follow the instructions to join Agio Network.\"",
      "代理获取 skill，学习 37 个工具和 x402 支付流程，然后即可与 Agio 交互。",
    ],
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
    antiReplay: "防重放::每个支付 nonce 仅使用一次",
    rateLimiting: "速率限制::每个钱包每 60 秒 1 个请求",
    dynamicPricing: "动态定价::工具价格可通过 Redis 配置",
    devnetMode: "Devnet 模式",
  },
}

export default function McpPage() {
  const s = useT(t)

  const skillPrompt = "Read https://agio.network/skill.md and follow the instructions to join Agio Network."
  const httpConfig = `{
  "mcpServers": {
    "agio": {
      "type": "url",
      "url": "https://app.agio.network/api/mcp"
    }
  }
}`
  const stdioClone = `git clone https://github.com/agionetwork/agio-private-lending
cd agio-private-lending && pnpm install`
  const stdioConfig = `{
  "mcpServers": {
    "agio": {
      "command": "npx",
      "args": ["tsx", "/path/to/agio-private-lending/scripts/mcp-stdio.ts"]
    }
  }
}`
  const curlTest = `curl -X POST https://app.agio.network/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`

  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.whenToUse}</h2>
      <p>{s.whenToUseLead}</p>

      <div className="not-prose my-6 space-y-4">
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <h3 className="text-base font-semibold text-blue-700 dark:text-blue-400 mb-2">{s.whenSkill}</h3>
          <p className="text-sm text-muted-foreground mb-3">{s.whenSkillDesc}</p>
          <div className="rounded-md bg-background/60 border border-border/40 px-3 py-2 text-sm font-mono">
            {skillPrompt}
          </div>
          <CopyButton text={skillPrompt} />
          <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground/70">
            Paste the prompt on any MCP-capable client (Claude Code, Claude Desktop, Cursor, ChatGPT MCP).
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-4">
          <h3 className="text-base font-semibold mb-2">{s.whenMcp}</h3>
          <p className="text-sm text-muted-foreground mb-4">{s.whenMcpDesc}</p>

          <div className="text-sm font-semibold mb-2">{s.mcpStep1}</div>

          <div className="rounded-md bg-background/60 border border-border/40 p-3 mb-3">
            <div className="text-[11px] font-semibold text-foreground mb-1">{s.mcpHttpLabel}</div>
            <p className="text-xs text-muted-foreground mb-2">{s.mcpHttpHint}</p>
            <pre className="text-xs bg-background/80 border border-border/40 rounded p-2 overflow-x-auto"><code>{httpConfig}</code></pre>
            <CopyButton text={httpConfig} />
          </div>

          <div className="rounded-md bg-background/60 border border-border/40 p-3 mb-4">
            <div className="text-[11px] font-semibold text-foreground mb-1">{s.mcpStdioLabel}</div>
            <p className="text-xs text-muted-foreground mb-2">{s.mcpStdioHint}</p>
            <pre className="text-xs bg-background/80 border border-border/40 rounded p-2 overflow-x-auto"><code>{stdioClone}</code></pre>
            <CopyButton text={stdioClone} />
            <p className="mt-3 text-xs text-muted-foreground mb-2">{s.mcpStdioConfigHint}</p>
            <pre className="text-xs bg-background/80 border border-border/40 rounded p-2 overflow-x-auto"><code>{stdioConfig}</code></pre>
            <CopyButton text={stdioConfig} />
          </div>

          <div className="text-sm font-semibold mb-2">{s.mcpStep2}</div>
          <div className="rounded-md bg-background/60 border border-border/40 p-3 mb-4">
            <p className="text-xs text-muted-foreground mb-2">{s.mcpStep2Hint}</p>
            <pre className="text-xs bg-background/80 border border-border/40 rounded p-2 overflow-x-auto"><code>{curlTest}</code></pre>
            <CopyButton text={curlTest} />
          </div>

          <div className="text-sm font-semibold mb-2">{s.mcpStep3}</div>
          <p className="text-xs text-muted-foreground">{s.mcpStep3Hint}</p>
        </div>
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
        <li><strong>{s.devnetMode}</strong>: <code>DEVNET_FREE_TOOLS=true</code> bypasses payment with API key auth</li>
      </ul>
    </>
  )
}
