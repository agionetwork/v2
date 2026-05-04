"use client"

import { useT } from "./i18n"
import type { Lang } from "./i18n"

const t: Record<Lang, {
  title: string; lead: string;
  cards: { title: string; desc: string }[];
  solves: string; solvesText: string; solvesList: string[];
  arch: string; archRows: [string, string][];
  tokens: string; tokensDesc: string;
  program: string; programText: string;
}> = {
  en: {
    title: "Agio Network",
    lead: "Peer-to-peer lending on Solana with AI agents and MCP integration.",
    cards: [
      { title: "P2P Lending", desc: "Direct lender-to-borrower loans. No pools, no intermediaries. Custom terms, rates, and collateral." },
      { title: "Autonomous Agents", desc: "AI agents execute lending strategies 24/7 via Privy-managed wallets with configurable rules." },
      { title: "On-Chain Reputation", desc: "Volume-weighted points system with anti-wash-trading. Repaid loans earn more than foreclosed." },
      { title: "MCP + x402", desc: "37-tool MCP server lets any AI assistant interact with the protocol. Paid tools use x402 USDC." },
    ],
    solves: "What Agio Solves",
    solvesText: "DeFi lending today is dominated by pooled liquidity protocols. Pools create systemic risk (one bad asset drains the pool), abstract away counterparty relationships, and offer zero customization of loan terms. Agio replaces pools with direct P2P agreements:",
    solvesList: [
      "Every loan is a 1-to-1 contract between lender and borrower",
      "Each party sets their own APY, duration, collateral ratio, and token",
      "Collateral is escrowed on-chain in a program vault, priced by Pyth oracles",
      "No shared risk — one default never cascades to other users",
    ],
    arch: "Architecture at a Glance",
    archRows: [
      ["Smart Contract", "Anchor (Rust) on Solana devnet"],
      ["Frontend", "Next.js 16 (Turbopack) + wallet-adapter"],
      ["Agent System", "Privy keypairs + Upstash Redis + cron execution"],
      ["Oracles", "Pyth Network (Hermes API + on-chain verification)"],
      ["Social Graph", "Tapestry (profiles, friends, activity feed)"],
      ["AI Interface", "MCP server (37 tools) + x402 USDC payments"],
      ["Notifications", "Dialect (email, in-app, Telegram)"],
    ],
    tokens: "Supported Tokens",
    tokensDesc: "Agio supports any SPL token (including Token-2022) on the Solana network. Devnet today runs USDC, EURC, and SOL (auto-wrapped to wSOL). On mainnet, the same architecture opens the door for community-minted assets like xStocks, $GOLD, or $agioSOL: any token can serve as debt or collateral once it has a Pyth price feed.",
    program: "Program",
    programText: "Program ID: AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX (devnet). Built with Anchor. Key PDAs: Loan (per-offer state), VaultAuthority (collateral escrow + treasury), PriceFeedConfig (Pyth oracle cache per mint).",
  },
  es: {
    title: "Agio Network",
    lead: "Préstamos peer-to-peer en Solana con agentes IA e integración MCP.",
    cards: [
      { title: "Préstamos P2P", desc: "Préstamos directos entre prestamista y prestatario. Sin pools, sin intermediarios. Términos personalizados." },
      { title: "Agentes Autónomos", desc: "Agentes IA ejecutan estrategias de préstamo 24/7 con billeteras Privy y reglas configurables." },
      { title: "Reputación On-Chain", desc: "Sistema de puntos ponderado por volumen con anti-wash-trading. Préstamos pagados ganan más." },
      { title: "MCP + x402", desc: "Servidor MCP con 37 herramientas para que cualquier IA interactúe con el protocolo. Pagos en USDC." },
    ],
    solves: "Qué Resuelve Agio",
    solvesText: "Los préstamos DeFi están dominados por protocolos de liquidez agrupada. Los pools crean riesgo sistémico, eliminan la relación entre partes y no permiten personalizar términos. Agio reemplaza pools con acuerdos P2P directos:",
    solvesList: [
      "Cada préstamo es un contrato 1-a-1 entre prestamista y prestatario",
      "Cada parte define su propio APY, duración, ratio de colateral y token",
      "El colateral está custodiado on-chain en un vault del programa, valorado por oráculos Pyth",
      "Sin riesgo compartido — un impago nunca afecta a otros usuarios",
    ],
    arch: "Arquitectura",
    archRows: [
      ["Contrato Inteligente", "Anchor (Rust) en Solana devnet"],
      ["Frontend", "Next.js 16 (Turbopack) + wallet-adapter"],
      ["Sistema de Agentes", "Keypairs Privy + Upstash Redis + ejecución cron"],
      ["Oráculos", "Pyth Network (API Hermes + verificación on-chain)"],
      ["Grafo Social", "Tapestry (perfiles, amigos, feed de actividad)"],
      ["Interfaz IA", "Servidor MCP (37 herramientas) + pagos x402 USDC"],
      ["Notificaciones", "Dialect (email, in-app, Telegram)"],
    ],
    tokens: "Tokens Soportados",
    tokensDesc: "Agio soporta cualquier token SPL (incluyendo Token-2022) en la red Solana. Devnet hoy corre USDC, EURC y SOL (envuelto automáticamente a wSOL). En mainnet, la misma arquitectura abre la puerta a activos minteados por la comunidad como xStocks, $GOLD o $agioSOL: cualquier token puede servir como deuda o colateral una vez que tenga un price feed de Pyth.",
    program: "Programa",
    programText: "Program ID: AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX (devnet). Construido con Anchor. PDAs principales: Loan (estado por oferta), VaultAuthority (custodia de colateral + tesorería), PriceFeedConfig (caché de oráculos Pyth por mint).",
  },
  pt: {
    title: "Agio Network",
    lead: "Empréstimos peer-to-peer na Solana com agentes IA e integração MCP.",
    cards: [
      { title: "Empréstimos P2P", desc: "Empréstimos diretos entre credor e devedor. Sem pools, sem intermediários. Termos personalizados." },
      { title: "Agentes Autônomos", desc: "Agentes IA executam estratégias de empréstimo 24/7 com carteiras Privy e regras configuráveis." },
      { title: "Reputação On-Chain", desc: "Sistema de pontos ponderado por volume com anti-wash-trading. Empréstimos pagos rendem mais." },
      { title: "MCP + x402", desc: "Servidor MCP com 37 ferramentas para qualquer IA interagir com o protocolo. Pagamentos em USDC." },
    ],
    solves: "O Que Agio Resolve",
    solvesText: "Empréstimos DeFi hoje são dominados por protocolos de liquidez agrupada. Pools criam risco sistêmico, abstraem a relação entre partes e não permitem personalizar termos. Agio substitui pools por acordos P2P diretos:",
    solvesList: [
      "Cada empréstimo é um contrato 1-para-1 entre credor e devedor",
      "Cada parte define seu próprio APY, duração, ratio de colateral e token",
      "O colateral é custodiado on-chain em um vault do programa, precificado por oráculos Pyth",
      "Sem risco compartilhado — um calote nunca afeta outros usuários",
    ],
    arch: "Arquitetura",
    archRows: [
      ["Contrato Inteligente", "Anchor (Rust) na Solana devnet"],
      ["Frontend", "Next.js 16 (Turbopack) + wallet-adapter"],
      ["Sistema de Agentes", "Keypairs Privy + Upstash Redis + execução cron"],
      ["Oráculos", "Pyth Network (API Hermes + verificação on-chain)"],
      ["Grafo Social", "Tapestry (perfis, amigos, feed de atividade)"],
      ["Interface IA", "Servidor MCP (37 ferramentas) + pagamentos x402 USDC"],
      ["Notificações", "Dialect (email, in-app, Telegram)"],
    ],
    tokens: "Tokens Suportados",
    tokensDesc: "A Agio aceita qualquer token SPL (incluindo Token-2022) na rede Solana. A devnet hoje roda USDC, EURC e SOL (convertido automaticamente para wSOL). Na mainnet, a mesma arquitetura abre a porta para ativos cunhados pela comunidade como xStocks, $GOLD ou $agioSOL: qualquer token pode servir como dívida ou colateral assim que tiver um price feed do Pyth.",
    program: "Programa",
    programText: "Program ID: AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX (devnet). Construído com Anchor. PDAs principais: Loan (estado por oferta), VaultAuthority (custódia de colateral + tesouraria), PriceFeedConfig (cache de oráculos Pyth por mint).",
  },
  zh: {
    title: "Agio Network",
    lead: "基于 Solana 的点对点借贷协议，集成 AI 代理和 MCP。",
    cards: [
      { title: "P2P 借贷", desc: "出借人与借款人直接交易。无资金池、无中介。自定义条款、利率和抵押品。" },
      { title: "自主代理", desc: "AI 代理通过 Privy 管理的钱包 7×24 执行借贷策略，规则可配置。" },
      { title: "链上信誉", desc: "基于交易量加权的积分系统，防刷交易。还款贷款获得更多积分。" },
      { title: "MCP + x402", desc: "37 个工具的 MCP 服务器，让任何 AI 助手与协议交互。付费工具使用 x402 USDC。" },
    ],
    solves: "Agio 解决了什么",
    solvesText: "当前 DeFi 借贷由池化流动性协议主导。资金池产生系统性风险（一个坏资产拖垮整个池子），隐藏了交易对手关系，且无法自定义贷款条款。Agio 用直接的 P2P 协议取代资金池：",
    solvesList: [
      "每笔贷款都是出借人与借款人之间的 1 对 1 合约",
      "各方自定义 APY、期限、抵押率和代币",
      "抵押品由链上程序金库托管，由 Pyth 预言机定价",
      "无共享风险——一笔违约不会波及其他用户",
    ],
    arch: "架构概览",
    archRows: [
      ["智能合约", "Anchor (Rust)，部署在 Solana devnet"],
      ["前端", "Next.js 16 (Turbopack) + wallet-adapter"],
      ["代理系统", "Privy 密钥对 + Upstash Redis + 定时执行"],
      ["预言机", "Pyth Network (Hermes API + 链上验证)"],
      ["社交图谱", "Tapestry（个人资料、好友、动态流）"],
      ["AI 接口", "MCP 服务器（37 个工具）+ x402 USDC 支付"],
      ["通知", "Dialect（邮件、应用内、Telegram）"],
    ],
    tokens: "支持的代币",
    tokensDesc: "Agio 支持 Solana 网络上的任何 SPL 代币（包括 Token-2022）。devnet 目前运行 USDC、EURC 和 SOL（自动包装为 wSOL）。在主网上，同样的架构为社区铸造的资产打开了大门，如 xStocks、$GOLD 或 $agioSOL：任何代币只要拥有 Pyth 价格源，都可以作为债务或抵押品。",
    program: "程序",
    programText: "Program ID: AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX (devnet)。使用 Anchor 构建。关键 PDA：Loan（每笔报价状态）、VaultAuthority（抵押品托管 + 国库）、PriceFeedConfig（每个 mint 的 Pyth 预言机缓存）。",
  },
}

export default function IntroductionPage() {
  const c = useT(t)
  return (
    <>
      <h1>{c.title}</h1>
      <p className="lead text-lg text-muted-foreground">{c.lead}</p>

      <div className="not-prose my-8 grid gap-4 sm:grid-cols-2">
        {c.cards.map((card) => (
          <div key={card.title} className="rounded-lg border border-border/60 bg-card p-5 transition-shadow hover:shadow-md">
            <h3 className="mb-1 text-sm font-semibold">{card.title}</h3>
            <p className="text-sm text-muted-foreground">{card.desc}</p>
          </div>
        ))}
      </div>

      <h2>{c.solves}</h2>
      <p>{c.solvesText}</p>
      <ul>{c.solvesList.map((item) => <li key={item}>{item}</li>)}</ul>

      <h2>{c.arch}</h2>
      <div className="not-prose my-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left"><th className="pb-2 font-medium">Layer</th><th className="pb-2 font-medium">Stack</th></tr></thead>
          <tbody className="text-muted-foreground">
            {c.archRows.map(([layer, stack]) => (
              <tr key={layer} className="border-b border-border/40"><td className="py-2 font-medium text-foreground">{layer}</td><td>{stack}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{c.tokens}</h2>
      <p>{c.tokensDesc}</p>

      <h2>{c.program}</h2>
      <p>{c.programText}</p>
    </>
  )
}
