# Align the Recent Work carousel

## Change
- Update the logged-out homepage’s Recent Work carousel so its first thumbnail, category summary, and title start on exactly the same vertical line as the “Made on Workshop” and “Recent Work” headings.
- Remove the current negative outer margins and compensating inner padding, which still allow the track to bleed to the left edge.
- Keep horizontal scrolling and card sizing unchanged; only correct the left alignment on mobile and desktop.

## Verification
- Check the rendered section at mobile and desktop widths and compare the heading and first-card left coordinates.
- Confirm later cards remain horizontally scrollable and no content is clipped on the left.
