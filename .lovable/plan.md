# Animated GIF covers for profiles

Let members upload an animated GIF as their profile cover photo from Settings, using the existing "Add cover → Upload image" flow.

## Why it doesn't work today

The cover uploader accepts any image file, but every upload is redrawn onto a canvas and re-encoded as JPEG before it is sent. A GIF survives that trip as a single frozen frame, so the animation is lost.

## What changes

- In the cover picker, detect GIFs and skip the JPEG conversion — upload the original file as-is so the animation is preserved.
- Everything else stays the same: same "Upload image" menu item, same storage bucket, same public URL, same removal and "Select from a Work" options.
- Size guardrails for GIFs: allow up to 8MB (GIFs can't be compressed client-side the way photos can). Anything larger gets a clear message asking for a smaller file, instead of a silent failure.
- The file picker keeps accepting all image types; GIF is simply no longer flattened.
- Non-GIF uploads keep the current downscale-to-JPEG behavior unchanged.

Profile pages already render the cover with a plain image tag, so an uploaded GIF animates on the profile and in Settings' preview with no other changes.

## Scope

Only the profile cover in Settings. Avatars, Work covers, blog covers, and event covers keep the current JPEG-flattening behavior.

## Technical notes

- `src/components/cover-image-picker.tsx`: branch in `handleFile` — when `file.type === "image/gif"`, enforce an 8MB cap and pass the original `File` straight to `uploadToBucket("covers", ...)`, bypassing `resizeImageToJpeg`.
- `src/lib/storage.ts` already derives the extension from the filename and sets `contentType` from the file, so `.gif` objects upload and serve correctly.
- The `covers` bucket is public with no MIME or size restrictions, so no migration or bucket change is needed.
