import { useState, useRef } from "react"
import { toast } from "sonner"
import { useMyAttendance, useMyBranch } from "@/hooks/useAttendance"
import { useCheckIn, useCheckOut } from "@/hooks/useAttendanceMutations"
import {
  calculateDistance,
  calculateDayValue,
  calculateLateDeductedHours,
  findMatchingShift,
  isWithinCheckInWindow,
} from "@/lib/attendance"
import { todayString, getGeoPosition, uploadSelfie } from "./helpers"
import type { FlowMode, FlowStep } from "./types"

export function useCheckInFlow(profileId: string | undefined) {
  const { data: branch, isLoading: branchLoading } = useMyBranch(profileId)
  const { data: attendance, isLoading: attendanceLoading } = useMyAttendance(profileId)

  const checkInMut = useCheckIn()
  const checkOutMut = useCheckOut()

  const [mode, setMode] = useState<FlowMode>("checkin")
  const [step, setStep] = useState<FlowStep>("idle")
  const [locationError, setLocationError] = useState("")
  const [locationPending, setLocationPending] = useState(false)
  const [position, setPosition] = useState<GeolocationPosition | null>(null)
  const [distanceM, setDistanceM] = useState(0)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const today = todayString()
  const todayLog = attendance?.todayLog ?? null
  const history = attendance?.history?.filter((h) => h.date !== today) ?? []

  const checkedIn = !!todayLog?.check_in_at
  const checkedOut = !!todayLog?.check_out_at

  const activeShifts = branch?.shifts?.filter((s) => s.is_active) ?? []
  const hasConfiguredShifts = activeShifts.length > 0

  const legacyStartTime = branch?.check_in_time
  const legacyWindowMins = 15

  function getActiveShift(now: Date) {
    return findMatchingShift(now, activeShifts)
  }

  function getWithinWindow(now: Date) {
    return hasConfiguredShifts
      ? findMatchingShift(now, activeShifts) !== null
      : !legacyStartTime || isWithinCheckInWindow(now, legacyStartTime, legacyWindowMins)
  }

  function resetFlow() {
    setStep("idle")
    setLocationError("")
    setLocationPending(false)
    setPosition(null)
    setDistanceM(0)
    setSelfieFile(null)
    setSelfiePreview("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function detectLocation() {
    setLocationPending(true)
    setLocationError("")
    try {
      const pos = await getGeoPosition()
      if (branch?.latitude != null && branch?.longitude != null) {
        const dist = calculateDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          branch.latitude,
          branch.longitude
        )
        const rounded = Math.round(dist)
        setDistanceM(rounded)
        if (dist > branch.location_radius_meters) {
          setLocationError(
            `You are ${rounded} m away from the branch. Check-in requires being within ${branch.location_radius_meters} m.`
          )
          return
        }
      }
      setPosition(pos)
    } catch {
      setLocationError("Could not get your location. Enable location access and try again.")
    } finally {
      setLocationPending(false)
    }
  }

  function startFlow(m: FlowMode) {
    setMode(m)
    setStep("selfie")
    setLocationError("")
    setPosition(null)
    setDistanceM(0)
    void detectLocation()
  }

  function handleSelfieCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || step === "idle") return
    setSelfieFile(file)
    setSelfiePreview(URL.createObjectURL(file))
    setStep("reviewing")
  }

  async function handleConfirm(now: Date) {
    if (!profileId || !branch || !position) return
    setStep("submitting")

    // Snapshot the real time at confirm — not the stale render clock
    const realNow = new Date()

    try {
      let selfieUrl: string | null = null
      if (selfieFile) {
        selfieUrl = await uploadSelfie(selfieFile, profileId, mode === "checkin" ? "checkin" : "checkout")
      }

      const activeShift = findMatchingShift(now, activeShifts)

      if (mode === "checkin") {
        let isLate = false
        let lateMinutes = 0
        const startTime = activeShift?.shift_start ?? legacyStartTime
        if (startTime) {
          const [h, m] = startTime.split(":").map(Number)
          const shiftStart = new Date(realNow)
          shiftStart.setHours(h, m, 0, 0)
          const diffMs = realNow.getTime() - shiftStart.getTime()
          if (diffMs > 0) {
            lateMinutes = Math.floor(diffMs / 60_000)
            isLate = lateMinutes > (activeShift?.late_grace_minutes ?? 0)
          }
        }

        await checkInMut.mutateAsync({
          branch_id: branch.id,
          profile_id: profileId,
          date: today,
          check_in_at: realNow.toISOString(),
          check_in_latitude: position.coords.latitude,
          check_in_longitude: position.coords.longitude,
          check_in_distance_meters: distanceM,
          selfie_url: selfieUrl,
          is_late: isLate,
          late_minutes: lateMinutes,
          status: isLate ? "late" : "present",
          shift_id: activeShift?.id ?? null,
        })
        toast.success("Checked in!")
      } else {
        if (!todayLog?.id || !todayLog.check_in_at) return

        const totalHours =
          (realNow.getTime() - new Date(todayLog.check_in_at).getTime()) / 3_600_000

        // Use the shift recorded at check-in — never the current window
        const logShift = todayLog.shift_id
          ? (branch.shifts.find((s) => s.id === todayLog.shift_id) ?? null)
          : null

        const fullDayHours = logShift?.full_day_hours ?? branch.min_shift_hours ?? 8
        const overtimeHours = logShift?.overtime_hours ?? branch.max_shift_hours ?? 12

        const baseDayValue = calculateDayValue(totalHours, {
          fullDay: fullDayHours,
          overtime: overtimeHours,
        })

        const deductedHours = calculateLateDeductedHours(todayLog.late_minutes ?? 0, logShift)
        const deductedDays = fullDayHours > 0 ? deductedHours / fullDayHours : 0
        const finalDayValue = Math.max(0, Math.round((baseDayValue - deductedDays) * 100) / 100)

        await checkOutMut.mutateAsync({
          logId: todayLog.id,
          data: {
            check_out_at: realNow.toISOString(),
            check_out_latitude: position.coords.latitude,
            check_out_longitude: position.coords.longitude,
            check_out_distance_meters: distanceM,
            total_hours: Math.round(totalHours * 100) / 100,
            day_value: finalDayValue,
          },
        })
        toast.success("Checked out!")
      }

      resetFlow()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      resetFlow()
    }
  }

  return {
    // Remote data
    branch,
    todayLog,
    history,
    branchLoading,
    attendanceLoading,
    // Derived state
    checkedIn,
    checkedOut,
    legacyStartTime,
    legacyWindowMins,
    getActiveShift,
    getWithinWindow,
    // Flow state
    mode,
    step,
    locationError,
    locationPending,
    distanceM,
    selfiePreview,
    fileInputRef,
    // Actions
    startFlow,
    resetFlow,
    handleSelfieCapture,
    handleConfirm,
  }
}
