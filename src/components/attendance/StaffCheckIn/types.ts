export type FlowMode = "checkin" | "checkout"

export type FlowStep =
  | "idle"
  | "locating"
  | "location_error"
  | "selfie"
  | "reviewing"
  | "submitting"

export type ShiftStatus = "open" | "upcoming" | "in_progress" | "ended" | "inactive"
