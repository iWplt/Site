"use client";

import { useRef, useState, useTransition } from "react";
import {
  deleteFormOptionImageAction,
  updateFormFieldMetaAction,
  updateFormOptionAction
} from "@/app/actions";
import { uploadAdminImage } from "@/lib/admin-image-upload-client";
import { ImagePreviewThumb } from "@/components/image-preview";
import { Button, FieldLabel, TextInput } from "@/components/ui";
import type { FormField, FormOption } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  formId: string;
  fields: FormField[];
};

function clientActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    if (/unexpected response was received from the server/i.test(error.message)) {
      return "تعذر إتمام العملية على الخادم. أعد المحاولة أو تحقق من بيانات الخيار.";
    }
    return error.message;
  }
  return fallback;
}

export function FormOptionImageEditor({ formId, fields }: Props) {
  const choiceFields = fields.filter(
    (field) =>
      ["radio", "select", "image_choice"].includes(field.type) &&
      field.key !== "full_outfit_id" &&
      field.key !== "selected_products" &&
      field.key !== "booking_type" &&
      !field.key.startsWith("catalog_")
  );

  if (!choiceFields.length) return null;

  return (
    <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white/50 p-4">
      <div>
        <h3 className="text-xl font-black text-[var(--olive-dark)]">صور خيارات المنتجات</h3>
        <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
          ارفع صورة مرجعية مستقلة لكل خيار. هذه الصور منفصلة تماماً عن مرفقات تصميم الطالب.
        </p>
      </div>
      {choiceFields.map((field) => (
        <FieldOptionEditor key={field.id} formId={formId} field={field} />
      ))}
    </div>
  );
}

function FieldOptionEditor({ formId, field }: { formId: string; field: FormField }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [showImages, setShowImages] = useState(Boolean(field.showOptionImages ?? field.type === "image_choice"));

  function toggleShowImages(next: boolean) {
    setShowImages(next);
    startTransition(async () => {
      try {
        const result = await updateFormFieldMetaAction(formId, field.key, { showOptionImages: next });
        if (!result.success) {
          setShowImages(!next);
          setMessage(result.error);
          return;
        }
        setMessage("تم حفظ إعداد عرض الصور.");
      } catch (error) {
        setShowImages(!next);
        setMessage(clientActionError(error, "تعذر الحفظ."));
      }
    });
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--paper)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">{field.key}</p>
          <h4 className="text-lg font-black text-[var(--olive-dark)]">{field.label}</h4>
        </div>
        <label className="inline-flex items-center gap-2 rounded-2xl bg-[#3f472d0d] px-3 py-2 text-sm font-bold text-[var(--olive)]">
          <input
            type="checkbox"
            checked={showImages}
            disabled={pending}
            onChange={(event) => toggleShowImages(event.target.checked)}
          />
          عرض صور الخيارات
        </label>
      </div>
      <div className="mt-4 grid gap-3">
        {(field.options ?? [])
          .flatMap((option) => {
            const nodes = option.children?.length ? option.children : [option];
            return nodes.map((node) => ({ option, node }));
          })
          .filter(({ node }) => !node.catalogProductId)
          .map(({ option, node }) => (
            <OptionRow
              key={node.id}
              formId={formId}
              fieldKey={field.key}
              parentLabel={node.id === option.id ? undefined : option.label}
              option={node}
              onMessage={setMessage}
            />
          ))}
      </div>
      {message ? <p className="mt-3 text-sm font-bold text-[var(--olive)]">{message}</p> : null}
    </div>
  );
}

function OptionRow({
  formId,
  fieldKey,
  option,
  parentLabel,
  onMessage
}: {
  formId: string;
  fieldKey: string;
  option: FormOption;
  parentLabel?: string;
  onMessage: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(option.label);
  const [description, setDescription] = useState(option.description ?? "");
  const [enabled, setEnabled] = useState(option.enabled !== false);
  const [preview, setPreview] = useState(option.imageUrl);
  const previousPreview = useRef(option.imageUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveMeta() {
    startTransition(async () => {
      try {
        const result = await updateFormOptionAction(formId, fieldKey, option.id, {
          label: label.trim() || option.label,
          description: description.trim() || undefined,
          enabled
        });
        if (!result.success) {
          onMessage(result.error);
          return;
        }
        onMessage("تم حفظ بيانات الخيار.");
      } catch (error) {
        onMessage(clientActionError(error, "تعذر الحفظ."));
      }
    });
  }

  function upload(file: File | undefined) {
    if (!file) return;
    const prior = previousPreview.current ?? preview;
    startTransition(async () => {
      try {
        const result = await uploadAdminImage(
          "option",
          { formId, fieldKey, optionId: option.id },
          file
        );
        if (!result.success) {
          setPreview(prior);
          onMessage(result.error);
          return;
        }
        const nextUrl = result.data?.imageUrl;
        setPreview(nextUrl);
        previousPreview.current = nextUrl;
        onMessage("تم رفع صورة الخيار.");
      } catch (error) {
        setPreview(prior);
        onMessage(clientActionError(error, "تعذر رفع الصورة."));
      }
    });
  }

  function removeImage() {
    const prior = previousPreview.current ?? preview;
    startTransition(async () => {
      try {
        const result = await deleteFormOptionImageAction(formId, fieldKey, option.id);
        if (!result.success) {
          setPreview(prior);
          onMessage(result.error);
          return;
        }
        setPreview(undefined);
        previousPreview.current = undefined;
        onMessage("تم حذف صورة الخيار.");
      } catch (error) {
        setPreview(prior);
        onMessage(clientActionError(error, "تعذر حذف الصورة."));
      }
    });
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-white/70 p-3 sm:grid-cols-[7.5rem_1fr]">
      <div className="overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-[#3f472d08]">
        {preview ? (
          <ImagePreviewThumb
            src={preview}
            alt={option.imageAlt || option.label}
            className="aspect-square w-full"
            sizes="120px"
          />
        ) : (
          <div className="grid aspect-square place-items-center px-2 text-center text-xs font-bold text-[var(--muted)]">
            لم تتم إضافة صورة
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <p className="text-xs font-bold text-[var(--muted)]">
          {parentLabel ? `${parentLabel} → ` : ""}
          <span className="ltr">{option.value}</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <FieldLabel>اسم الخيار</FieldLabel>
            <TextInput value={label} onChange={(event) => setLabel(event.target.value)} className="min-h-11 text-sm" />
          </div>
          <div>
            <FieldLabel>الوصف</FieldLabel>
            <TextInput
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-11 text-sm"
              placeholder="اختياري"
            />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-bold text-[var(--olive)]">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          فعال
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="min-h-10 text-sm" disabled={pending} onClick={saveMeta}>
            حفظ البيانات
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-10 text-sm"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {preview ? "تغيير الصورة" : "رفع صورة"}
          </Button>
          {preview ? (
            <Button type="button" variant="ghost" className="min-h-10 text-sm" disabled={pending} onClick={removeImage}>
              حذف الصورة
            </Button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        <p className={cn("text-[11px] text-[var(--muted)]")}>JPG / PNG / WEBP · حتى 5MB · بدون قص إجباري</p>
      </div>
    </div>
  );
}
