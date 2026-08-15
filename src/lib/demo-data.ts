import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import type { Batch, BookingFormRecord, StudentWithState, SubmissionSummary } from "@/lib/types";

export { statusLabels } from "@/lib/labels";

const now = new Date("2026-08-14T03:27:00.000Z").toISOString();

export const demoBatch: Batch = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Cybersecurity 2027",
  university: "Al-Ayen University",
  college: "College of Engineering Technology",
  department: "Cybersecurity Engineering Technology",
  stage: "Fourth Stage",
  graduation_year: 2027,
  description: "دفعة تجريبية جاهزة لإدارة حجوزات WARKA.",
  representative_name: "ممثل الدفعة",
  status: "active",
  created_at: now,
  updated_at: now
};

export const demoForm: BookingFormRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "بطاقة حجز الأمن السيبراني 2027",
  internal_description: "نموذج دفعة تجريبي مبني على بطاقة WARKA الأصلية.",
  slug: "cybersecurity-2027",
  type: "BATCH",
  status: "published",
  batch_id: demoBatch.id,
  definition: defaultWarkaFormDefinition
};

export const demoStudents: StudentWithState[] = [
  {
    id: "33333333-3333-4333-8333-333333333331",
    batch_id: demoBatch.id,
    full_name: "علي المرتضى يوسف",
    phone: "07701234567",
    code: "583921",
    code_status: "ACTIVE",
    submission_status: "pending",
    order_status: undefined,
    created_at: now,
    updated_at: now,
    batch: { name: demoBatch.name, graduation_year: demoBatch.graduation_year }
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    batch_id: demoBatch.id,
    full_name: "مصطفى سامر محمد",
    phone: "07807654321",
    code: "945270",
    code_status: "USED",
    submission_status: "submitted",
    order_status: "SUBMITTED",
    booking_number: "WK-2027-00581",
    created_at: now,
    updated_at: now,
    batch: { name: demoBatch.name, graduation_year: demoBatch.graduation_year }
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    batch_id: demoBatch.id,
    full_name: "حسين علي جبار",
    phone: "07505555555",
    code: "128446",
    code_status: "DISABLED",
    submission_status: "pending",
    created_at: now,
    updated_at: now,
    batch: { name: demoBatch.name, graduation_year: demoBatch.graduation_year }
  }
];

export const demoSubmissions: SubmissionSummary[] = [
  {
    id: "44444444-4444-4444-8444-444444444441",
    booking_number: "WK-2027-00581",
    student_name: "مصطفى سامر محمد",
    form_name: demoForm.name,
    batch_name: demoBatch.name,
    status: "SUBMITTED",
    submitted_at: now
  }
];
