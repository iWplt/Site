export type Role = "OWNER" | "REPRESENTATIVE";

export type AppUser = {
  id: string;
  email?: string;
  role: Role;
  fullName: string;
  batchIds?: string[];
};
export type BatchStatus = "draft" | "active" | "closed" | "archived";
export type FormType = "BATCH" | "INDIVIDUAL";
export type FormStatus = "draft" | "published" | "closed" | "archived";
export type AccessCodeStatus = "ACTIVE" | "USED" | "DISABLED" | "EXPIRED";
export type OrderStatus =
  | "SUBMITTED"
  | "REVIEWED"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type FieldType =
  | "short_text"
  | "long_text"
  | "phone"
  | "number"
  | "radio"
  | "checkbox"
  | "select"
  | "image_upload"
  | "file_upload"
  | "image_choice"
  | "read_only"
  | "info"
  | "section"
  | "boolean";

export type ConditionalRule = {
  fieldKey: string;
  operator: "equals" | "not_equals" | "includes" | "truthy";
  value?: string | boolean | number;
};

export type FormOption = {
  id: string;
  label: string;
  value: string;
  description?: string;
  /** Resolved display URL (signed Storage URL or local /warka/... path). */
  imageUrl?: string;
  /** Durable Supabase Storage path / local relative path for Owner reference image. */
  imagePath?: string;
  imageAlt?: string;
  enabled?: boolean;
  children?: FormOption[];
};

export type FormField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: FormOption[];
  /** When true, choice fields render Owner option reference images (or placeholders). */
  showOptionImages?: boolean;
  defaultValue?: unknown;
  locked?: boolean;
  accept?: string[];
  maxSizeMb?: number;
  uploadMode?: "single" | "multiple";
  maxFiles?: number;
  conditional?: ConditionalRule[];
};

export type BatchStats = {
  total: number;
  submitted: number;
  pending: number;
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
};

export type FormDefinition = {
  id: string;
  version: number;
  name: string;
  type: FormType;
  sections: FormSection[];
};

export type Batch = {
  id: string;
  name: string;
  university: string;
  college: string;
  department: string;
  stage: string;
  graduation_year: number;
  status: BatchStatus;
  description?: string;
  representative_name?: string;
  representative_id?: string;
  created_at: string;
  updated_at: string;
};

export type Student = {
  id: string;
  batch_id: string | null;
  full_name: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type StudentWithState = Student & {
  batch?: Pick<Batch, "name" | "graduation_year">;
  code?: string;
  code_status?: AccessCodeStatus;
  submission_status?: "pending" | "submitted" | "reopened";
  order_status?: OrderStatus;
  booking_number?: string;
  form_slug?: string | null;
};

export type BookingFormRecord = {
  id: string;
  name: string;
  internal_description?: string;
  slug: string;
  type: FormType;
  status: FormStatus;
  batch_id?: string;
  opening_date?: string;
  closing_date?: string;
  definition: FormDefinition;
};

export type VerifiedBookingSession = {
  formId: string;
  slug: string;
  formType: FormType;
  studentId?: string;
  batchId?: string;
  accessCodeId?: string;
  studentName?: string;
  expiresAt: number;
};

export type SubmissionSummary = {
  id: string;
  booking_number: string;
  student_name: string;
  form_name: string;
  batch_name?: string;
  status: OrderStatus;
  submitted_at: string;
};

export type ImportPreviewRow = {
  rowNumber: number;
  rawValue: unknown;
  normalizedName: string;
  duplicateReason?: string;
  valid: boolean;
};

export type ExcelWorkbookPreview = {
  sheets: Array<{
    name: string;
    columns: Array<{ key: string; label: string; index: number }>;
    rows: Record<string, unknown>[];
    previewRows?: Record<string, unknown>[];
  }>;
};
