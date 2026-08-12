# Sticky Blog Composer Tool Stripe

Make the formatting toolbar ("tool stripe") inside the blog composer stay visible at the top of the viewport while the user scrolls the long post body, so formatting actions remain within reach without excessive scrolling.

## What we'll change

1. **Sticky toolbar in `src/components/blog-body-editor.tsx`**
   - Apply `sticky top-0` to the toolbar row that contains the **Body / Markdown-light** label and the Bold, Italic, Link, Embed, Tag, and More-formatting controls.
   - Give the toolbar a solid background (`bg-surface`) and a subtle bottom border so it visually separates from the text area as it sticks.
   - Add a small z-index (`z-10`) so it floats above the composer's text area and embed cards.
   - Keep the existing rounded card wrapper and the text-area `overflow-hidden` intact; the toolbar is a sibling of the writing surface, so it does not clip.

2. **Verify on both editor surfaces**
   - Confirm the change applies in the member blog composer (`/me/blog/$id`) and the admin CMS editor (`/admin/blog/$id`), because both render the same `BlogBodyEditor` component.
   - Check that the sticky toolbar does not overlap the page header or the tabs on mobile and desktop.

## Out of scope

- No changes to toolbar buttons, labels, or actions.
- No changes to the Markdown-light parser or the body text area.
- No changes to the blog post detail/public view.
