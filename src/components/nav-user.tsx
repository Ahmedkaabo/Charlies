import { useState } from "react"
import { toast } from "sonner"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, CircleUserRoundIcon, CreditCardIcon, BellIcon, LogOutIcon, UserPlusIcon, HashIcon, SunIcon, MoonIcon } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/components/theme-provider"

export function NavUser() {
  const { isMobile } = useSidebar()
  const { profile, accountId, accountCode, signOut } = useAuth()
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  const name   = profile?.full_name ?? "User"
  const email  = profile?.phone ?? ""
  const avatar = profile?.avatar_url ?? ""
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()

  async function copyInviteLink() {
    if (!accountId) {
      toast.error("No account found")
      return
    }
    setGeneratingInvite(true)
    const token = crypto.randomUUID()
    const { error } = await supabase.from("account_invites").insert({
      account_id: accountId,
      token,
      uses: 0,
    })
    setGeneratingInvite(false)
    if (error) {
      toast.error("Failed to generate invite link")
      return
    }
    await navigator.clipboard.writeText(`${window.location.origin}/register?invite=${token}`)
    toast.success("Invite link copied to clipboard!")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <EllipsisVerticalIcon className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HashIcon className="size-3" />
                <span className="font-mono">{accountCode ?? "—"}</span>
              </div>
              <button
                onClick={copyInviteLink}
                disabled={generatingInvite}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50"
              >
                <UserPlusIcon className="size-3" />
                {generatingInvite ? "Generating…" : "Invite"}
              </button>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <CircleUserRoundIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
