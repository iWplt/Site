import { STUDENT_IMAGE_MAX_EDGE, STUDENT_UPLOAD_MAX_BYTES } from "@/lib/upload-limits";

function hasVisibleAlpha(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sample = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < sample.length; i += 4) {
    if (sample[i] < 250) return true;
  }
  return false;
}

async function bitmapFromFile(file: File) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("تعذر قراءة الصورة."));
      el.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("تعذر ضغط الصورة."));
      else resolve(blob);
    }, type, quality);
  });
}

export async function optimizeStudentImage(file: File): Promise<File> {
  if (file.type === "application/pdf") {
    if (file.size > STUDENT_UPLOAD_MAX_BYTES) {
      throw new Error("الملف أكبر من الحد المسموح (10 ميجابايت).");
    }
    return file;
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("صيغة الملف غير مدعومة.");
  }

  const source = await bitmapFromFile(file);
  const longEdge = Math.max(source.width, source.height);
  const scale = longEdge > STUDENT_IMAGE_MAX_EDGE ? STUDENT_IMAGE_MAX_EDGE / longEdge : 1;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر ضغط الصورة.");
  ctx.drawImage(source, 0, 0, width, height);
  if ("close" in source && typeof source.close === "function") source.close();

  const keepAlpha = file.type === "image/png" && hasVisibleAlpha(ctx, width, height);
  const outputType = keepAlpha ? "image/webp" : "image/jpeg";
  const qualities = keepAlpha ? [0.86, 0.82] : [0.84, 0.8, 0.76];

  let best: Blob | null = null;
  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, outputType, quality);
    best = blob;
    if (blob.size <= 500 * 1024) break;
  }
  if (!best) throw new Error("تعذر ضغط الصورة.");
  if (best.size > STUDENT_UPLOAD_MAX_BYTES) {
    throw new Error("الملف أكبر من الحد المسموح حتى بعد الضغط. اختر صورة أصغر.");
  }

  const extension = outputType === "image/webp" ? "webp" : "jpg";
  const name = file.name.replace(/\.[^.]+$/, "") + "." + extension;
  return new File([best], name, { type: outputType, lastModified: Date.now() });
}
