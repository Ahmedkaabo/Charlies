import { useNavigate, useParams, Link } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"

import { useGetBranch, useUpdateBranch } from "@/hooks/useBranches"
import { Skeleton } from "@/components/ui/skeleton"
import { BranchForm } from "./BranchForm"
import type { BranchFormValues } from "./BranchForm"
import { useLanguage } from "@/contexts/LanguageContext"

export function EditBranchPage() {
  const { t } = useLanguage()
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: branch, isLoading, isError } = useGetBranch(id)
  const updateBranch = useUpdateBranch(id)

  async function handleSubmit(values: BranchFormValues) {
    try {
      await updateBranch.mutateAsync(values)
      toast.success(t("Branch updated!"))
      navigate(`/branches/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Failed to update branch"))
      throw err
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl space-y-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !branch) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-destructive">{t("Branch not found.")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b px-6 py-4">
        <Link
          to={`/branches/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {branch.name}
        </Link>
        <h1 className="text-xl font-semibold">{t("Edit Branch")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{branch.name}</p>
      </div>

      <div className="flex-1 overflow-hidden max-w-2xl w-full">
        <BranchForm
          defaultValues={{
            name: branch.name,
            name_ar: branch.name_ar ?? "",
            address: branch.address ?? "",
            city: branch.city ?? "",
            phone: branch.phone ?? "",
            is_active: branch.is_active,
            latitude: branch.latitude,
            longitude: branch.longitude,
            location_radius_meters: branch.location_radius_meters,
          }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/branches/${id}`)}
          submitLabel={t("Save Changes")}
        />
      </div>
    </div>
  )
}
