"use client"

import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  prerequisites: string
  prereq1: string
  prereq2: string
  prereq3: string
  connectWallet: string
  connectWalletDesc: string
  createOffer: string
  createOfferDesc: string
  lendLabel: string
  lendDesc: string
  borrowLabel: string
  borrowDesc: string
  acceptTitle: string
  acceptDesc: string
  manageTitle: string
  manageDesc: string
  repayLabel: string
  repayDesc: string
  addCollateralLabel: string
  addCollateralDesc: string
  forecloseLabel: string
  forecloseDesc: string
  rescindLabel: string
  rescindDesc: string
  devnetTitle: string
  devnetDesc: string
}> = {
  en: {
    title: "Quick Start",
    lead: "Connect a wallet and start lending or borrowing in under two minutes.",
    prerequisites: "Prerequisites",
    prereq1: "Solana wallet (Phantom, Solflare, or any wallet-standard compatible)",
    prereq2: "Devnet SOL for transaction fees",
    prereq3: "USDC or EURC to lend (or SOL as collateral to borrow)",
    connectWallet: "1. Connect Wallet",
    connectWalletDesc: "and click",
    createOffer: "2. Create an Offer",
    createOfferDesc: "and choose:",
    lendLabel: "Lend",
    lendDesc: "set the token, amount, APY, duration, and required collateral ratio. Your tokens are escrowed on-chain until matched.",
    borrowLabel: "Borrow",
    borrowDesc: "specify the amount you need, APY you will pay, and collateral you can deposit. Lenders see your request and can fund it.",
    acceptTitle: "3. Accept or Get Matched",
    acceptDesc: "to find and accept existing offers. When a match happens, collateral goes to the vault, debt tokens move to the borrower, and a 1% origination fee is collected — all atomically in one transaction.",
    manageTitle: "4. Manage Loans",
    manageDesc: "you can:",
    repayLabel: "Repay",
    repayDesc: "return principal + interest, get collateral back",
    addCollateralLabel: "Add Collateral",
    addCollateralDesc: "improve your safety ratio if prices move",
    forecloseLabel: "Foreclose",
    forecloseDesc: "(lender) seize collateral when ratio drops below 130%",
    rescindLabel: "Rescind",
    rescindDesc: "cancel a pending unmatched offer",
    devnetTitle: "Live on Devnet",
    devnetDesc: "The protocol is deployed on Solana devnet. All features are fully functional with test tokens. No real funds at risk.",
  },
  es: {
    title: "Inicio Rápido",
    lead: "Conecta una wallet y empieza a prestar o pedir prestado en menos de dos minutos.",
    prerequisites: "Requisitos previos",
    prereq1: "Wallet de Solana (Phantom, Solflare o cualquier compatible con wallet-standard)",
    prereq2: "SOL en devnet para comisiones de transacción",
    prereq3: "USDC o EURC para prestar (o SOL como garantía para pedir prestado)",
    connectWallet: "1. Conectar Wallet",
    connectWalletDesc: "y haz clic en",
    createOffer: "2. Crear una Oferta",
    createOfferDesc: "y elige:",
    lendLabel: "Prestar",
    lendDesc: "configura el token, monto, APY, duración y ratio de garantía requerido. Tus tokens se depositan en custodia on-chain hasta que se emparejen.",
    borrowLabel: "Pedir prestado",
    borrowDesc: "especifica el monto que necesitas, el APY que pagarás y la garantía que puedes depositar. Los prestamistas ven tu solicitud y pueden financiarla.",
    acceptTitle: "3. Aceptar o Ser Emparejado",
    acceptDesc: "para encontrar y aceptar ofertas existentes. Cuando ocurre un emparejamiento, la garantía va a la bóveda, los tokens de deuda pasan al prestatario y se cobra una comisión de originación del 1% — todo atómicamente en una transacción.",
    manageTitle: "4. Gestionar Préstamos",
    manageDesc: "puedes:",
    repayLabel: "Pagar",
    repayDesc: "devolver principal + intereses, recuperar la garantía",
    addCollateralLabel: "Añadir Garantía",
    addCollateralDesc: "mejorar tu ratio de seguridad si los precios cambian",
    forecloseLabel: "Ejecutar",
    forecloseDesc: "(prestamista) confiscar la garantía cuando el ratio cae por debajo del 130%",
    rescindLabel: "Rescindir",
    rescindDesc: "cancelar una oferta pendiente sin emparejar",
    devnetTitle: "Activo en Devnet",
    devnetDesc: "El protocolo está desplegado en la devnet de Solana. Todas las funciones son completamente operativas con tokens de prueba. Sin riesgo de fondos reales.",
  },
  pt: {
    title: "Início Rápido",
    lead: "Conecte uma wallet e comece a emprestar ou tomar emprestado em menos de dois minutos.",
    prerequisites: "Pré-requisitos",
    prereq1: "Wallet Solana (Phantom, Solflare ou qualquer compatível com wallet-standard)",
    prereq2: "SOL na devnet para taxas de transação",
    prereq3: "USDC ou EURC para emprestar (ou SOL como garantia para tomar emprestado)",
    connectWallet: "1. Conectar Wallet",
    connectWalletDesc: "e clique em",
    createOffer: "2. Criar uma Oferta",
    createOfferDesc: "e escolha:",
    lendLabel: "Emprestar",
    lendDesc: "defina o token, valor, APY, duração e taxa de garantia exigida. Seus tokens ficam em custódia on-chain até serem combinados.",
    borrowLabel: "Tomar emprestado",
    borrowDesc: "especifique o valor necessário, o APY que pagará e a garantia que pode depositar. Os credores veem sua solicitação e podem financiá-la.",
    acceptTitle: "3. Aceitar ou Ser Combinado",
    acceptDesc: "para encontrar e aceitar ofertas existentes. Quando ocorre uma combinação, a garantia vai para o cofre, os tokens de dívida vão para o mutuário e uma taxa de originação de 1% é cobrada — tudo atomicamente em uma transação.",
    manageTitle: "4. Gerenciar Empréstimos",
    manageDesc: "você pode:",
    repayLabel: "Pagar",
    repayDesc: "devolver principal + juros, recuperar a garantia",
    addCollateralLabel: "Adicionar Garantia",
    addCollateralDesc: "melhorar sua taxa de segurança se os preços mudarem",
    forecloseLabel: "Executar",
    forecloseDesc: "(credor) confiscar a garantia quando a taxa cai abaixo de 130%",
    rescindLabel: "Rescindir",
    rescindDesc: "cancelar uma oferta pendente não combinada",
    devnetTitle: "Ativo na Devnet",
    devnetDesc: "O protocolo está implantado na devnet da Solana. Todas as funcionalidades estão totalmente operacionais com tokens de teste. Sem risco de fundos reais.",
  },
  zh: {
    title: "快速开始",
    lead: "连接钱包，两分钟内即可开始借贷。",
    prerequisites: "前提条件",
    prereq1: "Solana 钱包（Phantom、Solflare 或任何兼容 wallet-standard 的钱包）",
    prereq2: "用于交易费用的 Devnet SOL",
    prereq3: "用于出借的 USDC 或 EURC（或用作抵押品借款的 SOL）",
    connectWallet: "1. 连接钱包",
    connectWalletDesc: "然后点击",
    createOffer: "2. 创建报价",
    createOfferDesc: "并选择：",
    lendLabel: "出借",
    lendDesc: "设置代币、金额、APY、期限和所需抵押率。您的代币在匹配前将托管在链上。",
    borrowLabel: "借入",
    borrowDesc: "指定所需金额、您将支付的 APY 以及可存入的抵押品。出借方可以看到您的请求并进行资助。",
    acceptTitle: "3. 接受或被匹配",
    acceptDesc: "查找并接受现有报价。匹配发生时，抵押品进入金库，债务代币转给借款人，并收取 1% 的发起费——全部在一笔交易中原子执行。",
    manageTitle: "4. 管理贷款",
    manageDesc: "您可以：",
    repayLabel: "偿还",
    repayDesc: "归还本金 + 利息，取回抵押品",
    addCollateralLabel: "追加抵押品",
    addCollateralDesc: "在价格波动时改善您的安全比率",
    forecloseLabel: "清算",
    forecloseDesc: "（出借方）当比率降至 130% 以下时没收抵押品",
    rescindLabel: "撤销",
    rescindDesc: "取消未匹配的待处理报价",
    devnetTitle: "已在 Devnet 上线",
    devnetDesc: "该协议已部署在 Solana devnet 上。所有功能均可使用测试代币完整运行。无真实资金风险。",
  },
}

export default function GettingStartedPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.prerequisites}</h2>
      <ul>
        <li>{s.prereq1}</li>
        <li>{s.prereq2} (<a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer">faucet.solana.com</a>)</li>
        <li>{s.prereq3} (<a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">faucet.circle.com</a>)</li>
      </ul>

      <h2>{s.connectWallet}</h2>
      <p>
        Go to <a href="https://agio.network" target="_blank" rel="noopener noreferrer">agio.network</a> {s.connectWalletDesc}{" "}
        <strong>Connect Wallet</strong>. The app uses wallet-standard so any compatible
        extension works.
      </p>

      <h2>{s.createOffer}</h2>
      <p>
        Navigate to <strong>Borrow & Lend</strong> {s.createOfferDesc}
      </p>
      <ul>
        <li><strong>{s.lendLabel}</strong> — {s.lendDesc}</li>
        <li><strong>{s.borrowLabel}</strong> — {s.borrowDesc}</li>
      </ul>

      <h2>{s.acceptTitle}</h2>
      <p>
        Browse <strong>Loan Offers</strong> {s.acceptDesc}
      </p>

      <h2>{s.manageTitle}</h2>
      <p>From the <strong>Dashboard</strong> {s.manageDesc}</p>
      <ul>
        <li><strong>{s.repayLabel}</strong> — {s.repayDesc}</li>
        <li><strong>{s.addCollateralLabel}</strong> — {s.addCollateralDesc}</li>
        <li><strong>{s.forecloseLabel}</strong> — {s.forecloseDesc}</li>
        <li><strong>{s.rescindLabel}</strong> — {s.rescindDesc}</li>
      </ul>

      <div className="not-prose my-8 rounded-lg border border-primary/20 bg-primary/5 p-5">
        <p className="text-sm font-medium text-primary mb-1">{s.devnetTitle}</p>
        <p className="text-sm text-muted-foreground">
          {s.devnetDesc}
        </p>
      </div>
    </>
  )
}
