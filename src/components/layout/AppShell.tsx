import { useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut, UserPlus } from "lucide-react"
import { toast } from "sonner"
import logo from "@/assets/logo.svg"

import { CharSidebar } from "@/components/layout/Sidebar"
import { BottomNav } from "@/components/layout/BottomNav"
import { ROUTE_TITLES } from "@/lib/nav"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAuth } from "@/hooks/useAuth"
import type { SystemRole } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ── Helpers ───────────────────────────────────────────────────

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return (email ?? "??").slice(0, 2).toUpperCase()
}

function formatRole(role: SystemRole): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function usePageTitle(): string {
  const { pathname } = useLocation()
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  const prefix = Object.keys(ROUTE_TITLES).find(
    (p) => p !== "/" && pathname.startsWith(p)
  )
  return prefix ? ROUTE_TITLES[prefix] : "Dashboard"
}

// ── AppShell ──────────────────────────────────────────────────

export function AppShell() {
  const isMobile = useIsMobile()
  const pageTitle = usePageTitle()
  const navigate = useNavigate()

  const { user, profile, systemRole, accountId, accountCode, signOut } = useAuth()

  const [profileOpen, setProfileOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)

  const fullName = profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined)
  const email = user?.email ?? ""
  const initials = getInitials(fullName, email)

  async function copyInviteLink() {
    if (!accountId) { toast.error("No account found"); return }
    setGeneratingInvite(true)
    const token = crypto.randomUUID()
    const { error } = await supabase
      .from("account_invites")
      .insert({ account_id: accountId, token, uses: 0 })
    setGeneratingInvite(false)
    if (error) { toast.error("Failed to generate invite link"); return }
    await navigator.clipboard.writeText(`${window.location.origin}/register?invite=${token}`)
    toast.success("Invite link copied!")
  }

  async function handleSignOut() {
    setProfileOpen(false)
    await signOut()
    toast.success("Signed out")
    navigate("/login", { replace: true })
  }

  return (
    <SidebarProvider>
      {!isMobile && <CharSidebar />}

      <SidebarInset>
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex h-12 shrink-0 items-center border-b transition-[width,height] ease-linear">
          {/* Mobile: logo left, profile right */}
          <div className="flex md:hidden w-full items-center justify-between px-4">
            <img src={logo} alt="Charlies" className="h-6 w-auto" />
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open profile"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] font-bold leading-none">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>

          {/* Desktop: sidebar trigger + page title */}
          <div className="hidden md:flex items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ms-1" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
            <h1 className="text-base font-medium">{pageTitle}</h1>
          </div>
        </header>

        {/* ── Page content ───────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </div>

        {/* ── Mobile bottom nav ──────────────────────────── */}
        <BottomNav />
      </SidebarInset>

      {/* ── Profile sheet (mobile) ──────────────────────── */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl p-0 md:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Profile</SheetTitle>
          </SheetHeader>

          {/* User info */}
          <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b">
            <Avatar className="h-10 w-10 rounded-xl shrink-0">
              <AvatarFallback className="rounded-xl text-sm font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-sm">{fullName ?? email}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {systemRole ? formatRole(systemRole) : ""}
              </p>
              {accountCode !== null && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-muted-foreground/70 font-mono">#{accountCode}</span>
                  <button
                    onClick={copyInviteLink}
                    disabled={generatingInvite}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50"
                  >
                    <UserPlus className="size-3" />
                    {generatingInvite ? "…" : "Invite"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <ul className="px-3 py-3">
            <li>
              <button
                type="button"
                onClick={() => { setProfileOpen(false); setConfirmOpen(true) }}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </li>
          </ul>

          <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} className="pb-3" />
        </SheetContent>
      </Sheet>

      {/* ── Sign-out confirmation ───────────────────────── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of CHARLIES?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
