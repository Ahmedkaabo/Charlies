import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  className?: string
}

// Points forward in reading direction: → in LTR, ← in RTL
export function ChevronForward({ className }: Props) {
  return <ChevronRight className={cn("rtl:rotate-180", className)} />
}

// Points backward in reading direction: ← in LTR, → in RTL
export function ChevronBack({ className }: Props) {
  return <ChevronLeft className={cn("rtl:rotate-180", className)} />
}
