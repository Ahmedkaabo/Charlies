import { Routes, Route } from "react-router-dom"

import { AuthGuard } from "@/components/layout/AuthGuard"
import { AdminGuard } from "@/components/layout/AdminGuard"
import { PermissionGuard } from "@/components/layout/PermissionGuard"
import { AppShell } from "@/components/layout/AppShell"
import { LoginPage } from "@/pages/auth/LoginPage"
import { RegisterPage } from "@/pages/auth/RegisterPage"
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage"
import { OnboardingPage } from "@/pages/auth/OnboardingPage"
import { OrgSetupPage }  from "@/pages/auth/OrgSetupPage"
import { PendingPage }    from "@/pages/auth/PendingPage"
import { InvitePage }         from "@/pages/auth/InvitePage"
import { ChangePasswordPage } from "@/pages/auth/ChangePasswordPage"
import { BranchesListPage } from "@/pages/branches/BranchesListPage"
import { MembersPage } from "@/pages/members/MembersPage"
import { PermissionsPage } from "@/pages/admin/PermissionsPage"
import { CheckInPage } from "@/pages/checkin/CheckInPage"
import { AttendancePage } from "@/pages/attendance/AttendancePage"
import { PayrollPage } from "@/pages/payroll/PayrollPage"
import { OwnersPage } from "@/pages/owners/OwnersPage"
import { ExpensesListPage } from "@/pages/expenses/ExpensesListPage"
import { SalesPage } from "@/pages/sales/SalesPage"
import { FinancePage } from "@/pages/finance/FinancePage"
import { BalancePage } from "@/pages/balance/BalancePage"
import { NotFoundPage } from "@/pages/NotFoundPage"

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <p className="text-muted-foreground text-sm">{title} — coming soon</p>
    </div>
  )
}

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/register"        element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/onboarding"      element={<OnboardingPage />} />
      <Route path="/org-setup"       element={<OrgSetupPage />} />
      <Route path="/pending"         element={<PendingPage />} />
      <Route path="/invite/:token"    element={<InvitePage />} />
      <Route path="/change-password"  element={<ChangePasswordPage />} />

      {/* Protected */}
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Placeholder title="Dashboard" />} />

          <Route element={<PermissionGuard resource="branches" />}>
            <Route path="/branches" element={<BranchesListPage />} />
          </Route>
          <Route element={<PermissionGuard resource="staff" />}>
            <Route path="/staff" element={<MembersPage />} />
          </Route>
          <Route element={<PermissionGuard resource="checkin" />}>
            <Route path="/checkin" element={<CheckInPage />} />
          </Route>
          <Route element={<PermissionGuard resource="attendance" />}>
            <Route path="/attendance" element={<AttendancePage />} />
          </Route>
          <Route element={<PermissionGuard resource="payroll" />}>
            <Route path="/payroll" element={<PayrollPage />} />
          </Route>
          <Route element={<PermissionGuard resource="expenses" />}>
            <Route path="/expenses" element={<ExpensesListPage />} />
          </Route>
          <Route element={<PermissionGuard resource="sales" />}>
            <Route path="/sales" element={<SalesPage />} />
          </Route>
          <Route element={<PermissionGuard resource="finance" />}>
            <Route path="/finance" element={<FinancePage />} />
          </Route>
          <Route element={<PermissionGuard resource="balance" />}>
            <Route path="/balance" element={<BalancePage />} />
          </Route>
          <Route element={<PermissionGuard resource="settings" />}>
            <Route path="/settings" element={<Placeholder title="Settings" />} />
          </Route>
          <Route element={<PermissionGuard resource="permissions" />}>
            <Route path="/permissions" element={<PermissionsPage />} />
          </Route>

          <Route element={<AdminGuard />}>
            <Route path="/users"  element={<OwnersPage />} />
            <Route path="/admin"  element={<Placeholder title="Admin Panel" />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
