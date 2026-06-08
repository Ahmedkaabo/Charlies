import * as React from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { EllipsisVertical, LogOut, KeyRound, Crown, Store, UserPlus } from "lucide-react"
import logo from "@/assets/logo.svg"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import type { SystemRole } from "@/hooks/useAuth"
import { useVisibleNavGroups, useUserPermissions } from "@/hooks/usePermissions"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function getInitials(name?: string, email?: string): string {
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

function isPathActive(itemPath: string, pathname: string): boolean {
  return itemPath === "/" ? pathname === "/" : pathname.startsWith(itemPath)
}

// ── Component ─────────────────────────────────────────────────

export function CharSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [generatingInvite, setGeneratingInvite] = React.useState(false)
  const { user, profile, isAdmin, systemRole, accountId, accountCode, signOut } = useAuth()
  const { setOpenMobile } = useSidebar()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  async function copyInviteLink() {
    if (!accountId) { toast.error("No account found"); return }
    setGeneratingInvite(true)
    const token = crypto.randomUUID()
    const { error } = await supabase.from("account_invites").insert({ account_id: accountId, token, uses: 0 })
    setGeneratingInvite(false)
    if (error) { toast.error("Failed to generate invite link"); return }
    await navigator.clipboard.writeText(`${window.location.origin}/register?invite=${token}`)
    toast.success("Invite link copied!")
  }

  // Close the mobile sheet whenever the route changes
  React.useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  const fullName = profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined)
  const email = user?.email ?? ""
  const initials = getInitials(fullName, email)
  // systemRole comes from useAuth() above

  const { groups: visibleNavGroups } = useVisibleNavGroups()
  const { canRead, isOwner, loading: permsLoading } = useUserPermissions()

  // Optimistic: show during loading so items don't flash in/out
  const showSettings    = permsLoading || canRead("settings")
  const showPermissions = permsLoading || canRead("permissions")

  const hasSettingsGroup = isAdmin || showSettings || showPermissions
async function handleSignOut() {
    await signOut()
    toast.success("Signed out")
    navigate("/login", { replace: true })
  }

  return (
    <>
      <Sidebar collapsible="offcanvas" {...props}>

        {/* ── Logo ──────────────────────────────────── */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="data-[slot=sidebar-menu-button]:p-2!"
              >
                <NavLink to="/">
                  <img src={logo} alt="Charlies" className="h-6 w-auto" />
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* ── Nav items ─────────────────────────────── */}
        <SidebarContent>
          {visibleNavGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        isActive={isPathActive(item.path, pathname)}
                        className={cn(item.adminOnly && "text-muted-foreground")}
                      >
                        <NavLink to={item.path} end={item.path === "/"}>
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          {/* ── Settings group ────────────────────────── */}
          {hasSettingsGroup && (
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Branches" isActive={isPathActive("/branches", pathname)}>
                      <NavLink to="/branches">
                        <Store />
                        <span>Branches</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {(isAdmin || isOwner || permsLoading) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Owners" isActive={isPathActive("/users", pathname)}>
                        <NavLink to="/users">
                          <Crown />
                          <span>Owners</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {showPermissions && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Permissions" isActive={isPathActive("/permissions", pathname)}>
                        <NavLink to="/permissions">
                          <KeyRound />
                          <span>Permissions</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* ── User footer ───────────────────────────── */}
        <SidebarFooter>
          <SidebarMenu>

            {/* Profile */}
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-start text-sm leading-tight">
                      <span className="truncate font-medium">{fullName ?? email}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {systemRole ? formatRole(systemRole) : email}
                      </span>
                    </div>
                    <EllipsisVertical className="ms-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                  side="right"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-start gap-2 px-1 py-1.5">
                      <Avatar className="h-8 w-8 rounded-lg mt-0.5">
                        <AvatarFallback className="rounded-lg text-xs font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-start text-sm leading-tight">
                        <span className="truncate font-medium">{fullName ?? email}</span>
                        <span className="truncate text-xs text-muted-foreground">{email}</span>
                        {accountCode !== null && (
                          <span className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground/70 font-mono">#{accountCode}</span>
                            <button
                              onClick={copyInviteLink}
                              disabled={generatingInvite}
                              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50"
                            >
                              <UserPlus className="size-3" />
                              {generatingInvite ? "…" : "Invite"}
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* ── Sign-out confirmation ──────────────────── */}
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
    </>
  )
}
