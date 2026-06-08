import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months:        "flex flex-col sm:flex-row gap-4",
        month:         "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium",
        nav:           "flex items-center gap-1",
        button_previous: cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium",
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          "absolute left-1"
        ),
        button_next: cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium",
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          "absolute right-1"
        ),
        month_grid:  "w-full border-collapse",
        weekdays:    "flex",
        weekday:     "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
        week:        "flex w-full mt-2",
        day:         "relative p-0 text-center text-sm",
        day_button: cn(
          "inline-flex items-center justify-center rounded-md text-sm",
          "h-9 w-9 p-0 font-normal",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50"
        ),
        range_start: "day-range-start",
        range_end:   "day-range-end",
        selected:    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today:       "bg-accent text-accent-foreground",
        outside:     "text-muted-foreground opacity-50",
        disabled:    "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden:      "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left"
            ? <ChevronLeft className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
