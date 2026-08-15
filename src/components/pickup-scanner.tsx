"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, TextInput } from "@/components/ui";

function extractToken(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((part) => part === "pickup");
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch {
    const match = trimmed.match(/pickup\/([^/?#]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return trimmed;
}

export function PickupScanner() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [cameraError, setCameraError] = useState<string>();
  const [cameraReady, setCameraReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>(0);
  const scannedRef = useRef(false);

  function go(raw: string) {
    const token = extractToken(raw);
    if (!token || scannedRef.current) return;
    scannedRef.current = true;
    stopCamera();
    startTransition(() => router.push(`/admin/pickup/${encodeURIComponent(token)}`));
  }

  function stopCamera() {
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  async function startCamera() {
    const Detector = (window as Window & {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;
    if (!Detector) {
      setCameraError("الكاميرا التلقائية غير متاحة على هذا المتصفح. الصق الرابط يدوياً.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
      setCameraError(undefined);
      const detector = new Detector({ formats: ["qr_code"] });
      timerRef.current = window.setInterval(async () => {
        if (video.readyState < 2 || scannedRef.current) return;
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) go(raw);
        } catch {
          /* ignore frame errors */
        }
      }, 700);
    } catch {
      setCameraError("تعذر فتح الكاميرا. الصق الرابط يدوياً.");
    }
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        scannedRef.current = false;
        go(value);
      }}
    >
      <video
        ref={videoRef}
        className={cameraReady ? "aspect-square w-full rounded-2xl bg-black object-cover" : "hidden"}
        muted
        playsInline
      />
      {cameraError ? <p className="text-sm text-[var(--muted)]">{cameraError}</p> : null}
      <TextInput
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="الصق رابط QR أو رمز الاستلام"
        className="min-h-12"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button className="min-h-12" disabled={pending || !value.trim()}>
          فتح الطلب
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-12"
          onClick={() => {
            if (cameraReady) stopCamera();
            else void startCamera();
          }}
        >
          {cameraReady ? "إيقاف الكاميرا" : "مسح بالكاميرا"}
        </Button>
      </div>
    </form>
  );
}
