import { useNavigate } from "react-router-dom"
import { Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/LanguageContext"

export function NotFoundPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-7xl font-bold text-muted-foreground/30">404</p>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("Page not found")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("The page you're looking for doesn't exist.")}
        </p>
      </div>
      <Button onClick={() => navigate("/", { replace: true })}>
        <Home className="h-4 w-4" />
        {t("Back to Home")}
      </Button>
    </div>
  )
}
