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

export type CoreProductId = "robe" | "sash" | "cap";

export type OutfitProductImage = {
  /** Durable Storage path or local /uploads/... path. */
  imagePath?: string;
  /** Resolved display URL (signed or public). */
  imageUrl?: string;
};

export type FullOutfit = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  imagePath?: string;
  enabled?: boolean;
  productOrder?: CoreProductId[];
  /** Outfit-specific images for assigned products. Does not change the global catalog. */
  productImages?: Partial<Record<CoreProductId, OutfitProductImage>>;
};

export type BookingMode = "full_set" | "single_pieces";

export type CatalogFormAssignment = {
  bookingModes?: BookingMode[];
  sortOrder?: number;
  hidden?: boolean;
};

export type OutfitConfig = {
  fullOutfits: FullOutfit[];
  singleItemEnabled: boolean;
  singleItemProducts: CoreProductId[];
  productOrder: CoreProductId[];
  catalogAssignments?: Record<string, CatalogFormAssignment>;
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
  catalogProductId?: string;
  priceIqd?: number | null;
  categorySlug?: string;
  categoryName?: string;
  bookingModes?: Array<"full_set" | "single_pieces">;
};

export type ProductAvailabilityScope = "all" | "individual" | "batches" | "forms";

export type ProductAvailability = {
  id: string;
  product_id: string;
  scope: ProductAvailabilityScope;
  batch_id?: string | null;
  form_id?: string | null;
};

export type ProductCategory = {
  id: string;
  slug: string;
  name_ar: string;
  name_en?: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type CatalogProduct = {
  id: string;
  category_id: string;
  category?: ProductCategory;
  name_ar: string;
  name_en?: string | null;
  description?: string | null;
  price_iqd?: number | null;
  image_path?: string | null;
  image_url?: string | null;
  active: boolean;
  archived: boolean;
  sort_order: number;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  availability: ProductAvailability[];
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
  outfitConfig?: OutfitConfig;
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
  created_at?: string;
  updated_at?: string;
};

export type FormSummary = {
  id: string;
  name: string;
  internal_description?: string;
  slug: string;
  type: FormType;
  status: FormStatus;
  batch_id?: string;
  batch_name?: string;
  opening_date?: string;
  closing_date?: string;
  created_at?: string;
  updated_at?: string;
  sectionCount: number;
  fieldCount: number;
  uploadCount: number;
  productOptionCount: number;
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
