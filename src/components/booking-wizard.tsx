"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Loader2, LockKeyhole } from "lucide-react";
import { MultipleImageUpload, type UploadedFile } from "@/components/multiple-image-upload";
import { Button, Card, FieldLabel, TextArea, TextInput } from "@/components/ui";
import { defaultWizardSteps, optionLabel } from "@/lib/form-definition";
import type { BookingFormRecord, FormField, FormSection } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  form: BookingFormRecord;
  studentName?: string;
};

function fieldIsVisible(field: FormField, answers: Record<string, unknown>) {
  if (!field.conditional?.length) return true;
  return field.conditional.every((rule) => {
    const current = answers[rule.fieldKey];
    if (rule.operator === "truthy") return Boolean(current);
    if (rule.operator === "equals") return current === rule.value;
    if (rule.operator === "not_equals") return current !== rule.value;
    if (rule.operator === "includes") return String(current ?? "").includes(String(rule.value));
    return true;
  });
}

export function BookingWizard({ form, studentName }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = { student_name: studentName };
    form.definition.sections.forEach((section) =>
      section.fields.forEach((field) => {
        if (field.defaultValue !== undefined) initial[field.key] = field.defaultValue;
      })
    );
    return initial;
  });
  const [files, setFiles] = useState<Record<string, UploadedFile[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ bookingNumber: string; studentName: string; submittedAt: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const sections = form.definition.sections;
  const isReview = step >= sections.length;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const visibleFields = useMemo(
    () => sections[step]?.fields.filter((field) => fieldIsVisible(field, answers)) ?? [],
    [answers, sections, step]
  );

  function setAnswer(key: string, value: unknown) {
    setAnswers((current) => ({ ...current, [key]: value }));
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
      if (field.required && (value === undefined || value === null || value === "")) {
        nextErrors[field.key] = "هذا الحقل مطلوب.";
      }
      if (field.type === "phone" && value && !/^(\+?964|0)?7[0-9\s-]{8,12}$/.test(String(value))) {
        nextErrors[field.key] = "يرجى إدخال رقم هاتف عراقي صحيح.";
      }
      if (["image_upload", "file_upload"].includes(field.type) && field.required && !(files[field.key]?.length)) {
        nextErrors[field.key] = "يرجى إرفاق صورة واحدة على الأقل.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function submit() {
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
        submittedAt: payload.submittedAt
      });
    });
  }

  if (success) {
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#386a3d16] text-[var(--success)]">
          <Check size={30} />
        </div>
        <h1 className="text-3xl font-black text-[var(--olive-dark)]">تم استلام حجزك بنجاح</h1>
        <p className="mt-3 text-[var(--muted)]">تم حفظ حجزك بنجاح، ولا يمكن استخدام رمز الحجز مرة أخرى بعد إرسال الطلب.</p>
        <dl className="mt-8 grid gap-3 rounded-3xl bg-white/60 p-5 text-right">
          <SummaryRow label="رقم الحجز" value={success.bookingNumber} ltr />
          <SummaryRow label="الطالب" value={success.studentName} />
          <SummaryRow label="الحالة" value="تم الاستلام" />
          <SummaryRow label="وقت الإرسال" value={new Date(success.submittedAt).toLocaleString("ar-IQ")} />
        </dl>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <Card className="mb-4 !rounded-[1.5rem] !p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[var(--gold)]">بطاقة حجز رقمية</p>
            <h1 className="mt-1 text-xl font-black leading-8 text-[var(--olive-dark)] sm:text-2xl">{form.name}</h1>
          </div>
          <div className="rounded-2xl bg-[#3f472d12] px-3 py-2 text-center">
            <p className="text-[10px] font-bold text-[var(--muted)]">الخطوة</p>
            <p className="text-lg font-black text-[var(--olive)]">
              {Math.min(step + 1, sections.length + 1)}/{sections.length + 1}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {defaultWizardSteps.map((label, index) => (
            <div key={label} className="min-w-0 flex-1">
              <div className={cn("h-1.5 rounded-full", index <= step ? "bg-[var(--olive)]" : "bg-[var(--sand)]")} />
              <p className="mt-1 truncate text-[10px] font-bold text-[var(--muted)]">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      {isReview ? (
        <ReviewStep
          sections={sections}
          answers={answers}
          files={files}
          pending={isPending}
          onBack={() => setStep(sections.length - 1)}
          onSubmit={submit}
          onPreview={setLightbox}
          error={errors.form}
        />
      ) : (
        <Card className="!rounded-[1.5rem]">
          <p className="text-sm font-bold text-[var(--gold)]">{sections[step].title}</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--olive-dark)] sm:text-3xl">{defaultWizardSteps[step]}</h2>
          {sections[step].description ? <p className="mt-2 text-base leading-8 text-[var(--muted)]">{sections[step].description}</p> : null}
          <div className="mt-6 grid gap-5">
            {visibleFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={answers[field.key]}
                files={files[field.key] ?? []}
                error={errors[field.key]}
                onChange={(value) => setAnswer(field.key, value)}
                onFiles={(next) => setFiles((current) => ({ ...current, [field.key]: next }))}
              />
            ))}
          </div>
        </Card>
      )}

      {!isReview ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[rgba(246,239,225,0.96)] p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-3">
            <Button className="min-h-12 flex-1" variant="secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              رجوع
            </Button>
            <Button className="min-h-12 flex-1" onClick={() => validateStep() && setStep((current) => current + 1)}>
              التالي
            </Button>
          </div>
        </div>
      ) : null}

      {lightbox ? (
        <button type="button" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
        </button>
      ) : null}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  files,
  error,
  onChange,
  onFiles
}: {
  field: FormField;
  value: unknown;
  files: UploadedFile[];
  error?: string;
  onChange: (value: unknown) => void;
  onFiles: (files: UploadedFile[]) => void;
}) {
  return (
    <div>
      <FieldLabel required={field.required}>{field.label}</FieldLabel>
      {field.description ? <p className="mb-3 text-sm leading-7 text-[var(--muted)]">{field.description}</p> : null}
      {field.locked ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#3f472d12] px-3 py-1 text-xs font-bold text-[var(--olive)]">
          <LockKeyhole size={13} /> خيار مقفل من الإدارة
        </p>
      ) : null}
      {field.type === "read_only" ? <div className="rounded-2xl border border-[var(--border)] bg-[#3f472d0d] px-4 py-3 text-base font-bold">{String(value ?? "")}</div> : null}
      {field.type === "short_text" || field.type === "phone" || field.type === "number" ? (
        <TextInput
          type={field.type === "number" ? "number" : "text"}
          inputMode={field.type === "phone" ? "tel" : undefined}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          disabled={field.locked}
          className="min-h-12 text-base"
          onChange={(event) => onChange(event.target.value)}
        />
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
      {["radio", "select", "image_choice"].includes(field.type) && field.options ? (
        <div
          className={cn(
            "grid gap-3",
            field.showOptionImages || field.type === "image_choice" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          )}
        >
          {field.options
            .filter((option) => option.enabled !== false)
            .flatMap((option) => {
              const optionChildren = (option.children?.length ? option.children : [option]).filter(
                (child) => child.enabled !== false
              );
              return optionChildren.map((child) => {
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
                      "overflow-hidden rounded-3xl border bg-white text-right transition",
                      selected ? "border-[var(--olive)] ring-4 ring-[#3f472d14]" : "border-[var(--border)]",
                      field.locked && "opacity-90"
                    )}
                  >
                    {showImages ? (
                      image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt={child.imageAlt || label}
                          className="aspect-[4/3] w-full bg-[#3f472d08] object-contain p-2"
                        />
                      ) : (
                        <div className="grid aspect-[4/3] place-items-center bg-[#3f472d08] px-4 text-center text-sm font-bold text-[var(--muted)]">
                          لم تتم إضافة صورة
                        </div>
                      )
                    ) : null}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-base font-black text-[var(--olive-dark)]">{label}</span>
                        <span
                          className={cn(
                            "mt-1 h-5 w-5 shrink-0 rounded-full border-2",
                            selected ? "border-[var(--olive)] bg-[var(--olive)]" : "border-[var(--border)]"
                          )}
                        />
                      </div>
                      {child.description ? (
                        <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">{child.description}</span>
                      ) : null}
                    </div>
                  </button>
                );
              });
            })}
        </div>
      ) : null}
      {["image_upload", "file_upload"].includes(field.type) ? (
        <MultipleImageUpload
          fieldKey={field.key}
          label={field.label}
          accept={field.accept}
          multiple={field.uploadMode === "multiple"}
          maxFiles={field.uploadMode === "multiple" ? field.maxFiles ?? 5 : 1}
          value={files}
          onChange={onFiles}
          error={error}
        />
      ) : null}
      {error && !["image_upload", "file_upload"].includes(field.type) ? <p className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

function ReviewStep({
  sections,
  answers,
  files,
  pending,
  onBack,
  onSubmit,
  onPreview,
  error
}: {
  sections: FormSection[];
  answers: Record<string, unknown>;
  files: Record<string, UploadedFile[]>;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onPreview: (url: string) => void;
  error?: string;
}) {
  return (
    <Card className="!rounded-[1.5rem]">
      <h2 className="text-3xl font-black text-[var(--olive-dark)]">مراجعة طلبك</h2>
      <p className="mt-2 text-[var(--muted)]">تأكد من الاختيارات قبل إرسال الحجز النهائي.</p>
      <div className="mt-6 grid gap-4">
        {sections.map((section) => (
          <div key={section.id} className="rounded-3xl bg-white/55 p-4">
            <h3 className="mb-3 font-black text-[var(--olive)]">{section.title}</h3>
            <dl className="grid gap-3">
              {section.fields.filter((field) => fieldIsVisible(field, answers)).map((field) => (
                <div key={field.id}>
                  {["image_upload", "file_upload"].includes(field.type) ? (
                    <div>
                      <p className="mb-2 text-sm font-bold text-[var(--muted)]">{field.label}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(files[field.key] ?? []).map((file) => (
                          <button key={file.path} type="button" onClick={() => onPreview(file.previewUrl ?? file.path)} className="overflow-hidden rounded-xl border border-[var(--border)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={file.previewUrl ?? file.path} alt="" className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                        {!files[field.key]?.length ? <p className="text-sm text-[var(--muted)]">لا توجد صور</p> : null}
                      </div>
                    </div>
                  ) : (
                    <SummaryRow label={field.label} value={optionLabel(field.options, answers[field.key])} />
                  )}
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {error ? <p className="mt-4 rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
      <div className="mt-6 grid gap-3">
        <Button className="min-h-12 w-full" variant="secondary" onClick={onBack}>
          رجوع للتعديل
        </Button>
        <Button className="min-h-12 w-full" disabled={pending} onClick={onSubmit}>
          {pending ? <Loader2 className="inline animate-spin" size={16} /> : null} تأكيد وإرسال الطلب
        </Button>
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
