import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { useVisibleNavItems } from "@/hooks/usePermissions"
import { useLanguage } from "@/contexts/LanguageContext"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const MAX_DIRECT = 4 // items shown directly; slot 5 becomes "More"

export function BottomNav() {
  const { items } = useVisibleNavItems()
  const { pathname } = useLocation()
  const { t } = useLanguage()
  const [moreOpen, setMoreOpen] = useState(false)

  const needsMore   = items.length > MAX_DIRECT + 1
  const directItems = needsMore ? items.slice(0, MAX_DIRECT) : items
  const overflowItems = needsMore ? items.slice(MAX_DIRECT) : []

  const moreIsActive =
    needsMore &&
    overflowItems.some((item) =>
      item.path === "/" ? pathname === "/" : pathname.startsWith(item.path),
    )

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex h-16 items-stretch">
          {directItems.map((item) => (
            <li key={item.path} className="flex flex-1">
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-200",
                        isActive ? "w-6 bg-primary" : "w-0 bg-transparent",
                      )}
                    />
                    <item.icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        isActive && "scale-110",
                      )}
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    <span>{t(item.label)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}

          {/* More button */}
          {needsMore && (
            <li className="flex flex-1">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide transition-colors",
                  moreIsActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-200",
                    moreIsActive ? "w-6 bg-primary" : "w-0 bg-transparent",
                  )}
                />
                <MoreHorizontal
                  className="h-5 w-5"
                  strokeWidth={moreIsActive ? 2.25 : 1.75}
                />
                <span>{t("More")}</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* Overflow sheet */}
      {needsMore && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="h-auto rounded-t-2xl p-0">
            <SheetHeader className="px-6 pt-5 pb-3 border-b">
              <SheetTitle className="text-sm">{t("More")}</SheetTitle>
            </SheetHeader>
            <ul className="px-3 py-3 space-y-1">
              {overflowItems.map((item) => {
                const isActive =
                  item.path === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.path)
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                      {t(item.label)}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
            <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} className="pb-3" />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
