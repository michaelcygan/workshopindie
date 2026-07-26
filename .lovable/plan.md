Plan: End-to-end preview verification of the Collab Tasks feature

Goal: Confirm the new private task list inside the Collab workspace works correctly across desktop and mobile before closing the loop.

Verification steps
1. Navigate to a sample Collab in the preview and open the workspace.
   - Confirm the three tabs appear: Chat | Tasks | Links.
   - Confirm the Tasks tab shows an incomplete-count badge when tasks exist.

2. Exercise task lifecycle
   - Create a task with the inline composer.
   - Edit the task title inline.
   - Move the task through statuses: To do → In progress → Done.
   - Verify the Done state shows a completed timestamp.

3. Test ordering
   - Create multiple tasks.
   - Use drag-and-drop reordering (Framer Motion Reorder).
   - Use the Move up / Move down fallback buttons.
   - Refresh the page and confirm order persists.

4. Test deletion and permissions
   - Delete a task as the creator and confirm the AlertDialog.
   - Verify the task is removed after confirmation.

5. Realtime and responsiveness
   - Open the same Collab in two contexts (or observe the network/realtime channel).
   - Confirm changes made in one view reflect in the other without a manual refresh.
   - Check mobile viewport: touch targets (44px minimum), no clipping, readable task rows.

6. Report findings
   - Note any console errors, layout issues, or broken interactions.
   - If all checks pass, mark the feature as verified and recommend closing the plan.

No code changes are expected in this plan unless a verification step reveals a bug that needs fixing.