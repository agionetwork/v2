"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sun, Moon, Menu, X, Wallet, LogOut, User, Bell, EyeOff } from "lucide-react"
import { NotificationsButton } from "@dialectlabs/react-ui"
import { useDialectAvailable } from "@/components/dialect-provider"
import { useTheme } from "next-themes"
import { useWalletContext } from "@/components/wallet-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { WalletConnectModal } from "@/components/wallet-connect-modal"
import { toast } from "sonner"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import { getCustomProperty } from "@/lib/tapestry"


interface DashboardHeaderProps {
  onConnectWallet?: () => void;
}

export default function DashboardHeader({ onConnectWallet }: DashboardHeaderProps = {}) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const { isConnected, address, provider, disconnect } = useWalletContext()
  const { profile: tapestryProfile } = useTapestryProfile()
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dialectAvailable = useDialectAvailable()

  const profileImage = tapestryProfile?.profile
    ? getCustomProperty(tapestryProfile.profile, "profileImage")
    : ""
  const profileDisplayName = tapestryProfile?.profile
    ? getCustomProperty(tapestryProfile.profile, "displayName")
    : ""

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleWalletConnect = () => {
    if (isConnected) {
      disconnect()
      toast.success("Disconnected successfully")
    } else {
      if (onConnectWallet) {
        onConnectWallet()
      } else {
        setIsWalletModalOpen(true)
      }
    }
  }

  const isUserAuthenticated = isConnected

  const getWalletDisplayName = (address?: string) => {
    if (!address) return "Unknown"
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const getProviderDisplayName = (provider?: string) => {
    if (!provider) return "Unknown"
    if (provider === 'phantom') return 'Phantom'
    if (provider === 'solflare') return 'Solflare'
    if (provider === 'backpack') return 'Backpack'
    return 'Wallet'
  }

  const getUserDisplayName = () => {
    if (profileDisplayName) return profileDisplayName
    if (address) return getWalletDisplayName(address)
    return "User"
  }

  // Render skeleton during SSR to avoid hydration errors
  if (!mounted) {
    return (
      <header className="agio-glass-header sticky top-0 z-50 w-full">
        <div className="container flex h-14 items-center">
          <div className="mr-4 hidden md:flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <img src="/agio-logo-3d.png" alt="AGIO Network" className="h-12 w-12" />
              <span className="hidden font-display text-[15px] font-medium tracking-tight text-white sm:inline-block">
                Agio Network
              </span>
            </Link>
            <nav className="flex items-center space-x-6 font-mono text-[12px] tracking-[0.06em] uppercase">
              <div className="h-8 w-24"></div>
              <div className="h-8 w-24"></div>
              <div className="h-8 w-24"></div>
            </nav>
          </div>
          <div className="mr-2 md:hidden">
            <div className="h-8 w-8"></div>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <nav className="flex items-center space-x-2">
              <div className="h-8 w-8"></div>
              <div className="h-8 w-8"></div>
              <div className="h-8 w-8"></div>
            </nav>
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <div className="h-8 w-32"></div>
            </div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="agio-glass-header sticky top-0 z-50 w-full">
      <div className="container flex h-14 items-center">
        <div className="hidden md:flex items-center mr-4">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/agio-logo-3d.png" alt="AGIO Network" className="h-12 w-12" />
            <span className="hidden font-display text-[15px] font-medium tracking-tight text-white sm:inline-block">
              Agio Network
            </span>
          </Link>
        </div>
        <nav className="hidden md:flex flex-1 items-center justify-center space-x-6 font-mono text-[12px] tracking-[0.06em] uppercase">
          <Link
            href="/dashboard"
            className={`transition-colors hover:text-white/80 ${
              pathname === "/dashboard" ? "text-white" : "text-white/60"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/socialfi"
            className={`transition-colors hover:text-white/80 ${
              pathname === "/socialfi" ? "text-white" : "text-white/60"
            }`}
          >
            Social
          </Link>
          <Link
            href="/auto-loan"
            className={`transition-colors hover:text-white/80 ${
              pathname === "/auto-loan" ? "text-white" : "text-white/60"
            }`}
          >
            Auto-Loan
          </Link>
          <Link
            href="/borrow-lend"
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
              pathname === "/borrow-lend" ? "text-white" : "text-white/60 hover:text-white"
            )}
          >
            Borrow / Lend
          </Link>
          <Link
            href="/loan-offers"
            className={`transition-colors hover:text-white/80 ${
              pathname === "/loan-offers" ? "text-white" : "text-white/60"
            }`}
          >
            Loan Offers
          </Link>
        </nav>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base text-white hover:bg-transparent hover:text-white/80 focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
          onClick={() => setMobileMenuOpen((v) => !v)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          <span className="sr-only">Toggle Menu</span>
        </Button>
        <Link href="/" className="md:hidden flex items-center mr-2">
          <img src="/agio-logo-3d.png" alt="AGIO" className="h-8 w-8" />
        </Link>
        <div className="flex flex-1 md:flex-none items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="text-white hover:bg-transparent hover:text-white/80 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Notification bell — always visible whenever the wallet is
              connected. When the Dialect SDK is initialised we hand the
              click off to <NotificationsButton/> so the inbox modal opens.
              When it isn't (env unconfigured, wallet provider not
              recognised, SDK still mounting) we render a plain bell that
              shows a friendly toast instead, so the icon never silently
              disappears. */}
          {isConnected && (
            dialectAvailable ? (
              <NotificationsButton
                theme={theme === "dark" ? "dark" : "light"}
                channels={["email", "telegram"]}
                renderModalComponent={({ ref, open, children }) =>
                  open ? (
                    <div
                      ref={ref}
                      className="dialect fixed right-4 top-16 z-[100] w-[400px] max-h-[80vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl"
                    >
                      {children}
                    </div>
                  ) : null
                }
              >
                {({ open, setOpen, unreadCount, ref }) => (
                  <Button
                    ref={ref}
                    variant="ghost"
                    size="icon"
                    onClick={() => setOpen(!open)}
                    className="relative text-white hover:bg-transparent hover:text-white/80 focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                    <span className="sr-only">Notifications</span>
                  </Button>
                )}
              </NotificationsButton>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toast.info("Notifications are warming up — try again in a moment.")}
                className="relative text-white hover:bg-transparent hover:text-white/80 focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Button>
            )
          )}

          {isUserAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full bg-transparent hover:bg-transparent focus-visible:bg-transparent"
                  >
                    <Avatar className="h-8 w-8">
                      {profileImage ? (
                        <AvatarImage
                          src={profileImage}
                          alt="User Avatar"
                        />
                      ) : null}
                      <AvatarFallback className="bg-blue-600 text-white text-xs">
                        {getUserDisplayName().slice(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48" align="end" forceMount>
                  <DropdownMenuItem asChild>
                    <Link href="/socialfi/edit-profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/socialfi/compliance" className="cursor-pointer">
                      <EyeOff className="mr-2 h-4 w-4" />
                      <span>Privacy &amp; Audit</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleWalletConnect}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Disconnect</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={handleWalletConnect}
                className="bg-[#1358EC] hover:bg-blue-700 text-white"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
          )}
        </div>
      </div>
      
      {mobileMenuOpen && (
        <nav className="agio-glass-header md:hidden px-4 py-3 space-y-1">
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/socialfi", label: "Social" },
            { href: "/auto-loan", label: "Auto-Loan" },
            { href: "/borrow-lend", label: "Borrow / Lend" },
            { href: "/loan-offers", label: "Loan Offers" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block px-3 py-2 rounded-md font-mono text-[13px] tracking-[0.06em] uppercase transition-colors",
                pathname === item.href
                  ? "text-white bg-white/10"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Wallet connection modal */}
      <WalletConnectModal isOpen={isWalletModalOpen} setIsOpen={setIsWalletModalOpen} />
    </header>
  )
}

