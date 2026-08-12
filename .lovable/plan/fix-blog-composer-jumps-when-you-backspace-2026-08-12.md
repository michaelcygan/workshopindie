# Fix: blog composer jumps when you backspace

## What's happening

The body editor is a stack of auto-growing textareas. Every time the text changes, the code resets the textarea's height to `auto` (collapsing it to one line for a split second) and then re-sets it to the measured content height.

That momentary collapse shrinks the whole page. The browser clamps the scroll position to the now-shorter document, and when the textarea grows back the original scroll position is gone — so the view lands somewhere else, usually at the bottom of the composer. Backspacing triggers it on every keystroke, which is why it feels constant.

## The fix

1. **Measure without collapsing the visible field.** Use a hidden mirror element (or `scrollHeight` read against a cloned/offscreen measurement) so the on-screen textarea never briefly drops to one line. Height is applied in a single write, so document height only changes when the text genuinely wraps to a new line.
2. **Preserve scroll defensively.** Around the height write, capture `window.scrollY` (and the nearest scrollable ancestor's `scrollTop`) and restore it synchronously in the same layout pass if it changed. This guarantees no jump even when the document does legitimately shrink by a line.
3. **Only write the height when it actually differs** from the current value, so most keystrokes cause no layout write at all.
4. **Keep the caret in view only on real overflow** — no `scrollIntoView` calls on typing; the page moves only when the user scrolls.

## Verification

- Type and hold backspace mid-post in a long draft: the page should not move.
- Deleting enough text to remove a wrapped line should shrink the field smoothly without the viewport shifting.
- Check both desktop and mobile widths, with and without image/embed blocks between text segments.

## Technical notes

Single file: `src/components/blog-body-editor.tsx`, the `AutoTextarea` component's `useLayoutEffect`. No changes to parsing, serialization, or saved content.
