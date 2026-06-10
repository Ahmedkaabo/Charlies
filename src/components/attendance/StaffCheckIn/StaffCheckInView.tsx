import { useState, useEffect } from "react"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  LogIn,
  LogOut,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { formatShiftTime } from "@/lib/attendance"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { useCheckInFlow } from "./useCheckInFlow"
import { ShiftsPanel } from "./ShiftsPanel"
import { statusVariant, statusLabel } from "./helpers"

export function StaffCheckInView({ profileId }: { profileId: string | undefined }) {
  const { profile } = useAuth()

  const {
    branch,
    todayLog,
    history,
    branchLoading,
    attendanceLoading,
    checkedIn,
    checkedOut,
    legacyStartTime,
    legacyWindowMins,
    getActiveShift,
    getWithinWindow,
    mode,
    step,
    locationError,
    locationPending,
    distanceM,
    selfiePreview,
    fileInputRef,
    startFlow,
    resetFlow,
    handleSelfieCapture,
    handleConfirm,
  } = useCheckInFlow(profileId)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  const firstName = profile?.full_name?.split(" ")[0] ?? "there"
  const activeShift = getActiveShift(now)
  const withinWindow = getWithinWindow(now)
  const shiftStartTime = activeShift?.shift_start ?? legacyStartTime
  const windowMins = activeShift?.checkin_window_minutes ?? legacyWindowMins

  const durationMinutes =
    checkedIn && todayLog?.check_in_at
      ? Math.floor((now.getTime() - new Date(todayLog.check_in_at).getTime()) / 60_000)
      : 0

  if (branchLoading || attendanceLoading) {
    return (
      <div className="p-4 md:p-6 md:max-w-lg md:mx-auto space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-12 w-32 mt-2" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 md:max-w-lg md:mx-auto space-y-5">

      {/* Greeting + clock */}
      <div className="space-y-3 pt-1">
        <div>
          <h1 className="text-2xl font-semibold">Hey {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(now, "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold tabular-nums tracking-tight">
            {format(now, "h:mm")}
          </span>
          <span className="text-2xl font-medium text-muted-foreground">
            {format(now, "a")}
          </span>
        </div>
      </div>

      {/* Shifts panel */}
      {branch && <ShiftsPanel branch={branch} now={now} />}

      {/* Hidden camera input — always mounted so buttons can trigger it directly */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleSelfieCapture}
      />


      {/* Flow: Locating */}
      {step === "locating" && (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <MapPin className="h-8 w-8 animate-pulse text-primary" />
            <p className="text-sm text-muted-foreground">Verifying your location…</p>
          </CardContent>
        </Card>
      )}

      {/* Flow: Location error */}
      {step === "location_error" && (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{locationError}</p>
            <Button variant="outline" onClick={resetFlow}>Try Again</Button>
          </CardContent>
        </Card>
      )}

      {/* Flow: Reviewing */}
      {step === "reviewing" && (
        <Card className="py-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Confirm {mode === "checkin" ? "Check In" : "Check Out"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selfiePreview && (
              <img
                src={selfiePreview}
                alt="Selfie preview"
                className="h-32 w-32 rounded-lg border object-cover"
              />
            )}
            <div className="space-y-1.5 text-sm">
              {locationPending ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 animate-pulse" />
                  Verifying location…
                </p>
              ) : locationError ? (
                <p className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {locationError}
                </p>
              ) : (
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Location verified ({distanceM} m from branch)
                </p>
              )}
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {format(now, "h:mm a")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetFlow}>Cancel</Button>
              <Button
                onClick={() => handleConfirm(now)}
                disabled={locationPending || !!locationError}
              >
                Confirm {mode === "checkin" ? "Check In" : "Check Out"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flow: Submitting */}
      {step === "submitting" && (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Saving…</p>
          </CardContent>
        </Card>
      )}

      {/* Idle: action cards */}
      {step === "idle" && (
        <>
          {/* Not checked in */}
          {!checkedIn && (
            <Card className="py-0">
              <CardContent className="flex flex-col items-center gap-5 py-8 text-center">
                <div className={cn(
                  "rounded-full p-4",
                  withinWindow ? "bg-primary/10" : "bg-muted"
                )}>
                  {withinWindow
                    ? <LogIn className="h-7 w-7 text-primary" />
                    : <Clock className="h-7 w-7 text-muted-foreground" />
                  }
                </div>
                <div>
                  <p className="font-semibold">
                    {withinWindow
                      ? activeShift
                        ? `Ready for ${activeShift.name}?`
                        : "Ready to start your shift?"
                      : "No open check-in window"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {withinWindow
                      ? "Your location and photo will be verified"
                      : shiftStartTime
                      ? `Next window opens at ${formatShiftTime(shiftStartTime)} (±${windowMins} min)`
                      : "Check the shifts above for today's schedule"}
                  </p>
                </div>
                <Button
                  onClick={() => void startFlow("checkin")}
                  disabled={!withinWindow}
                  className="w-full"
                >
                  Check In
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Checked in, working */}
          {checkedIn && !checkedOut && todayLog && (
            <Card className="py-0">
              <CardContent className="flex flex-col items-center gap-5 py-8 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Clock className="h-7 w-7 text-primary" />
                </div>
                <div>
                  {(() => {
                    const logShift = branch?.shifts?.find((s) => s.id === todayLog.shift_id)
                    return logShift ? (
                      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                        {logShift.name}
                      </p>
                    ) : null
                  })()}
                  <p className="text-4xl font-bold tabular-nums tracking-tight">
                    {Math.floor(durationMinutes / 60)}h {String(durationMinutes % 60).padStart(2, "0")}m
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Checked in at {format(parseISO(todayLog.check_in_at!), "h:mm a")}
                    {todayLog.is_late && (
                      <span className="ml-1.5 text-amber-600 dark:text-amber-400">
                        · Late by {todayLog.late_minutes} min
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  onClick={() => void startFlow("checkout")}
                  className="w-full"
                >
                  <LogOut className="h-4 w-4" />
                  Check Out
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Shift complete */}
          {checkedIn && checkedOut && todayLog && (
            <Card className="py-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Shift complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Check In</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                      {format(parseISO(todayLog.check_in_at!), "h:mm a")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Check Out</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                      {format(parseISO(todayLog.check_out_at!), "h:mm a")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Hours Worked</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                      {todayLog.total_hours?.toFixed(1) ?? "—"} hrs
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Day Value</p>
                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                      {todayLog.day_value?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                </div>
                <Badge variant={statusVariant(todayLog.status)}>
                  {statusLabel(todayLog.status)}
                </Badge>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* History (last 14 days) */}
      {history.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">Last 14 days</h2>
          </div>
          <div className="space-y-2">
            {history.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {format(parseISO(log.date), "EEE, d MMM")}
                  </p>
                  {log.check_in_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(log.check_in_at), "h:mm a")}
                      {log.check_out_at &&
                        ` – ${format(parseISO(log.check_out_at), "h:mm a")}`}
                      {log.total_hours != null &&
                        ` · ${log.total_hours.toFixed(1)} h`}
                    </p>
                  )}
                </div>
                <Badge variant={statusVariant(log.status)}>
                  {statusLabel(log.status)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
