import { useAuth } from "@/hooks/useAuth"
import { StaffCheckInView } from "@/components/attendance/StaffCheckIn"

export function CheckInPage() {
  const { profile } = useAuth()
  return (
    <StaffCheckInView profileId={profile?.id} />
  )
}
