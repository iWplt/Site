"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ImagePlus, Loader2, LockKeyhole, X } from "lucide-react";
import { Button, Card, FieldLabel, TextArea, TextInput } from "@/components/ui";
import { defaultWizardSteps, optionLabel } from "@/lib/form-definition";
import type { BookingFormRecord, FormField, FormSection } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  form: BookingFormRecord;
  studentName?: string;
};

type UploadedFile = {
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
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
  const [success, setSuccess] = useState<{ bookingNumber: string; studentName: string; submittedAt: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const sections = form.definition.sections;
  const isReview = step >= sections.length;

  const visibleFields = useMemo(() => sections[step]?.fields.filter((field) => fieldIsVisible(field, answers)) ?? [], [answers, sections, step]);

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
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function addFile(field: FormField, file: File) {
    const response = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldKey: field.key, fileName: file.name, mimeType: file.type, size: file.size })
    });
    const payload = await response.json();
    if (!response.ok) {
      setErrors((current) => ({ ...current, [field.key]: payload.error ?? "تعذر رفع الملف." }));
      return;
    }

    if (payload.signedUrl && payload.token) {
      await fetch(payload.signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false", "Content-Type": file.type },
        body: file
      });
    }

    const uploaded: UploadedFile = {
      path: payload.path,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      previewUrl: URL.createObjectURL(file)
    };
    setFiles((current) => ({ ...current, [field.key]: [uploaded] }));
  }

  async function submit() {
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
        bookingNumber: payload.bookingNumber ?? payload.booking_number,
        studentName: payload.studentName ?? payload.student_name,
        submittedAt: payload.submittedAt ?? payload.submitted_at
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
    <div className="mx-auto max-w-5xl">
      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[var(--gold)]">بطاقة حجز رقمية</p>
            <h1 className="mt-1 text-2xl font-black text-[var(--olive-dark)]">{form.name}</h1>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {defaultWizardSteps.map((label, index) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className={cn("h-2 w-8 rounded-full", index <= step ? "bg-[var(--olive)]" : "bg-[var(--sand)]")} />
                <span className="hidden text-[10px] text-[var(--muted)] sm:block">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {isReview ? (
        <ReviewStep sections={sections} answers={answers} files={files} onBack={() => setStep(sections.length - 1)} onSubmit={submit} pending={isPending} />
      ) : (
        <Card>
          <p className="text-sm font-bold text-[var(--gold)]">الخطوة {step + 1} من {sections.length}</p>
          <h2 className="mt-1 text-3xl font-black text-[var(--olive-dark)]">{sections[step].title}</h2>
          {sections[step].description ? <p className="mt-2 text-[var(--muted)]">{sections[step].description}</p> : null}
          <div className="mt-8 grid gap-6">
            {visibleFields.map((field) => (
              <FieldRenderer key={field.id} field={field} value={answers[field.key]} files={files[field.key] ?? []} error={errors[field.key]} onChange={(value) => setAnswer(field.key, value)} onFile={(file) => addFile(field, file)} onRemoveFile={() => setFiles((current) => ({ ...current, [field.key]: [] }))} />
            ))}
          </div>
          {errors.form ? <p className="mt-4 rounded-2xl bg-[#9d2f2f12] p-3 text-sm font-bold text-[var(--danger)]">{errors.form}</p> : null}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>رجوع</Button>
            <Button onClick={() => validateStep() && setStep((current) => current + 1)}>التالي</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  files,
  error,
  onChange,
  onFile,
  onRemoveFile
}: {
  field: FormField;
  value: unknown;
  files: UploadedFile[];
  error?: string;
  onChange: (value: unknown) => void;
  onFile: (file: File) => void;
  onRemoveFile: () => void;
}) {
  return (
    <div>
      <FieldLabel required={field.required}>{field.label}</FieldLabel>
      {field.description ? <p className="mb-3 text-sm leading-7 text-[var(--muted)]">{field.description}</p> : null}
      {field.locked ? <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#3f472d12] px-3 py-1 text-xs font-bold text-[var(--olive)]"><LockKeyhole size={13} /> خيار مقفل من الإدارة</p> : null}
      {field.type === "read_only" ? <div className="rounded-2xl border border-[var(--border)] bg-[#3f472d0d] px-4 py-3 font-bold">{String(value ?? "")}</div> : null}
      {field.type === "short_text" || field.type === "phone" || field.type === "number" ? (
        <TextInput type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder} value={String(value ?? "")} disabled={field.locked} onChange={(event) => onChange(event.target.value)} />
      ) : null}
      {field.type === "long_text" ? <TextArea placeholder={field.placeholder} value={String(value ?? "")} disabled={field.locked} onChange={(event) => onChange(event.target.value)} /> : null}
      {field.type === "boolean" ? (
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((entry) => (
            <button key={String(entry)} type="button" onClick={() => onChange(entry)} className={cn("rounded-2xl border p-4 font-bold", value === entry ? "border-[var(--olive)] bg-[#3f472d12]" : "border-[var(--border)] bg-white/70")}>{entry ? "نعم" : "لا"}</button>
          ))}
        </div>
      ) : null}
      {["radio", "select", "image_choice"].includes(field.type) && field.options ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {field.options.map((option) => {
            const optionChildren = option.children?.length ? option.children : [option];
            return optionChildren.map((child) => {
              const label = child.id === option.id ? child.label : `${option.label} - ${child.label}`;
              return (
                <button key={child.id} type="button" disabled={field.locked} onClick={() => onChange(child.value)} className={cn("rounded-3xl border bg-white/70 p-4 text-right transition hover:border-[var(--olive)]", value === child.value ? "border-[var(--olive)] ring-4 ring-[#3f472d14]" : "border-[var(--border)]")}>
                  <span className="font-black text-[var(--olive-dark)]">{label}</span>
                  {child.description ? <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">{child.description}</span> : null}
                </button>
              );
            });
          })}
        </div>
      ) : null}
      {["image_upload", "file_upload"].includes(field.type) ? (
        <div className="rounded-3xl border border-dashed border-[var(--olive)] bg-white/55 p-5">
          {files[0] ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {files[0].previewUrl ? <img src={files[0].previewUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <ImagePlus />}
                <div>
                  <p className="font-bold">{files[0].originalName}</p>
                  <p className="text-xs text-[var(--muted)]">{Math.round(files[0].size / 1024)} KB</p>
                </div>
              </div>
              <button type="button" onClick={onRemoveFile} className="rounded-full bg-[#9d2f2f12] p-2 text-[var(--danger)]"><X size={18} /></button>
            </div>
          ) : (
            <label className="grid cursor-pointer place-items-center gap-3 text-center">
              <ImagePlus className="text-[var(--olive)]" />
              <span className="font-bold">اضغط لاختيار صورة أو ملف من الهاتف</span>
              <input type="file" accept={field.accept?.join(",")} className="hidden" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} />
            </label>
          )}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

function ReviewStep({
  sections,
  answers,
  files,
  pending,
  onBack,
  onSubmit
}: {
  sections: FormSection[];
  answers: Record<string, unknown>;
  files: Record<string, UploadedFile[]>;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <h2 className="text-3xl font-black text-[var(--olive-dark)]">مراجعة طلبك</h2>
      <p className="mt-2 text-[var(--muted)]">تأكد من الاختيارات قبل إرسال الحجز النهائي.</p>
      <div className="mt-8 grid gap-5">
        {sections.map((section) => (
          <div key={section.id} className="rounded-3xl bg-white/55 p-5">
            <h3 className="mb-4 font-black text-[var(--olive)]">{section.title}</h3>
            <dl className="grid gap-3">
              {section.fields.filter((field) => fieldIsVisible(field, answers)).map((field) => (
                <SummaryRow key={field.id} label={field.label} value={files[field.key]?.[0]?.originalName ?? optionLabel(field.options, answers[field.key])} />
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={onBack}>رجوع للتعديل</Button>
        <Button disabled={pending} onClick={onSubmit}>{pending ? <Loader2 className="inline animate-spin" size={16} /> : null} تأكيد وإرسال الطلب</Button>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value, ltr }: { label: string; value: unknown; ltr?: boolean }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-[var(--border)] bg-white/50 p-3 sm:grid-cols-[180px_1fr]">
      <dt className="text-sm font-bold text-[var(--muted)]">{label}</dt>
      <dd className={cn("font-black text-[var(--olive-dark)]", ltr && "ltr text-left")}>{String(value ?? "غير محدد")}</dd>
    </div>
  );
}
