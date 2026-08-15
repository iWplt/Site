import { ImageGallery } from "@/components/image-gallery";
import type { GalleryImage, OrderSectionView } from "@/lib/order-view";
import { cn } from "@/lib/utils";

export function OrderVisual({
  sections,
  printMode = false
}: {
  sections: OrderSectionView[];
  printMode?: boolean;
}) {
  return (
    <div className="grid gap-4">
      {sections.map((section) => (
        <section key={section.id} className={cn("rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-4", printMode && "break-inside-avoid")}>
          <h3 className="text-lg font-black text-[var(--olive-dark)]">{section.title}</h3>
          <div className="mt-3 grid gap-3">
            {section.lines.map((line) => (
              <div key={line.key} className="rounded-2xl bg-[#fffaf0] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold text-[var(--muted)]">{line.label}</p>
                  {line.fixed ? (
                    <span className="rounded-full bg-[#3f472d12] px-2 py-0.5 text-[10px] font-bold text-[var(--olive)]">
                      اختيار موحد للدفعة
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-base font-black leading-7 text-[var(--olive-dark)]">{line.value || "غير محدد"}</p>
                {line.description ? <p className="mt-1 text-sm leading-7 text-[var(--muted)]">{line.description}</p> : null}
                {line.referenceImages.length ? (
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] font-bold text-[var(--gold)]">صورة الخيار</p>
                    {printMode ? (
                      <PrintThumbs images={line.referenceImages} />
                    ) : (
                      <ImageGallery images={line.referenceImages} compact />
                    )}
                  </div>
                ) : null}
                {line.studentImages.length ? (
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] font-bold text-[var(--olive)]">الصورة المرفقة من الطالب</p>
                    {printMode ? (
                      <PrintThumbs images={line.studentImages} />
                    ) : (
                      <ImageGallery images={line.studentImages} compact />
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PrintThumbs({ images }: { images: GalleryImage[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((image, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${image.src}-${index}`} src={image.src} alt={image.alt} className="aspect-[4/3] w-full rounded-xl border border-[var(--border)] object-contain" />
      ))}
    </div>
  );
}
