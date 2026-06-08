// Re-exports the shared auth context so callers keep the same import path.
// State is managed once in <AuthProvider> (main.tsx) and shared across all consumers.
export type { Profile, SystemRole } from "@/contexts/AuthContext"
export { useAuthContext as useAuth } from "@/contexts/AuthContext"
