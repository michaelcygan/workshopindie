# Clarify creator rights on Work publish

Add short, reassuring copy to the Work publish flow so creators understand they keep ownership and Workshop only receives a limited, revocable display license.

## Scope
- Only the publish page (`/works/new`, `src/routes/works.new.tsx`).
- No legal documents or policy changes; just concise UI text.

## Changes

1. **Rights note at the top**
   - Insert a compact reassurance block directly under the page header, before the form.
   - Text: "You keep all rights to your work. Posting grants Workshop a license to display it on the platform and our social channels, as-is. That license ends when you delete the media from Workshop."

2. **Rights reminder near the submit button**
   - Add a one-line note inside the sticky publish bar, just before the action buttons.
   - Same concise message, or a shorter variant such as: "You keep your rights — this only grants Workshop a license to display it."

3. **Ownership checkbox copy**
   - Keep the existing checkbox, but update its helper text to reference rights explicitly:
   - "You keep all rights; publishing only grants Workshop a display license."
   - Keep the existing "fine-tune rights and add downloads later" fallback so it doesn't sound like a legal contract.

## Design approach
- Use a soft callout style (`rounded-2xl border border-border bg-surface p-4`) to match the existing ownership card.
- Keep the sticky publish bar layout intact; add the note as a wrapped flex item that appears before the buttons.
- Ensure mobile doesn't break the sticky bar: text should wrap or sit above buttons on narrow screens.
