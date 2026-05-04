"use client"

import Link from "next/link"
import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  whenToUse: string
  whenToUseDesc: string
  endpoints: string
  endpointsLead: string
  loansTitle: string
  loansDesc: string
  agentStatusTitle: string
  agentStatusDesc: string
  agentOwnersTitle: string
  agentOwnersDesc: string
  pricesTitle: string
  pricesDesc: string
  notes: string
  notesList: string[]
  preferMcp: string
  preferMcpDesc: string
  preferMcpLink: string
}> = {
  en: {
    title: "Public API",
    lead: "REST endpoints exposed alongside the MCP server. Useful for read-only integrations, dashboards, and tooling that does not need the full MCP stack.",
    whenToUse: "When to use this",
    whenToUseDesc: "If you are writing an AI agent, prefer MCP (37 tools, x402 auth, batched ops). The REST endpoints below are best for one-shot read queries from dashboards, indexers, scrapers, or scripts where you do not want a full MCP client.",
    endpoints: "Endpoints",
    endpointsLead: "All endpoints return JSON. CORS is open. No auth required for read-only routes.",
    loansTitle: "GET /api/loans",
    loansDesc: "Returns every loan account on the program (Pending, Accepted, Repaid, Foreclosed). Includes parsed terms, parties, and current state. Heavy response on a populated mainnet — paginate client-side or filter in your indexer.",
    agentStatusTitle: "GET /api/agent/status?wallet={pubkey}",
    agentStatusDesc: "Returns the Auto Loan agent state for a given owner wallet: agent pubkey, balances, configured strategy, and active flag. Returns 404 if the wallet has no agent.",
    agentOwnersTitle: "POST /api/agent-owners",
    agentOwnersDesc: "Batch resolve a list of agent pubkeys to their owner wallets. Body: { wallets: string[] }. Returns { mapping: Record<agentPubkey, ownerPubkey | null> }. Useful for joining loan rows back to human-readable owner identities.",
    pricesTitle: "GET /api/prices/data?debtToken={USDC|EURC}&collateralToken={SOL|USDC|EURC}",
    pricesDesc: "Lightweight proxy that fetches binary Pyth Hermes update data for the requested pair. Returns base64-encoded payload ready to feed into post_update_atomic for client-side instruction building. No on-chain transaction is sent.",
    notes: "Notes",
    notesList: [
      "Rate-limited at 60 requests/minute per IP. Every response carries X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers. When exceeded, expect a 429 with Retry-After.",
      "Endpoints are read-only. State-changing operations (create, accept, repay, swap) live behind the MCP server with x402 payment.",
      "Schemas are intentionally undocumented in detail here. The response is whatever the underlying parser returns. Use the TypeScript types in lib/loan-utils.ts as the source of truth.",
      "Breaking changes are possible during devnet. Pin a commit hash if your tooling depends on a specific shape.",
    ],
    preferMcp: "For agents and write operations",
    preferMcpDesc: "If you need to create offers, accept, repay, swap, or run an autonomous agent, use the full MCP server with the 37-tool catalog. See ",
    preferMcpLink: "AI Integration",
  },
  es: {
    title: "API Pública",
    lead: "Endpoints REST expuestos junto al servidor MCP. Útiles para integraciones de solo lectura, dashboards y herramientas que no necesitan todo el stack MCP.",
    whenToUse: "Cuándo usar esto",
    whenToUseDesc: "Si estás escribiendo un agente IA, prefiere MCP (37 herramientas, autenticación x402, operaciones en lote). Los endpoints REST de abajo son ideales para consultas de lectura puntuales desde dashboards, indexadores, scrapers o scripts donde no quieres un cliente MCP completo.",
    endpoints: "Endpoints",
    endpointsLead: "Todos los endpoints devuelven JSON. CORS está abierto. Sin autenticación requerida para rutas de solo lectura.",
    loansTitle: "GET /api/loans",
    loansDesc: "Devuelve cada cuenta de préstamo en el programa (Pendiente, Aceptado, Pagado, Ejecutado). Incluye términos parseados, partes y estado actual. Respuesta pesada en un mainnet poblado — pagina del lado cliente o filtra en tu indexador.",
    agentStatusTitle: "GET /api/agent/status?wallet={pubkey}",
    agentStatusDesc: "Devuelve el estado del agente Auto Loan para una wallet propietaria dada: pubkey del agente, balances, estrategia configurada y bandera activa. Devuelve 404 si la wallet no tiene agente.",
    agentOwnersTitle: "POST /api/agent-owners",
    agentOwnersDesc: "Resolución en lote de una lista de pubkeys de agentes a sus wallets propietarias. Body: { wallets: string[] }. Devuelve { mapping: Record<agentPubkey, ownerPubkey | null> }. Útil para unir filas de préstamos de vuelta a identidades de propietario legibles.",
    pricesTitle: "GET /api/prices/data?debtToken={USDC|EURC}&collateralToken={SOL|USDC|EURC}",
    pricesDesc: "Proxy ligero que obtiene datos binarios de actualización de Pyth Hermes para el par solicitado. Devuelve payload codificado en base64 listo para alimentar a post_update_atomic para construcción de instrucciones del lado cliente. No se envía transacción on-chain.",
    notes: "Notas",
    notesList: [
      "Rate-limited a 60 solicitudes/minuto por IP. Cada respuesta incluye headers X-RateLimit-Limit, X-RateLimit-Remaining y X-RateLimit-Reset. Cuando se excede, espera un 429 con Retry-After.",
      "Los endpoints son de solo lectura. Las operaciones que cambian estado (crear, aceptar, pagar, intercambiar) viven detrás del servidor MCP con pago x402.",
      "Los schemas están intencionalmente sin documentar en detalle aquí. La respuesta es lo que el parser subyacente devuelve. Usa los tipos TypeScript en lib/loan-utils.ts como fuente de verdad.",
      "Cambios incompatibles son posibles durante devnet. Fija un commit hash si tu herramienta depende de una forma específica.",
    ],
    preferMcp: "Para agentes y operaciones de escritura",
    preferMcpDesc: "Si necesitas crear ofertas, aceptar, pagar, intercambiar o ejecutar un agente autónomo, usa el servidor MCP completo con el catálogo de 37 herramientas. Ver ",
    preferMcpLink: "Integración IA",
  },
  pt: {
    title: "API Pública",
    lead: "Endpoints REST expostos ao lado do servidor MCP. Úteis para integrações somente leitura, dashboards e ferramentas que não precisam de todo o stack MCP.",
    whenToUse: "Quando usar isso",
    whenToUseDesc: "Se você está escrevendo um agente IA, prefira MCP (37 ferramentas, autenticação x402, operações em lote). Os endpoints REST abaixo são ideais para consultas de leitura pontuais a partir de dashboards, indexadores, scrapers ou scripts onde você não quer um cliente MCP completo.",
    endpoints: "Endpoints",
    endpointsLead: "Todos os endpoints retornam JSON. CORS está aberto. Sem autenticação necessária para rotas somente leitura.",
    loansTitle: "GET /api/loans",
    loansDesc: "Retorna todas as contas de empréstimo no programa (Pendente, Aceito, Pago, Executado). Inclui termos parseados, partes e estado atual. Resposta pesada num mainnet populado — pagine do lado cliente ou filtre no seu indexador.",
    agentStatusTitle: "GET /api/agent/status?wallet={pubkey}",
    agentStatusDesc: "Retorna o estado do agente Auto Loan para uma wallet proprietária dada: pubkey do agente, saldos, estratégia configurada e flag ativo. Retorna 404 se a wallet não tem agente.",
    agentOwnersTitle: "POST /api/agent-owners",
    agentOwnersDesc: "Resolução em lote de uma lista de pubkeys de agentes para suas wallets proprietárias. Body: { wallets: string[] }. Retorna { mapping: Record<agentPubkey, ownerPubkey | null> }. Útil pra juntar linhas de empréstimo de volta a identidades de proprietário legíveis.",
    pricesTitle: "GET /api/prices/data?debtToken={USDC|EURC}&collateralToken={SOL|USDC|EURC}",
    pricesDesc: "Proxy leve que busca dados binários de update do Pyth Hermes para o par requisitado. Retorna payload codificado em base64 pronto para alimentar post_update_atomic na construção de instruções do lado cliente. Nenhuma transação on-chain é enviada.",
    notes: "Notas",
    notesList: [
      "Rate-limited em 60 requests/minuto por IP. Toda resposta carrega headers X-RateLimit-Limit, X-RateLimit-Remaining e X-RateLimit-Reset. Quando excedido, espere um 429 com Retry-After.",
      "Endpoints são somente leitura. Operações que mudam estado (criar, aceitar, pagar, swap) vivem atrás do servidor MCP com pagamento x402.",
      "Schemas são intencionalmente não documentados em detalhe aqui. A resposta é o que o parser subjacente retorna. Use os tipos TypeScript em lib/loan-utils.ts como fonte da verdade.",
      "Mudanças incompatíveis são possíveis durante a devnet. Pin um commit hash se sua ferramenta depende de um formato específico.",
    ],
    preferMcp: "Para agentes e operações de escrita",
    preferMcpDesc: "Se você precisa criar ofertas, aceitar, pagar, fazer swap ou rodar um agente autônomo, use o servidor MCP completo com o catálogo de 37 ferramentas. Veja ",
    preferMcpLink: "Integração IA",
  },
  zh: {
    title: "公开 API",
    lead: "与 MCP 服务器一起公开的 REST 端点。适用于只读集成、仪表板以及不需要完整 MCP 堆栈的工具。",
    whenToUse: "何时使用",
    whenToUseDesc: "如果您正在编写 AI 代理，请优先使用 MCP（37 个工具、x402 身份验证、批量操作）。下面的 REST 端点最适合用于来自仪表板、索引器、爬虫或脚本的一次性读取查询，您不希望使用完整的 MCP 客户端。",
    endpoints: "端点",
    endpointsLead: "所有端点都返回 JSON。CORS 是开放的。只读路由无需身份验证。",
    loansTitle: "GET /api/loans",
    loansDesc: "返回程序上的每个贷款账户（待处理、已接受、已偿还、已清算）。包括已解析的条款、各方和当前状态。在已填充的主网上响应较大 — 在客户端分页或在您的索引器中过滤。",
    agentStatusTitle: "GET /api/agent/status?wallet={pubkey}",
    agentStatusDesc: "返回给定所有者钱包的 Auto Loan 代理状态：代理 pubkey、余额、配置的策略和活动标志。如果钱包没有代理，则返回 404。",
    agentOwnersTitle: "POST /api/agent-owners",
    agentOwnersDesc: "批量将代理 pubkey 列表解析为其所有者钱包。Body：{ wallets: string[] }。返回 { mapping: Record<agentPubkey, ownerPubkey | null> }。用于将贷款行连接回可读的所有者身份。",
    pricesTitle: "GET /api/prices/data?debtToken={USDC|EURC}&collateralToken={SOL|USDC|EURC}",
    pricesDesc: "轻量级代理，为请求的对获取 Pyth Hermes 二进制更新数据。返回 base64 编码的有效载荷，准备好提供给 post_update_atomic 用于客户端指令构建。不发送链上交易。",
    notes: "注意",
    notesList: [
      "按 IP 限制为每分钟 60 个请求。每个响应都带有 X-RateLimit-Limit、X-RateLimit-Remaining 和 X-RateLimit-Reset 标头。超过限制时，预期返回带 Retry-After 的 429。",
      "端点是只读的。状态变更操作（创建、接受、偿还、swap）位于带 x402 支付的 MCP 服务器后面。",
      "此处故意不详细记录 schemas。响应是底层解析器返回的内容。使用 lib/loan-utils.ts 中的 TypeScript 类型作为真相来源。",
      "在 devnet 期间可能发生破坏性变更。如果您的工具依赖特定形状，请固定 commit hash。",
    ],
    preferMcp: "对于代理和写操作",
    preferMcpDesc: "如果您需要创建报价、接受、偿还、swap 或运行自主代理，请使用具有 37 工具目录的完整 MCP 服务器。参见 ",
    preferMcpLink: "AI 集成",
  },
}

export default function ApiPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.whenToUse}</h2>
      <p>{s.whenToUseDesc}</p>

      <h2>{s.endpoints}</h2>
      <p>{s.endpointsLead}</p>

      <h3><code>{s.loansTitle}</code></h3>
      <p>{s.loansDesc}</p>

      <h3><code>{s.agentStatusTitle}</code></h3>
      <p>{s.agentStatusDesc}</p>

      <h3><code>{s.agentOwnersTitle}</code></h3>
      <p>{s.agentOwnersDesc}</p>

      <h3><code>{s.pricesTitle}</code></h3>
      <p>{s.pricesDesc}</p>

      <h2>{s.notes}</h2>
      <ul>
        {s.notesList.map((item, i) => <li key={i}>{item}</li>)}
      </ul>

      <h2>{s.preferMcp}</h2>
      <p>
        {s.preferMcpDesc}
        <Link href="/docs/mcp">{s.preferMcpLink}</Link>.
      </p>
    </>
  )
}
