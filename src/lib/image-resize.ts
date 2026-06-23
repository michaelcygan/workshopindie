/**
 * Client-side image resize. Returns a JPEG Blob no larger than `maxEdge` on
 * its long edge. Falls back to the original file if anything goes wrong, so
 * uploads never break because resize failed.
 */
export async function resizeImageToJpeg(
  file: File,
  maxEdge = 1500,
  quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  try {
    const bitmap = await createBitmap(file);
    const { width: w0, height: h0 } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    const width = Math.round(w0 * scale);
    const height = Math.round(h0 * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d ctx");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality,
      ),
    );
    return { blob, width, height, mime: "image/jpeg" };
  } catch {
    return { blob: file, width: 0, height: 0, mime: file.type || "image/jpeg" };
  }
}

async function createBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}
