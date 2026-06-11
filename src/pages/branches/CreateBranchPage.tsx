import { useNavigate, Link } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/useAuth"
import { useCreateBranch } from "@/hooks/useBranches"
import { BranchForm } from "./BranchForm"
import type { BranchFormValues } from "./BranchForm"
import { useLanguage } from "@/contexts/LanguageContext"

export function CreateBranchPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const createBranch = useCreateBranch()
  const { t } = useLanguage()

  async function handleSubmit(values: BranchFormValues) {
    if (!user) return
    try {
      const branch = await createBranch.mutateAsync({ ...values, owner_id: user.id })
      toast.success(t("Branch created! Now add a shift."))
      navigate(`/branches/${branch.id}?tab=shifts`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to create branch"))
      throw err
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b px-6 py-4">
        <Link
          to="/branches"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {t("Branches")}
        </Link>
        <h1 className="text-xl font-semibold">{t("New Branch")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("Add a new location to your network")}
        </p>
      </div>

      <div className="flex-1 overflow-hidden max-w-2xl w-full">
        <BranchForm
          onSubmit={handleSubmit}
          onCancel={() => navigate("/branches")}
          submitLabel={t("Create Branch")}
        />
      </div>
    </div>
  )
}
