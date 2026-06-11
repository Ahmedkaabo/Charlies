import { useState } from "react"
import {
  Utensils, Coffee, Zap, Flame, Droplets, Wifi, Truck, Car,
  Home, Building2, Wrench, Sparkles, Scissors, Package, ShoppingCart,
  Banknote, Wallet, Megaphone, Cpu, ClipboardList, MoreHorizontal,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
} from "@/hooks/useExpenseCategoryMutations"
import { cn } from "@/lib/utils"
import type { ExpenseCategory } from "@/types/expense"
import { useLanguage } from "@/contexts/LanguageContext"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// ── Icon options ───────────────────────────────────────────────

export const ICON_OPTIONS: { value: string; icon: LucideIcon; label: string }[] = [
  { value: "utensils",        icon: Utensils,      label: "Food"      },
  { value: "coffee",          icon: Coffee,         label: "Drinks"    },
  { value: "zap",             icon: Zap,            label: "Electric"  },
  { value: "flame",           icon: Flame,          label: "Gas"       },
  { value: "droplets",        icon: Droplets,       label: "Water"     },
  { value: "wifi",            icon: Wifi,           label: "Internet"  },
  { value: "truck",           icon: Truck,          label: "Transport" },
  { value: "car",             icon: Car,            label: "Vehicle"   },
  { value: "home",            icon: Home,           label: "Rent"      },
  { value: "building-2",      icon: Building2,      label: "Office"    },
  { value: "wrench",          icon: Wrench,         label: "Repair"    },
  { value: "sparkles",        icon: Sparkles,       label: "Cleaning"  },
  { value: "scissors",        icon: Scissors,       label: "Services"  },
  { value: "package",         icon: Package,        label: "Supplies"  },
  { value: "shopping-cart",   icon: ShoppingCart,   label: "Shopping"  },
  { value: "banknote",        icon: Banknote,       label: "Payment"   },
  { value: "wallet",          icon: Wallet,         label: "Finance"   },
  { value: "megaphone",       icon: Megaphone,      label: "Marketing" },
  { value: "cpu",             icon: Cpu,            label: "Equipment" },
  { value: "clipboard-list",  icon: ClipboardList,  label: "Admin"     },
  { value: "more-horizontal", icon: MoreHorizontal, label: "Other"     },
]

// ── CategoryFormSheet ──────────────────────────────────────────

export function CategoryFormSheet({
  open,
  onOpenChange,
  category,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category?: ExpenseCategory
}) {
  const isMobile = useIsMobile()
  const { t } = useLanguage()
  const isEdit = !!category

  const [name,   setName]   = useState(category?.name   ?? "")
  const [nameAr, setNameAr] = useState(category?.name_ar ?? "")
  const [icon,   setIcon]   = useState(category?.icon   ?? "more-horizontal")
  const [isCogs, setIsCogs] = useState(category?.is_cogs ?? false)

  const create = useCreateExpenseCategory()
  const update = useUpdateExpenseCategory()
  const isPending = create.isPending || update.isPending

  // Sync state when the sheet opens for a different category
  const [lastCategoryId, setLastCategoryId] = useState(category?.id)
  if (category?.id !== lastCategoryId) {
    setLastCategoryId(category?.id)
    setName(category?.name ?? "")
    setNameAr(category?.name_ar ?? "")
    setIcon(category?.icon ?? "more-horizontal")
    setIsCogs(category?.is_cogs ?? false)
  }

  function reset() {
    setName(category?.name ?? "")
    setNameAr(category?.name_ar ?? "")
    setIcon(category?.icon ?? "more-horizontal")
    setIsCogs(category?.is_cogs ?? false)
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { toast.error(t("Name is required")); return }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: category.id, name: trimmed, name_ar: nameAr.trim() || null, icon, is_cogs: isCogs })
        toast.success(t("Category updated"))
      } else {
        await create.mutateAsync({ name: trimmed, name_ar: nameAr.trim() || null, icon, is_cogs: isCogs })
        toast.success(t("Category added"))
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to save"))
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { reset(); onOpenChange(false) } }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-md",
        )}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("Edit Category") : t("New Category")}</SheetTitle>
          <SheetDescription>
            {isEdit ? t("Update category name, icon, or COGS status.") : t("Add a new expense category.")}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col flex-1 overflow-hidden"
          onSubmit={(e) => { e.preventDefault(); handleSave() }}
        >
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Name */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("Name")}</p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cleaning"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t("Arabic Name")}</p>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: تنظيف"
                dir="rtl"
                lang="ar"
              />
            </div>

            <Separator />

            {/* Icon picker */}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("Icon")}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {ICON_OPTIONS.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    onClick={() => setIcon(value)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg border p-2 transition-colors",
                      icon === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent hover:border-border hover:bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[9px] leading-none truncate w-full text-center">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* COGS toggle */}
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Switch
                id="is-cogs"
                checked={isCogs}
                onCheckedChange={setIsCogs}
              />
              <div className="space-y-0.5 leading-none">
                <Label htmlFor="is-cogs" className="text-sm font-medium cursor-pointer">
                  {t("Cost of Goods Sold (COGS)")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("Mark if this category directly affects the cost of producing goods or services")}
                </p>
              </div>
            </div>

          </div>

          <div className="shrink-0 border-t bg-background px-6 py-4 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false) }}
              disabled={isPending}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("Saving…") : isEdit ? t("Save Changes") : t("Add Category")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
