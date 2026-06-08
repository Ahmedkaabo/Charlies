# CHARLIES — Design Reference

> Read this at the start of every session before writing any UI code.

---

## Stack

Vite + React + TypeScript + **shadcn/ui (radix-nova style)** + Supabase + React Query.
Layout follows the **dashboard-01** block pattern: `SidebarProvider → CharSidebar + SidebarInset → header → content`.

---

## 1. Tokens & Theme

- **Only shadcn CSS variables.** Never hardcode colors (`#F59E0B`, `stone-900`, etc.).
- Use `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`, etc.
- Dark mode is handled automatically through the existing CSS variables.
- Font families come from the theme — do not add `font-` utility classes unless changing heading vs body.

---

## 2. Buttons

- **Always `size="default"`** — no `size="sm"`, no `size="lg"`.
- Exception: icon-only buttons use `size="icon"`.
- Never add a size prop if it would be `"default"` — omit it entirely.
- Use `variant="outline"` for secondary actions, `variant="ghost"` for icon-only nav actions, default variant for primary.

```tsx
// ✅ correct
<Button onClick={...}>Add Branch</Button>
<Button variant="outline" onClick={...}>Cancel</Button>
<Button size="icon" variant="ghost"><ChevronLeft /></Button>

// ❌ wrong
<Button size="sm" onClick={...}>Add Branch</Button>
<Button size="lg" onClick={...}>Save</Button>
```

---

## 3. Sheets (Drawers)

Viewing, creating, and editing records **always opens in a Sheet**, never navigates to a separate page.

### Sizing & side
- Desktop: `side="right"`, `sm:max-w-2xl`
- Mobile: `side="bottom"`, `h-[90svh] rounded-t-2xl`
- Use `useIsMobile()` to switch dynamically.

```tsx
const isMobile = useIsMobile()

<Sheet open={...} onOpenChange={...}>
  <SheetContent
    side={isMobile ? "bottom" : "right"}
    className={cn(
      "flex flex-col gap-0 overflow-hidden p-0",
      isMobile ? "h-[90svh] rounded-t-2xl" : "w-full sm:max-w-2xl"
    )}
  >
```

### Internal layout
Sheet content is always `flex flex-col` with three zones:

```
┌─ SheetHeader ──────────────────────┐  shrink-0, border-b, px-6 py-4
│ Title + subtitle/badges + actions  │
├─ Scrollable content ───────────────┤  flex-1 overflow-y-auto px-6 py-5
│ Form fields / detail panels / tabs │
├─ Sticky footer ────────────────────┤  shrink-0, border-t, bg-background, px-6 py-4
│ Cancel          Save               │
└────────────────────────────────────┘
```

- Action buttons (Cancel / Save) live in the **sticky footer**, never inside the scrollable area.
- The form's `<form>` element is `flex flex-col flex-1 overflow-hidden` so it fills the sheet and owns the scroll + footer.

### State machine for CRUD sheets
Use a discriminated union to drive a single `<Sheet>` from the list page:

```ts
type DrawerState =
  | { type: "none" }
  | { type: "create" }
  | { type: "view"; entityId: string }
  | { type: "edit"; entityId: string }
```

Navigating view → edit keeps the sheet open and swaps content. Saving from edit navigates back to view (not closes). This avoids sheet flicker.

---

## 4. Forms

### Schema
- Use plain `z.string()`, `z.number()`, `z.boolean()` — **no `z.preprocess`, no `z.coerce`, no `.default()`** on fields.
- `.default()` and `z.preprocess`/`z.coerce` create an input/output type split that breaks `useForm<T>` with `zodResolver`.
- Provide all defaults in `useForm({ defaultValues: { ... } })` instead.
- Handle string-to-number conversion in the input's `onChange`:
  ```tsx
  onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
  ```

### Section headers
Every form section looks identical:
```tsx
<div>
  <h3 className="text-sm font-semibold">Section Title</h3>
  <p className="text-xs text-muted-foreground mt-0.5">
    One-line description of what this section covers
  </p>
</div>
```

### Separators
- **One `<Separator />`** between sections, not after each section header.
- Never put a separator immediately under a title/description.

```
Section A header + desc
[fields]
──── <Separator /> ────
Section B header + desc
[fields]
```

### Toggle / Switch placement
- Switch goes **left of its label**, not right.
- Use `flex-row items-start gap-3` on the `FormItem` (overrides the default `flex-col`).

```tsx
<FormItem className="flex-row items-start gap-3 rounded-lg border p-4">
  <FormControl>
    <Switch checked={field.value} onCheckedChange={field.onChange} />
  </FormControl>
  <div className="space-y-0.5 leading-none">
    <FormLabel>Active</FormLabel>
    <FormDescription>Branch is open and staff can check in</FormDescription>
  </div>
</FormItem>
```

---

## 5. Lists & Empty States

- The **header action button** and the **empty state button** must have the same label, same variant, same size.
- Empty state structure: icon in muted circle → heading → subtext → action button.

```tsx
// Header
<Button onClick={openCreate}>
  <Plus className="h-4 w-4" />
  Add Branch
</Button>

// Empty state — identical label and no size prop
<Button onClick={onAdd}>
  <Plus className="h-4 w-4" />
  Add Branch
</Button>
```

---

## 6. Navigation & Routing

- **Primary navigation**: `CharSidebar` (desktop) + `BottomNav` (mobile, 5 tabs).
- **Admin-only links** (`/admin`): filtered in the sidebar via `isAdmin`, never in BottomNav.
- **CRUD flows**: open in a Sheet drawer from the list page. Do not create separate routes for `/entity/new`, `/entity/:id`, `/entity/:id/edit`.
- Only register one route per resource: `/branches`, `/staff`, `/expenses`, etc.

---

## 7. Cards (List items)

- Use shadcn `Card` with `transition-shadow group-hover:shadow-md`.
- Wrap in a `<button>` (not `<Link>`) when the click opens a Sheet.
- Status badges: `variant="default"` for active, `variant="secondary"` for inactive.

---

## 8. Loading & Error States

- **Loading**: shadcn `Skeleton` components matching the shape of the real content.
- **Error**: `border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive` rounded card.
- **Empty**: icon + heading + subtext + primary action button (see §5).

---

## 9. Auth & Role Guards

- `<AuthGuard>` — redirects to `/login` if not authenticated. Also waits for profile to load.
- `<RoleGuard allowedRoles={[...]} >` — bypassed entirely for `isAdmin`.
- `<AdminGuard>` — wraps admin-only routes; redirects with a toast on access denied.
- `useAuth()` exposes: `user`, `session`, `profile`, `systemRole`, `isAdmin`, `loading`, `signIn`, `signUp`, `signOut`, `resetPassword`.

---

## 10. Icons

Always use **lucide-react**. Size: `h-4 w-4` for inline icons, `h-5 w-5` for nav icons, `h-3.5 w-3.5` for small inline context icons.

---

## 11. Spacing & Padding

- Page content: `p-4 md:p-6`
- Sheet header: `px-6 py-4`
- Sheet scrollable content: `px-6 py-5`
- Sheet footer: `px-6 py-4`
- Form sections: `space-y-4` within, `space-y-6` between
- Card padding via shadcn `CardContent` and `CardHeader` defaults

---

## 12. Key File Locations

| What | Where |
|---|---|
| Nav config (all routes + icons) | `src/lib/nav.ts` |
| Auth context + hook | `src/contexts/AuthContext.tsx` → `src/hooks/useAuth.ts` |
| App shell layout | `src/components/layout/AppShell.tsx` |
| Sidebar (shadcn primitives) | `src/components/layout/Sidebar.tsx` |
| Mobile bottom nav | `src/components/layout/BottomNav.tsx` |
| Auth guards | `src/components/layout/AuthGuard.tsx`, `AdminGuard.tsx` |
| Supabase client | `src/lib/supabase.ts` |
| React Query client | `src/lib/queryClient.ts` |
| Global types | `src/types/` |
| Custom hooks | `src/hooks/` |
| DB migrations | `supabase/migrations/` |
| Seed data | `supabase/seed.sql` |
