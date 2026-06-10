"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { ChevronsUpDown } from "lucide-react"
import {
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxSeparator,
} from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "All",
  className,
}: MultiSelectProps) {
  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`

  return (
    <ComboboxPrimitive.Root multiple value={selected} onValueChange={onChange} filter={() => true}>
      <ComboboxPrimitive.Trigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("justify-between font-normal", className)}
          />
        }
      >
        <span className={cn("truncate capitalize", selected.length === 0 && "text-muted-foreground")}>
          {triggerLabel}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent>
        <ComboboxList>
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No options available</p>
          )}
          {options.map((opt) => (
            <ComboboxItem key={opt.value} value={opt.value} className="capitalize">
              {opt.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
        {selected.length > 0 && (
          <>
            <ComboboxSeparator />
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted text-left"
            >
              Clear selection
            </button>
          </>
        )}
      </ComboboxContent>
    </ComboboxPrimitive.Root>
  )
}
