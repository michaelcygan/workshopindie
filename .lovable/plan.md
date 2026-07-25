Tighten the Lounge Stage so the chat area gains more vertical space.

Changes:

1. Reduce SpeakerBubble sizes
   - In `src/components/media-panel.tsx`, shrink the `SpeakerBubble` dimensions:
     - `lg` → `h-14 w-14` (down from 16)
     - `md` → `h-12 w-12` (down from 14)
     - `sm` → `h-10 w-10` (down from 12)
   - Shrink the outer bubble container width from `w-16 sm:w-20` to `w-14 sm:w-16` so labels stay close but still truncate.
   - Reduce the speaking ring glow from `shadow-[0_0_0_4px_...]` to `2px` so active speakers don't feel visually larger.

2. Tighten stage spacing
   - In `VideoStage`, reduce the wrapper padding from `px-4 py-3 md:px-6` to `px-3 py-2 md:px-4`.
   - Reduce the bubble cluster gap from `gap-x-4 gap-y-3` to `gap-x-3 gap-y-2`.
   - Reduce the eyebrow bottom margin from `mb-2` to `mb-1.5`.
   - Lower the empty-stage quiet message padding from `py-4` to `py-2.5` so an empty stage is a thin ribbon rather than a tall block.

3. Reclaim height for chat
   - In `src/components/channel-view.tsx`, raise the chat viewport height clamp:
     - Desktop: `h-[clamp(320px,44vh,520px)] xl:h-[58vh]` (up from `280px/38vh/440px` and `52vh`).
     - Keep the same `min-h-0` flex behavior so the chat still shrinks correctly on very short viewports.

4. Verify responsive behavior
   - Build and check that the desktop Lounge still shows all 10 speaker bubbles in one row without wrapping.
   - Check the mobile/preview layout so the stage doesn't crowd the chat composer.
   - Confirm no regression in the screen-share spotlight layout (bubbles below the spotlight still fit).