"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, LockKeyhole } from "lucide-react";
import dynamic from "next/dynamic";
import { MultipleImageUpload, type UploadedFile } from "@/components/multiple-image-upload";
import { PublicVisualHero, StudentGalleryStrip } from "@/components/public-visuals";
import { OptimizedThumb } from "@/components/optimized-thumb";
import { Button, Card, FieldLabel, TextArea, TextInput } from "@/components/ui";
import { PUBLIC_VISUALS } from "@/lib/brand-assets";
import { fieldIsVisible } from "@/lib/form-definition";
import { isUniformProductKey } from "@/lib/form-uniform";
import { asStringList, isBlankValue, resolveOutfitAnswers } from "@/lib/outfit-architecture";
import { formatProductPrice, optionVisibleForBooking } from "@/lib/product-catalog";
import { buildLiveOrderSections } from "@/lib/order-view";
import { requiredUploadError } from "@/lib/required-upload";
import type { BookingFormRecord, FormField } from "@/lib/types";
import { cn } from "@/lib/utils";

const OrderVisual = dynamic(
  () => import("@/components/order-visual").then((mod) => mod.OrderVisual),
  { ssr: false, loading: () => <p className="text-sm text-[var(--muted)]">جاري تحميل الملخص...</p> }
);

type Props = {
  form: BookingFormRecord;
  studentName?: string;
  studentPhone?: string;
  studentAddress?: string;
  previewMode?: boolean;
};

type SuccessState = {
  bookingNumber: string;
  studentName: string;
  submittedAt: string;
  receiptToken: string;
  batchName?: string;
};

export function BookingWizard({ form, studentName, studentPhone, studentAddress, previewMode = false }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = { student_name: studentName };
    if (studentPhone) initial.phone = studentPhone;
    if (studentAddress) initial.address = studentAddress;
    form.definition.sections.forEach((section) =>
      section.fields.forEach((field) => {
        if (field.defaultValue !== undefined) initial[field.key] = field.defaultValue;
      })
    );
    return resolveOutfitAnswers(form.definition, initial);
  });
  const [files, setFiles] = useState<Record<string, UploadedFile[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [isPending, startTransition] = useTransition();

  const sections = useMemo(() => {
    return form.definition.sections.filter((section) =>
      section.fields.some((field) => fieldIsVisible(field, answers))
    );
  }, [answers, form.definition.sections]);

  const activeStep = Math.min(step, sections.length);
  const isReview = activeStep >= sections.length;
  const stepLabels = [...sections.map((section) => section.title), "مراجعة الطلب"];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  const visibleFields = useMemo(
    () =>
      (sections[activeStep]?.fields.filter((field) => fieldIsVisible(field, answers)) ?? []).filter((field) => {
        if (!["radio", "select", "image_choice", "checkbox"].includes(field.type) || !field.options?.length) return true;
        const visibleOptions = field.options.filter((option) => optionVisibleForBooking(option, answers.booking_type));
        return visibleOptions.length > 0 || Boolean(field.required);
      }),
    [answers, sections, activeStep]
  );

  function setAnswer(key: string, value: unknown) {
    setAnswers((current) => resolveOutfitAnswers(form.definition, { ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validateStep() {
    const nextErrors: Record<string, string> = {};
    for (const field of visibleFields) {
      const value = answers[field.key];
      const isUpload = ["image_upload", "file_upload"].includes(field.type);
      if (isUpload) {
        const uploadError = requiredUploadError(files[field.key], field.required);
        if (uploadError) nextErrors[field.key] = uploadError;
        continue;
      }
      if (field.type === "checkbox") {
        if (field.required && !asStringList(value).length) {
          nextErrors[field.key] = "يرجى اختيار عنصر واحد على الأقل.";
        }
        continue;
      }
      if (field.required && isBlankValue(value)) {
        nextErrors[field.key] = "هذا الحقل مطلوب.";
      }
      if (field.type === "number" && !isBlankValue(value)) {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) {
          nextErrors[field.key] = "يرجى إدخال رقم صحيح.";
        }
      }
      if (field.type === "phone" && value && !/^(\+?964|0)?7[0-9\s-]{8,12}$/.test(String(value))) {
        nextErrors[field.key] = "يرجى إدخال رقم هاتف عراقي صحيح.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function submit() {
    if (previewMode) return;
    startTransition(async () => {
      const response = await fetch("/api/booking/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: form.slug, answers, files })
      });
      const payload = await response.json();
      if (!response.ok) {
        setErrors(payload.fieldErrors ?? { form: payload.error ?? "تعذر إرسال الطلب." });
        return;
      }
      setSuccess({
        bookingNumber: payload.bookingNumber,
        studentName: payload.studentName,
        submittedAt: payload.submittedAt,
        receiptToken: payload.receiptToken,
        batchName: payload.batchName
      });
    });
  }

  if (success) {
    return <SuccessCard success={success} />;
  }

  return (
    <div className="mx-auto max-w-3xl pb-32">
      {previewMode ? (
        <p className="mb-3 rounded-2xl bg-[#b59a631f] px-4 py-3 text-sm font-bold text-[#836528]">
          معاينة إدارية — لا يُرسل طلب حقيقي.
        </p>
      ) : null}
      <Card className="mb-4 !rounded-[1.35rem] !p-4 sm:!p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--gold)]">WARKA BOOKING</p>
            <h1 className="mt-1 text-xl font-black leading-8 text-[var(--olive-dark)] sm:text-2xl">{form.name}</h1>
            {studentName ? <p className="mt-1 truncate text-sm text-[var(--muted)]">{studentName}</p> : null}
          </div>
          <div className="shrink-0 rounded-2xl bg-[#3f472d10] px-3 py-2 text-center">
            <p className="text-[10px] font-bold text-[var(--muted)]">الخطوة</p>
            <p className="text-lg font-black text-[var(--olive)]">
              {Math.min(activeStep + 1, stepLabels.length)}/{stepLabels.length}
            </p>
          </div>
        </div>
        <ol className="mt-4 flex gap-1 overflow-x-auto pb-1">
          {stepLabels.map((label, index) => (
            <li key={`${label}-${index}`} className="min-w-[4.5rem] flex-1">
              <div className={cn("h-1.5 rounded-full", index <= activeStep ? "bg-[var(--olive)]" : "bg-[var(--sand)]")} />
              <p className={cn("mt-1 truncate text-[10px] font-bold", index === activeStep ? "text-[var(--olive-dark)]" : "text-[var(--muted)]")}>{label}</p>
            </li>
          ))}
        </ol>
      </Card>

      {isReview ? (
        <ReviewStep
          form={form}
          answers={answers}
          files={files}
          pending={isPending}
          onBack={() => setStep(Math.max(0, sections.length - 1))}
          onSubmit={submit}
          error={errors.form}
          previewMode={previewMode}
        />
      ) : (
        <Card className="!rounded-[1.35rem]">
          <p className="text-xs font-bold text-[var(--gold)]">{String(activeStep + 1).padStart(2, "0")}</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--olive-dark)]">{sections[activeStep].title}</h2>
          {sections[activeStep].description ? <p className="mt-2 text-base leading-8 text-[var(--muted)]">{sections[activeStep].description}</p> : null}
          <div className="mt-6 grid gap-6">
            {visibleFields.map((field, fieldIndex) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={answers[field.key]}
                files={files[field.key] ?? []}
                error={errors[field.key]}
                bookingType={answers.booking_type}
                prioritizeImages={fieldIndex === 0}
                onChange={(value) => setAnswer(field.key, value)}
                onFiles={(next) => setFiles((current) => ({ ...current, [field.key]: next }))}
              />
            ))}
            {!visibleFields.length ? <p className="text-[var(--muted)]">لا توجد حقول ظاهرة في هذه الخطوة حسب اختياراتك السابقة.</p> : null}
          </div>
        </Card>
      )}

      {!isReview ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[rgba(246,239,225,0.97)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-3">
            <Button className="min-h-12 flex-1" variant="secondary" disabled={activeStep === 0} onClick={() => setStep((current) => Math.max(0, Math.min(current, sections.length) - 1))}>
              <ChevronRight size={16} className="inline" /> رجوع
            </Button>
            <Button className="min-h-12 flex-1" onClick={() => validateStep() && setStep((current) => Math.min(sections.length, Math.min(current, sections.length) + 1))}>
              متابعة <ChevronLeft size={16} className="inline" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SuccessCard({ success }: { success: SuccessState }) {
  const visuals = PUBLIC_VISUALS.booking;
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PublicVisualHero
        asset={visuals.mosaic[1] ?? visuals.hero}
        aspect="16/7"
        sizes="(max-width: 768px) 100vw, 420px"
        className="max-h-44"
      />
      <Card className="text-center !rounded-[1.5rem] !bg-[var(--paper)]">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#386a3d16] text-[var(--success)]">
        <Check size={30} />
      </div>
      <h1 className="text-3xl font-black leading-12 text-[var(--olive-dark)]">تم تسجيل طلبك بنجاح</h1>
      <p className="mt-3 text-[var(--muted)]">احتفظ برقم الحجز. يمكنك طباعة بطاقة الحجز أو حفظها PDF من المتصفح.</p>
      <p className="mt-6 text-sm font-bold text-[var(--gold)]">رقم الحجز</p>
      <p className="mt-1 text-4xl font-black tracking-wide text-[var(--olive-dark)] ltr">{success.bookingNumber}</p>
      <dl className="mt-6 grid gap-3 rounded-3xl bg-white/70 p-4 text-right">
        <SummaryRow label="الطالب" value={success.studentName} />
        {success.batchName ? <SummaryRow label="الدفعة" value={success.batchName} /> : null}
        <SummaryRow label="وقت الإرسال" value={new Date(success.submittedAt).toLocaleString("ar-IQ")} />
      </dl>
      <div className="mt-6 grid gap-3">
        {success.receiptToken ? (
          <>
            <a href={`/b/${success.receiptToken}`} className="min-h-12 rounded-2xl bg-[var(--olive)] px-5 py-3 font-black text-[var(--paper)]">
              عرض تفاصيل الطلب
            </a>
            <a href={`/b/${success.receiptToken}/print`} className="min-h-12 rounded-2xl border border-[var(--border)] bg-white px-5 py-3 font-black text-[var(--olive)]">
              طباعة بطاقة الحجز / حفظ PDF
            </a>
          </>
        ) : null}
      </div>
    </Card>
      <StudentGalleryStrip items={visuals.gallery} title="من عالم WARKA" />
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  files,
  error,
  bookingType,
  prioritizeImages = false,
  onChange,
  onFiles
}: {
  field: FormField;
  value: unknown;
  files: UploadedFile[];
  error?: string;
  bookingType?: unknown;
  prioritizeImages?: boolean;
  onChange: (value: unknown) => void;
  onFiles: (files: UploadedFile[]) => void;
}) {
  const lockedOption = field.options?.find((option) => option.value === value) ?? field.options?.[0];
  return (
    <div>
      <FieldLabel required={field.required}>{field.label}</FieldLabel>
      {field.description ? <p className="mb-3 text-sm leading-7 text-[var(--muted)]">{field.description}</p> : null}
      {field.locked && isUniformProductKey(field.key) ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#3f472d12] px-3 py-1 text-xs font-bold text-[var(--olive)]">
          <LockKeyhole size={13} /> اختيار موحد للدفعة
        </p>
      ) : field.locked && field.type === "read_only" ? null : field.locked ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#3f472d12] px-3 py-1 text-xs font-bold text-[var(--olive)]">
          <LockKeyhole size={13} /> خيار مقفل من الإدارة
        </p>
      ) : null}
      {field.type === "read_only" ? <div className="rounded-2xl border border-[var(--border)] bg-[#3f472d0d] px-4 py-3 text-base font-bold">{String(value ?? "")}</div> : null}
      {field.type === "short_text" || field.type === "phone" || field.type === "number" ? (
        <div className={field.key === "robe_height" ? "flex items-center gap-2" : undefined}>
          <TextInput
            type={field.type === "number" ? "number" : "text"}
            inputMode={field.type === "phone" ? "tel" : field.type === "number" ? "decimal" : undefined}
            dir={field.type === "phone" || field.type === "number" ? "ltr" : undefined}
            placeholder={field.placeholder}
            value={String(value ?? "")}
            disabled={field.locked}
            min={field.type === "number" ? 1 : undefined}
            className="min-h-12 text-base"
            onChange={(event) => onChange(event.target.value)}
          />
          {field.key === "robe_height" ? <span className="shrink-0 text-sm font-bold text-[var(--muted)]">سم</span> : null}
        </div>
      ) : null}
      {field.type === "long_text" ? (
        <TextArea
          placeholder={field.placeholder}
          value={String(value ?? "")}
          disabled={field.locked}
          className="min-h-32 text-base"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
      {field.type === "checkbox" && field.options ? (
        <div className="grid gap-3">
          {field.options
            .filter((option) => optionVisibleForBooking(option, bookingType))
            .map((option) => {
              const selected = asStringList(value).includes(option.value);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    const current = asStringList(value);
                    onChange(selected ? current.filter((entry) => entry !== option.value) : [...current, option.value]);
                  }}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-[1.4rem] border p-4 text-right",
                    selected ? "border-[var(--olive)] bg-[#3f472d12] ring-4 ring-[#3f472d18]" : "border-[var(--border)] bg-white/70"
                  )}
                >
                  <span>
                    <span className="block text-base font-black text-[var(--olive-dark)]">{option.label}</span>
                    {option.description ? <span className="mt-1 block text-sm text-[var(--muted)]">{option.description}</span> : null}
                  </span>
                  <span
                    className={cn(
                      "mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2",
                      selected ? "border-[var(--olive)] bg-[var(--olive)] text-white" : "border-[var(--border)]"
                    )}
                  >
                    {selected ? <Check size={12} /> : null}
                  </span>
                </button>
              );
            })}
        </div>
      ) : null}
      {field.type === "boolean" ? (
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((entry) => (
            <button
              key={String(entry)}
              type="button"
              onClick={() => onChange(entry)}
              className={cn(
                "min-h-12 rounded-2xl border p-4 text-base font-bold",
                value === entry ? "border-[var(--olive)] bg-[#3f472d12]" : "border-[var(--border)] bg-white/70"
              )}
            >
              {entry ? "نعم" : "لا"}
            </button>
          ))}
        </div>
      ) : null}
      {field.locked && ["radio", "select", "image_choice"].includes(field.type) ? (
        <div className="overflow-hidden rounded-[1.4rem] border border-[var(--olive)] bg-white">
          {lockedOption && (field.showOptionImages || field.type === "image_choice") && lockedOption.imageUrl ? (
            <OptimizedThumb
              src={lockedOption.imageUrl}
              alt={lockedOption.imageAlt || lockedOption.label}
              sizes="(max-width: 768px) 100vw, 640px"
              eager={prioritizeImages}
            />
          ) : null}
          <div className="p-4">
            <p className="text-base font-black leading-7 text-[var(--olive-dark)]">
              {lockedOption?.label ?? String(value ?? "")}
            </p>
            {lockedOption?.description ? (
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{lockedOption.description}</p>
            ) : null}
            {formatProductPrice(lockedOption?.priceIqd) ? (
              <p className="mt-2 text-sm font-bold text-[var(--olive)]">{formatProductPrice(lockedOption?.priceIqd)}</p>
            ) : null}
            <p className="mt-3 inline-flex rounded-full bg-[#3f472d12] px-3 py-1 text-xs font-bold text-[var(--olive)]">
              اختيار موحد للدفعة
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">محدد من قبل مسؤول الدفعة</p>
          </div>
        </div>
      ) : ["radio", "select", "image_choice"].includes(field.type) && field.options ? (
        <div
          className={cn(
            "grid gap-3",
            field.showOptionImages || field.type === "image_choice" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          )}
        >
          {field.options
            .filter((option) => optionVisibleForBooking(option, bookingType))
            .flatMap((option, optionIndex) => {
              const optionChildren = (option.children?.length ? option.children : [option]).filter((child) => child.enabled !== false);
              return optionChildren.map((child, childIndex) => {
                const label = child.id === option.id ? child.label : `${option.label} - ${child.label}`;
                const selected = value === child.value;
                const showImages = Boolean(field.showOptionImages || field.type === "image_choice");
                const image = child.imageUrl || option.imageUrl;
                return (
                  <button
                    key={child.id}
                    type="button"
                    disabled={field.locked}
                    aria-pressed={selected}
                    onClick={() => onChange(child.value)}
                    className={cn(
                      "overflow-hidden rounded-[1.4rem] border bg-[var(--paper)] text-right shadow-[0_10px_30px_rgba(37,43,28,0.05)] transition",
                      selected ? "border-[var(--olive)] ring-4 ring-[#3f472d18]" : "border-[var(--border)]",
                      field.locked && "opacity-90"
                    )}
                  >
                    {showImages ? (
                      image ? (
                        <OptimizedThumb
                          src={image}
                          alt={child.imageAlt || label}
                          sizes="(max-width: 640px) 100vw, 50vw"
                          eager={prioritizeImages && optionIndex === 0 && childIndex === 0}
                        />
                      ) : (
                        <div className="grid aspect-[4/3] place-items-center bg-[#f3ead6] px-4 text-center text-sm font-bold text-[var(--muted)]">
                          صورة الخيار ستظهر بعد رفع المالك للصورة المرجعية
                        </div>
                      )
                    ) : null}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-base font-black leading-7 text-[var(--olive-dark)]">{label}</span>
                        <span
                          className={cn(
                            "mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
                            selected ? "border-[var(--olive)] bg-[var(--olive)] text-white" : "border-[var(--border)]"
                          )}
                        >
                          {selected ? <Check size={12} /> : null}
                        </span>
                      </div>
                      {(child.description || option.description) && child.id === option.id ? (
                        <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">{child.description || option.description}</span>
                      ) : child.description ? (
                        <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">{child.description}</span>
                      ) : null}
                      {formatProductPrice(child.priceIqd ?? option.priceIqd) ? (
                        <span className="mt-2 block text-sm font-bold text-[var(--olive)]">
                          {formatProductPrice(child.priceIqd ?? option.priceIqd)}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              });
            })}
        </div>
      ) : null}
      {["image_upload", "file_upload"].includes(field.type) ? (
        <div className="rounded-[1.35rem] border border-[var(--border)] bg-white/55 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold",
                field.required ? "bg-[#9d2f2f12] text-[var(--danger)]" : "bg-[#3f472d12] text-[var(--olive)]"
              )}
            >
              {field.required ? "مطلوب" : "اختياري"}
            </span>
            {field.uploadMode === "multiple" ? (
              <span className="text-xs font-bold text-[var(--muted)]">
                حتى {Math.min(field.maxFiles ?? 5, 5)} صور
              </span>
            ) : null}
          </div>
          <MultipleImageUpload
            fieldKey={field.key}
            label="المرفقات"
            accept={field.accept}
            multiple={field.uploadMode === "multiple"}
            maxFiles={field.uploadMode === "multiple" ? Math.min(field.maxFiles ?? 5, 5) : 1}
            value={files}
            onChange={onFiles}
            error={error}
          />
        </div>
      ) : null}
      {error && !["image_upload", "file_upload"].includes(field.type) ? (
        <p className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}

function ReviewStep({
  form,
  answers,
  files,
  pending,
  onBack,
  onSubmit,
  error,
  previewMode
}: {
  form: BookingFormRecord;
  answers: Record<string, unknown>;
  files: Record<string, UploadedFile[]>;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
  error?: string;
  previewMode?: boolean;
}) {
  const flatFiles = Object.entries(files).flatMap(([fieldKey, entries]) =>
    entries.map((file) => ({ ...file, fieldKey, field_key: fieldKey }))
  );
  const sections = buildLiveOrderSections(form.definition, answers, flatFiles);

  return (
    <Card className="!rounded-[1.35rem]">
      <h2 className="text-3xl font-black text-[var(--olive-dark)]">مراجعة الطلب</h2>
      <p className="mt-2 text-[var(--muted)]">راجع كل اختيار وصورة مرجعية ومرفق قبل الإرسال. يمكنك الرجوع للتعديل دون فقدان البيانات.</p>
      <div className="mt-6">
        <OrderVisual sections={sections} />
      </div>
      {error ? <p className="mt-4 rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
      <div className="mt-6 grid gap-3">
        <Button className="min-h-12 w-full" size="lg" variant="secondary" onClick={onBack}>
          رجوع للتعديل
        </Button>
        <Button className="min-h-12 w-full" size="lg" disabled={pending || previewMode} onClick={onSubmit}>
          {pending ? <Loader2 className="inline animate-spin" size={16} /> : null}
          {previewMode ? "المعاينة لا ترسل طلباً" : pending ? "جاري الإرسال" : "تأكيد وإرسال الطلب"}
        </Button>
        <p className="text-center text-xs leading-6 text-[var(--muted)]">
          بإرسال الطلب، أؤكد صحة المعلومات وأوافق على استخدام البيانات والتصاميم المرفقة لغرض تجهيز الطلب.
        </p>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value, ltr }: { label: string; value: unknown; ltr?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/50 p-3">
      <dt className="text-sm font-bold text-[var(--muted)]">{label}</dt>
      <dd className={cn("mt-1 text-base font-black text-[var(--olive-dark)]", ltr && "ltr text-left")}>{String(value ?? "غير محدد")}</dd>
    </div>
  );
}
