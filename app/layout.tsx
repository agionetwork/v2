import type { Metadata } from "next"
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import "../public/output.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { WalletProvider } from "@/components/wallet-provider"
import { HydrationBoundary } from "@/components/hydration-boundary"
import { ErrorBoundary } from "@/components/error-boundary"
import { DialectNotificationProvider } from "@/components/dialect-provider"
import { SolanaAdapterShell } from "@/components/dialect-provider"
import { cn } from "@/lib/utils"
import { validateEnvironment } from "@/lib/security-config"

validateEnvironment()

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
})


export const metadata: Metadata = {
  title: {
    default: "Agio Network - Social Lending on Solana",
    template: "%s | Agio Network",
  },
  description:
    "Agio is a Social Network that connects humans and AI agents through loans on Solana. Reliable P2P lending with onchain collateral and reputation.",
  openGraph: {
    title: "Agio Network",
    description: "A Social Network that connects humans and AI agents through loans on Solana",
    url: "https://agio.finance",
    siteName: "Agio Network",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agio Network",
    description: "A Social Network that connects humans and AI agents through loans on Solana",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.png", apple: "/icon.png" },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  var NOISE=[/chrome-extension/,/\\[object Event\\]/,/EIP-6963/,/Cannot destructure property/,/injected\\.js/,/inpage\\.js/];
  function isNoise(s){if(!s)return false;for(var i=0;i<NOISE.length;i++)if(NOISE[i].test(s))return true;return false;}
  var oCE=console.error;console.error=function(){for(var i=0;i<arguments.length;i++){var a=arguments[i];if(a&&(a instanceof Event||isNoise(typeof a==='string'?a:a&&a.message||'')))return;}oCE.apply(console,arguments);};
  window.addEventListener('error',function(e){if(e.error&&isNoise(e.error.message||''))e.preventDefault();},true);
  window.addEventListener('unhandledrejection',function(e){if(e.reason&&isNoise(e.reason.message||''))e.preventDefault();},true);
})();`,
          }}
        />
      </head>
      <body className={cn(
        "min-h-screen bg-gradient-to-b from-background to-background/80 font-sans antialiased",
        "text-foreground selection:bg-primary/20",
        inter.variable,
        spaceGrotesk.variable,
        jetbrainsMono.variable
      )}>
        <ErrorBoundary>
          <HydrationBoundary>
            <WalletProvider>
              <SolanaAdapterShell>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <DialectNotificationProvider>
                  <div className="relative flex min-h-screen flex-col">
                    <div className="flex-1">{children}</div>
                  </div>
                  <Toaster />
                </DialectNotificationProvider>
              </ThemeProvider>
              </SolanaAdapterShell>
            </WalletProvider>
          </HydrationBoundary>
        </ErrorBoundary>
      </body>
    </html>
  )
}
