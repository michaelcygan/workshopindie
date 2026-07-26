In `src/components/settings-menu-button.tsx`, change only the logged-out trigger (the `if (!user)` branch, lines 28–59):

- Import `Menu` from `lucide-react`.
- Replace `<SettingsIcon className="h-4 w-4" />` inside the logged-out `DropdownMenuTrigger` with `<Menu className="h-4 w-4" />`.
- Keep `aria-label="Menu"` and all existing styling/dropdown items unchanged.

Logged-in trigger keeps the gear icon as-is (settings still relevant there).