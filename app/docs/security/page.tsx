"use client"

import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  collateralEnforcement: string
  thStage: string
  thMinRatio: string
  thEnforcement: string
  offerCreation: string
  offerEnforcement: string
  acceptance: string
  acceptanceEnforcement: string
  foreclosure: string
  foreclosureEnforcement: string
  oracleSecurity: string
  oracle1: string
  oracle2: string
  oracle3: string
  txSecurity: string
  txAllowlist: string
  txAllowlistDesc: string
  txRateLimit: string
  txRateLimitDesc: string
  txCompute: string
  txComputeDesc: string
  txLogging: string
  txLoggingDesc: string
  agentKeyMgmt: string
  key1: string
  key2: string
  key3: string
  key4: string
  smartContract: string
  smartContractDesc: string
}> = {
  en: {
    title: "Security & Risk",
    lead: "How the protocol protects users and prevents manipulation.",
    collateralEnforcement: "Collateral Enforcement",
    thStage: "Stage",
    thMinRatio: "Min Ratio",
    thEnforcement: "Enforcement",
    offerCreation: "Offer Creation",
    offerEnforcement: "Client + on-chain",
    acceptance: "Acceptance",
    acceptanceEnforcement: "On-chain (hard reject below)",
    foreclosure: "Foreclosure",
    foreclosureEnforcement: "On-chain with fresh Pyth price",
    oracleSecurity: "Oracle Security",
    oracle1: "Pyth Network prices — cryptographically signed by publishers",
    oracle2: "Fetched from Hermes API and posted on-chain before every collateral operation",
    oracle3: "Program rejects attestations older than 5 minutes (MAX_PYTH_PRICE_AGE_SECS = 300)",
    txSecurity: "Transaction Security",
    txAllowlist: "Agent instruction allowlist",
    txAllowlistDesc: "agents can only execute pre-approved instruction types",
    txRateLimit: "Rate limiting",
    txRateLimitDesc: "brute-force protection per wallet and per IP",
    txCompute: "Compute budget",
    txComputeDesc: "explicit 400K CU limit + 50K microLamport priority fee",
    txLogging: "Security logging",
    txLoggingDesc: "all sensitive operations are audited",
    agentKeyMgmt: "Agent Key Management",
    key1: "Keypairs managed by Privy secure infrastructure",
    key2: "Private keys never exposed to the Agio application",
    key3: "Isolated per-user keypairs",
    key4: "User can deactivate + withdraw at any time",
    smartContract: "Smart Contract",
    smartContractDesc: "Built with Anchor: automatic account validation, PDA derivation, signer verification, and rent-exempt account management. Program ID:",
  },
  es: {
    title: "Seguridad y Riesgo",
    lead: "Cómo el protocolo protege a los usuarios y previene la manipulación.",
    collateralEnforcement: "Aplicación de Garantías",
    thStage: "Etapa",
    thMinRatio: "Ratio Mín.",
    thEnforcement: "Aplicación",
    offerCreation: "Creación de Oferta",
    offerEnforcement: "Cliente + on-chain",
    acceptance: "Aceptación",
    acceptanceEnforcement: "On-chain (rechazo firme por debajo)",
    foreclosure: "Ejecución",
    foreclosureEnforcement: "On-chain con precio Pyth actualizado",
    oracleSecurity: "Seguridad de Oráculos",
    oracle1: "Precios de Pyth Network — firmados criptográficamente por los publicadores",
    oracle2: "Obtenidos de la API Hermes y publicados on-chain antes de cada operación de garantía",
    oracle3: "El programa rechaza atestaciones con más de 5 minutos (MAX_PYTH_PRICE_AGE_SECS = 300)",
    txSecurity: "Seguridad de Transacciones",
    txAllowlist: "Lista de instrucciones permitidas del agente",
    txAllowlistDesc: "los agentes solo pueden ejecutar tipos de instrucciones pre-aprobados",
    txRateLimit: "Límite de tasa",
    txRateLimitDesc: "protección contra fuerza bruta por wallet y por IP",
    txCompute: "Presupuesto de cómputo",
    txComputeDesc: "límite explícito de 400K CU + tarifa de prioridad de 50K microLamport",
    txLogging: "Registro de seguridad",
    txLoggingDesc: "todas las operaciones sensibles son auditadas",
    agentKeyMgmt: "Gestión de Claves del Agente",
    key1: "Pares de claves gestionados por la infraestructura segura de Privy",
    key2: "Las claves privadas nunca se exponen a la aplicación Agio",
    key3: "Pares de claves aislados por usuario",
    key4: "El usuario puede desactivar + retirar en cualquier momento",
    smartContract: "Contrato Inteligente",
    smartContractDesc: "Construido con Anchor: validación automática de cuentas, derivación de PDA, verificación de firmantes y gestión de cuentas exentas de renta. Program ID:",
  },
  pt: {
    title: "Segurança e Risco",
    lead: "Como o protocolo protege os usuários e previne manipulação.",
    collateralEnforcement: "Aplicação de Garantias",
    thStage: "Etapa",
    thMinRatio: "Taxa Mín.",
    thEnforcement: "Aplicação",
    offerCreation: "Criação de Oferta",
    offerEnforcement: "Cliente + on-chain",
    acceptance: "Aceitação",
    acceptanceEnforcement: "On-chain (rejeição firme abaixo)",
    foreclosure: "Execução",
    foreclosureEnforcement: "On-chain com preço Pyth atualizado",
    oracleSecurity: "Segurança de Oráculos",
    oracle1: "Preços da Pyth Network — assinados criptograficamente pelos publicadores",
    oracle2: "Obtidos da API Hermes e publicados on-chain antes de cada operação de garantia",
    oracle3: "O programa rejeita atestações com mais de 5 minutos (MAX_PYTH_PRICE_AGE_SECS = 300)",
    txSecurity: "Segurança de Transações",
    txAllowlist: "Lista de instruções permitidas do agente",
    txAllowlistDesc: "agentes só podem executar tipos de instruções pré-aprovados",
    txRateLimit: "Limite de taxa",
    txRateLimitDesc: "proteção contra força bruta por wallet e por IP",
    txCompute: "Orçamento de computação",
    txComputeDesc: "limite explícito de 400K CU + taxa de prioridade de 50K microLamport",
    txLogging: "Registro de segurança",
    txLoggingDesc: "todas as operações sensíveis são auditadas",
    agentKeyMgmt: "Gerenciamento de Chaves do Agente",
    key1: "Pares de chaves gerenciados pela infraestrutura segura do Privy",
    key2: "Chaves privadas nunca expostas à aplicação Agio",
    key3: "Pares de chaves isolados por usuário",
    key4: "O usuário pode desativar + sacar a qualquer momento",
    smartContract: "Contrato Inteligente",
    smartContractDesc: "Construído com Anchor: validação automática de contas, derivação de PDA, verificação de assinantes e gerenciamento de contas isentas de aluguel. Program ID:",
  },
  zh: {
    title: "安全与风险",
    lead: "协议如何保护用户并防止操纵。",
    collateralEnforcement: "抵押品执行",
    thStage: "阶段",
    thMinRatio: "最低比率",
    thEnforcement: "执行方式",
    offerCreation: "创建报价",
    offerEnforcement: "客户端 + 链上",
    acceptance: "接受",
    acceptanceEnforcement: "链上（低于则强制拒绝）",
    foreclosure: "清算",
    foreclosureEnforcement: "链上验证最新 Pyth 价格",
    oracleSecurity: "预言机安全",
    oracle1: "Pyth Network 价格——由发布者加密签名",
    oracle2: "在每次抵押品操作前从 Hermes API 获取并发布到链上",
    oracle3: "程序拒绝超过 5 分钟的价格证明（MAX_PYTH_PRICE_AGE_SECS = 300）",
    txSecurity: "交易安全",
    txAllowlist: "代理指令白名单",
    txAllowlistDesc: "代理只能执行预批准的指令类型",
    txRateLimit: "速率限制",
    txRateLimitDesc: "按钱包和 IP 进行暴力破解防护",
    txCompute: "计算预算",
    txComputeDesc: "明确的 400K CU 限制 + 50K microLamport 优先费",
    txLogging: "安全日志",
    txLoggingDesc: "所有敏感操作均被审计",
    agentKeyMgmt: "代理密钥管理",
    key1: "密钥对由 Privy 安全基础设施管理",
    key2: "私钥永远不会暴露给 Agio 应用",
    key3: "按用户隔离的密钥对",
    key4: "用户可以随时停用 + 提取资金",
    smartContract: "智能合约",
    smartContractDesc: "使用 Anchor 构建：自动账户验证、PDA 派生、签名者验证和免租账户管理。Program ID：",
  },
}

export default function SecurityPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.collateralEnforcement}</h2>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 font-medium">{s.thStage}</th>
              <th className="pb-2 font-medium">{s.thMinRatio}</th>
              <th className="pb-2 font-medium">{s.thEnforcement}</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.offerCreation}</td>
              <td>150% &ndash; 300%</td>
              <td>{s.offerEnforcement}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.acceptance}</td>
              <td>130%</td>
              <td>{s.acceptanceEnforcement}</td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="py-2 font-medium text-foreground">{s.foreclosure}</td>
              <td>&lt; 120%</td>
              <td>{s.foreclosureEnforcement}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>{s.oracleSecurity}</h2>
      <ul>
        <li>{s.oracle1}</li>
        <li>{s.oracle2}</li>
        <li>{s.oracle3}</li>
      </ul>

      <h2>{s.txSecurity}</h2>
      <ul>
        <li><strong>{s.txAllowlist}</strong> — {s.txAllowlistDesc}</li>
        <li><strong>{s.txRateLimit}</strong> — {s.txRateLimitDesc}</li>
        <li><strong>{s.txCompute}</strong> — {s.txComputeDesc}</li>
        <li><strong>{s.txLogging}</strong> — {s.txLoggingDesc}</li>
      </ul>

      <h2>{s.agentKeyMgmt}</h2>
      <ul>
        <li>{s.key1}</li>
        <li>{s.key2}</li>
        <li>{s.key3}</li>
        <li>{s.key4}</li>
      </ul>

      <h2>{s.smartContract}</h2>
      <p>
        {s.smartContractDesc}{" "}
        <code>AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX</code>.
      </p>
    </>
  )
}
