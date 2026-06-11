export type Language = "en" | "ar"

type Translations = Record<string, string>

const en: Translations = {
  // Nav groups
  "Accounting": "Accounting",
  "HR": "HR",
  "Settings": "Settings",
  // Nav items / route titles
  "Dashboard": "Dashboard",
  "Staff": "Staff",
  "Check-in": "Check-in",
  "Attendance": "Attendance",
  "Payroll": "Payroll",
  "Sales": "Sales",
  "Expenses": "Expenses",
  "Balance": "Balance",
  "Payout": "Payout",
  "Branches": "Branches",
  "Owners": "Owners",
  "Categories": "Categories",
  "Suppliers": "Suppliers",
  "Permissions": "Permissions",
  "Expense Categories": "Expense Categories",
  "Roles & Permissions": "Roles & Permissions",
  "Admin Panel": "Admin Panel",
  // Profile menu
  "Account": "Account",
  "Billing": "Billing",
  "Notifications": "Notifications",
  "Sign out": "Sign out",
  "Log out": "Log out",
  "Invite": "Invite",
  "Generating…": "Generating…",
  "Dark mode": "Dark mode",
  "Light mode": "Light mode",
  "Language": "Language",
  "Admin": "Admin",
  "Branch Owner": "Branch Owner",
  "More": "More",
  // Profile sheet (mobile)
  "Profile": "Profile",
  // Dialogs
  "Cancel": "Cancel",
  "Are you sure you want to sign out of CHARLIES?": "Are you sure you want to sign out of CHARLIES?",
  // Toasts
  "No account found": "No account found",
  "Failed to generate invite link": "Failed to generate invite link",
  "Invite link copied!": "Invite link copied!",
  "Invite link copied to clipboard!": "Invite link copied to clipboard!",
  "Signed out": "Signed out",
}

const ar: Translations = {
  // Nav groups
  "Accounting": "المحاسبة",
  "HR": "الموارد البشرية",
  "Settings": "الإعدادات",
  // Nav items / route titles
  "Dashboard": "الرئيسية",
  "Staff": "الموظفين",
  "Check-in": "تسجيل الحضور",
  "Attendance": "الحضور",
  "Payroll": "المرتبات",
  "Sales": "المبيعات",
  "Expenses": "المصروفات",
  "Balance": "الرصيد",
  "Payout": "صرف المبالغ",
  "Branches": "الفروع",
  "Owners": "الملاك",
  "Categories": "التصنيفات",
  "Suppliers": "الموردين",
  "Permissions": "الصلاحيات",
  "Expense Categories": "تصنيفات المصروفات",
  "Roles & Permissions": "الأدوار والصلاحيات",
  "Admin Panel": "لوحة الإدارة",
  // Profile menu
  "Account": "الحساب",
  "Billing": "الفواتير",
  "Notifications": "الإشعارات",
  "Sign out": "خروج",
  "Log out": "خروج",
  "Invite": "دعوة",
  "Generating…": "جاري...",
  "Dark mode": "الوضع الداكن",
  "Light mode": "الوضع الفاتح",
  "Language": "اللغة",
  "Admin": "مدير",
  "Branch Owner": "صاحب فرع",
  "More": "المزيد",
  // Profile sheet (mobile)
  "Profile": "الملف الشخصي",
  // Dialogs
  "Cancel": "إلغاء",
  "Are you sure you want to sign out of CHARLIES?": "إنت متأكد إنك عايز تخرج من تشارليز؟",
  // Toasts
  "No account found": "مفيش حساب",
  "Failed to generate invite link": "حصلت مشكلة في إنشاء رابط الدعوة",
  "Invite link copied!": "اتنسخ رابط الدعوة!",
  "Invite link copied to clipboard!": "اتنسخ رابط الدعوة!",
  "Signed out": "تم تسجيل الخروج",
}

export const translations: Record<Language, Translations> = { en, ar }
