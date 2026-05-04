"use client"

import Link from "next/link"
import { useT, type Lang } from "../i18n"

const t: Record<Lang, {
  title: string
  lead: string
  overview: string
  overviewDesc: string
  profiles: string
  profilesDesc: string
  connections: string
  connectionsDesc: string
  offersFeed: string
  offersFeedDesc: string
  activityFeed: string
  activityFeedDesc: string
  whyItMatters: string
  whyItMattersDesc: string
  whereToFind: string
  whereToFindDesc: string
  whereToFindLinkText: string
}> = {
  en: {
    title: "Social",
    lead: "Agio's social layer turns the marketplace into a network. Connect with other lenders and borrowers, follow their activity, and see their public offers in your personalized feed.",
    overview: "Overview",
    overviewDesc: "Profiles, follows, friendships, and feeds are powered by Tapestry, a social graph protocol on Solana. Your wallet becomes a profile that other users can discover, follow, and friend. The Social page (/socialfi) is where you browse offers from your network, accept connection requests, and see what your counterparties have been up to.",
    profiles: "Profiles",
    profilesDesc: "Anyone with a connected wallet can claim a profile: pick a username, upload an avatar, write a short bio. Profiles are public and queryable on-chain via Tapestry. Other users see your profile when they hover an offer card or open your loan history.",
    connections: "Connections",
    connectionsDesc: "Follow a user to subscribe to their activity. Send a friend request to upgrade the relationship to mutual: when both sides accept, you become friends. Friends rank higher in your feeds and are surfaced in suggestions. Each completed friendship grants both parties +5 social points.",
    offersFeed: "Offers feed",
    offersFeedDesc: "The Offers tab on /socialfi lists every public lending offer and borrow request created by people you follow or are friends with, refreshed in real time as new offers land on-chain. Filter by token, by APY, or by collateral ratio. Click any offer to inspect the full terms before accepting.",
    activityFeed: "Activity feed",
    activityFeedDesc: "Beyond offers, the network surfaces the lifecycle events of your connections: a friend just accepted a USDC loan, a follow repaid early, an exclusive counterparty offer was rescinded. This is the signal layer for tracking counterparty health without polling the chain yourself.",
    whyItMatters: "Why it matters",
    whyItMattersDesc: "P2P lending lives or dies on counterparty trust. Public profiles give borrowers a track record they can build on (every repaid loan strengthens their reputation), and the feed lets lenders find people they already trust without combing the full marketplace. Private offers via Cloak still hide the on-chain wallets, but the social layer remains opt-in for users who want to be discoverable.",
    whereToFind: "Where to find it",
    whereToFindDesc: "Open the social hub at ",
    whereToFindLinkText: "/socialfi",
  },
  es: {
    title: "Social",
    lead: "La capa social de Agio convierte el marketplace en una red. Conéctate con otros prestamistas y prestatarios, sigue su actividad y ve sus ofertas públicas en tu feed personalizado.",
    overview: "Descripción General",
    overviewDesc: "Perfiles, seguimientos, amistades y feeds funcionan sobre Tapestry, un protocolo de grafo social en Solana. Tu wallet se vuelve un perfil que otros usuarios pueden descubrir, seguir y agregar como amigo. La página Social (/socialfi) es donde exploras ofertas de tu red, aceptas solicitudes de conexión y ves lo que tus contrapartes han estado haciendo.",
    profiles: "Perfiles",
    profilesDesc: "Cualquiera con una wallet conectada puede reclamar un perfil: elige un nombre de usuario, sube un avatar, escribe una bio corta. Los perfiles son públicos y consultables on-chain vía Tapestry. Otros usuarios ven tu perfil al pasar el cursor sobre una oferta o abrir tu historial de préstamos.",
    connections: "Conexiones",
    connectionsDesc: "Sigue a un usuario para suscribirte a su actividad. Envía una solicitud de amistad para elevar la relación a mutua: cuando ambos lados aceptan, se vuelven amigos. Los amigos aparecen primero en tus feeds y se destacan en las sugerencias. Cada amistad completada otorga +5 puntos sociales a ambas partes.",
    offersFeed: "Feed de ofertas",
    offersFeedDesc: "La pestaña Ofertas en /socialfi lista cada oferta pública de préstamo y solicitud de préstamo creada por personas que sigues o son tus amigos, actualizada en tiempo real conforme nuevas ofertas aparecen on-chain. Filtra por token, por APY o por ratio de garantía. Haz clic en cualquier oferta para inspeccionar los términos completos antes de aceptar.",
    activityFeed: "Feed de actividad",
    activityFeedDesc: "Más allá de las ofertas, la red muestra los eventos del ciclo de vida de tus conexiones: un amigo acaba de aceptar un préstamo en USDC, un seguidor pagó temprano, una oferta de contraparte exclusiva fue rescindida. Esta es la capa de señales para rastrear la salud de tus contrapartes sin sondear la cadena tú mismo.",
    whyItMatters: "Por qué importa",
    whyItMattersDesc: "El préstamo P2P vive o muere por la confianza entre contrapartes. Los perfiles públicos dan a los prestatarios un historial sobre el que construir (cada préstamo pagado fortalece su reputación), y el feed permite a los prestamistas encontrar personas en las que ya confían sin peinar el marketplace completo. Las ofertas privadas vía Cloak siguen ocultando las wallets on-chain, pero la capa social permanece opcional para usuarios que quieren ser descubiertos.",
    whereToFind: "Dónde encontrarlo",
    whereToFindDesc: "Abre el hub social en ",
    whereToFindLinkText: "/socialfi",
  },
  pt: {
    title: "Social",
    lead: "A camada social da Agio transforma o marketplace em uma rede. Conecte-se com outros credores e tomadores, acompanhe a atividade deles e veja suas ofertas públicas no seu feed personalizado.",
    overview: "Visão Geral",
    overviewDesc: "Perfis, follows, amizades e feeds rodam em cima do Tapestry, um protocolo de grafo social na Solana. Sua wallet vira um perfil que outros usuários podem descobrir, seguir e adicionar como amigo. A página Social (/socialfi) é onde você navega ofertas da sua rede, aceita pedidos de conexão e vê o que suas contrapartes andaram fazendo.",
    profiles: "Perfis",
    profilesDesc: "Qualquer um com uma wallet conectada pode reivindicar um perfil: escolhe um username, sobe um avatar, escreve uma bio curta. Perfis são públicos e consultáveis on-chain via Tapestry. Outros usuários veem seu perfil ao passar o mouse sobre um card de oferta ou abrir seu histórico de empréstimos.",
    connections: "Conexões",
    connectionsDesc: "Siga um usuário para se inscrever na atividade dele. Envie um pedido de amizade para elevar a relação a mútua: quando ambos os lados aceitam, vocês viram amigos. Amigos aparecem primeiro nos seus feeds e ficam em destaque nas sugestões. Cada amizade concluída concede +5 pontos sociais para ambas as partes.",
    offersFeed: "Feed de ofertas",
    offersFeedDesc: "A aba Ofertas em /socialfi lista cada oferta pública de empréstimo e solicitação de empréstimo criada por pessoas que você segue ou são seus amigos, atualizada em tempo real conforme novas ofertas aparecem on-chain. Filtre por token, por APY ou por índice de garantia. Clique em qualquer oferta para inspecionar os termos completos antes de aceitar.",
    activityFeed: "Feed de atividade",
    activityFeedDesc: "Além das ofertas, a rede mostra os eventos de ciclo de vida das suas conexões: um amigo acabou de aceitar um empréstimo em USDC, um follow pagou antes do prazo, uma oferta de contraparte exclusiva foi cancelada. Essa é a camada de sinais pra acompanhar a saúde das contrapartes sem ter que sondar a chain você mesmo.",
    whyItMatters: "Por que importa",
    whyItMattersDesc: "Empréstimo P2P vive ou morre da confiança entre contrapartes. Perfis públicos dão aos tomadores um histórico em cima do qual construir (cada empréstimo pago fortalece a reputação), e o feed permite que credores encontrem pessoas em quem já confiam sem vasculhar o marketplace inteiro. Ofertas privadas via Cloak continuam escondendo as wallets on-chain, mas a camada social permanece opt-in para usuários que querem ser descobertos.",
    whereToFind: "Onde encontrar",
    whereToFindDesc: "Abra o hub social em ",
    whereToFindLinkText: "/socialfi",
  },
  zh: {
    title: "社交",
    lead: "Agio 的社交层将市场变成一个网络。与其他出借人和借款人建立连接，关注他们的活动，并在您的个性化信息流中看到他们的公开报价。",
    overview: "概述",
    overviewDesc: "档案、关注、好友关系和信息流由 Tapestry 提供支持，一个 Solana 上的社交图谱协议。您的钱包成为其他用户可以发现、关注和添加为好友的档案。社交页面 (/socialfi) 是您浏览来自网络的报价、接受连接请求并查看交易对手近期动态的地方。",
    profiles: "档案",
    profilesDesc: "任何连接钱包的用户都可以创建档案：选择用户名、上传头像、写一段简短的个人介绍。档案是公开的，可通过 Tapestry 在链上查询。其他用户在悬停在报价卡片或打开您的贷款历史时会看到您的档案。",
    connections: "连接",
    connectionsDesc: "关注用户以订阅其活动。发送好友请求将关系升级为相互关注：当双方都接受时，你们成为好友。好友在您的信息流中排名更高，并在建议中突出显示。每完成一次好友关系，双方都会获得 +5 社交积分。",
    offersFeed: "报价信息流",
    offersFeedDesc: "/socialfi 的报价标签页列出您关注的人或好友创建的每个公开借贷报价和借款请求，随着新报价在链上出现而实时刷新。按代币、APY 或抵押率筛选。点击任何报价可在接受前查看完整条款。",
    activityFeed: "活动信息流",
    activityFeedDesc: "除了报价，网络还展示您的连接的生命周期事件：一位好友刚接受了一笔 USDC 贷款、一位关注者提前还款、一笔独家对手方报价被撤销。这是无需自己轮询链就能跟踪交易对手健康状况的信号层。",
    whyItMatters: "为什么重要",
    whyItMattersDesc: "P2P 借贷的成败取决于交易对手之间的信任。公开档案为借款人提供了一个可以建立的记录（每笔偿还的贷款都会增强其声誉），信息流让出借人无需梳理整个市场就能找到他们已经信任的人。通过 Cloak 的私密报价仍然隐藏链上钱包，但社交层对于希望被发现的用户保持可选。",
    whereToFind: "在哪里找到",
    whereToFindDesc: "在以下位置打开社交中心 ",
    whereToFindLinkText: "/socialfi",
  },
}

export default function SocialPage() {
  const s = useT(t)
  return (
    <>
      <h1>{s.title}</h1>
      <p className="lead text-lg text-muted-foreground">
        {s.lead}
      </p>

      <h2>{s.overview}</h2>
      <p>{s.overviewDesc}</p>

      <h2>{s.profiles}</h2>
      <p>{s.profilesDesc}</p>

      <h2>{s.connections}</h2>
      <p>{s.connectionsDesc}</p>

      <h2>{s.offersFeed}</h2>
      <p>{s.offersFeedDesc}</p>

      <h2>{s.activityFeed}</h2>
      <p>{s.activityFeedDesc}</p>

      <h2>{s.whyItMatters}</h2>
      <p>{s.whyItMattersDesc}</p>

      <h2>{s.whereToFind}</h2>
      <p>
        {s.whereToFindDesc}
        <Link href="/socialfi">{s.whereToFindLinkText}</Link>.
      </p>
    </>
  )
}
