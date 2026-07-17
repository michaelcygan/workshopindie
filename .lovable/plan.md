## Two mobile fixes

### 1) Persistent "Workshop" brand header on mobile
Today `TopNav` is `hidden md:block`, so on mobile there's no visible "Workshop" wordmark anywhere (only the bottom `MobileNav` with icon tabs).

**Add** a slim mobile-only top header rendered from `src/routes/__root.tsx` just above `<Outlet />`, `md:hidden`, sticky at top:
- Left: gradient dot + `Workshop` wordmark, links to `/`.
- Right: existing `NotificationsBell` + `MessagesInboxButton` (compact, reused from TopNav) so the row is functional, not just decorative.
- Height ~44px, `bg-background/80 backdrop-blur border-b border-border/70`, matching the desktop header aesthetic.

New file: `src/components/mobile-brand-header.tsx`. Mount it in `__root.tsx` between `<PaymentTestModeBanner />` and `<TopNav />`. Adjust body top padding only if content is currently clipped — the sticky header sits above scroll flow so no page changes are needed.

### 2) Small "Back to profile" affordance at the bottom of the collab page (mobile)
**File:** `src/routes/collab.$slug.tsx`

Just after the roles/description section, before `</main>` (~line 700), render a small mobile-only link:

```tsx
{hostUser?.username && (
  <div className="mt-10 md:hidden">
    <Link
      to="/u/$username"
      params={{ username: hostUser.username }}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-2 hover:text-ink transition"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to {hostUser.display_name || hostUser.username}'s profile
    </Link>
  </div>
)}
```

Add `ArrowLeft` to the existing `lucide-react` import.

Desktop is unchanged (the host card up top already serves as the back path).

## Scope
- New file: `src/components/mobile-brand-header.tsx`
- Edit: `src/routes/__root.tsx` (mount the header)
- Edit: `src/routes/collab.$slug.tsx` (bottom back link + import)
- No schema, no server functions, no desktop changes.
