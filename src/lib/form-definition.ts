import type { FormDefinition, FormField, FormOption, FormSection } from "@/lib/types";

const robeOptions: FormOption[] = [
  { id: "robe-gulf", label: "الروب الخليجي", value: "gulf", description: "قصة فخمة ومناسبة للدفعات الرسمية." },
  { id: "robe-american", label: "الروب الأمريكي", value: "american" },
  { id: "robe-korean", label: "الروب الكوري", value: "korean" },
  { id: "robe-cloche", label: "روب الكلوش", value: "cloche" },
  { id: "robe-warka", label: "روب ورگة", value: "warka" },
  { id: "robe-indian", label: "الروب الهندي", value: "indian" }
];

const sashOptions: FormOption[] = [
  { id: "sash-normal", label: "وشاح عادي بدون ظهر", value: "normal_no_back" },
  {
    id: "sash-royal-ribbed",
    label: "وشاح ملكي - ظهر مضلع",
    value: "royal_ribbed",
    children: [
      { id: "sash-royal-ribbed-plain", label: "ظهر سادة بدون تطريز", value: "royal_ribbed_plain" },
      { id: "sash-royal-ribbed-embroidered", label: "ظهر مع تطريز", value: "royal_ribbed_embroidered" }
    ]
  },
  {
    id: "sash-royal-triangle",
    label: "وشاح ملكي - ظهر مثلث",
    value: "royal_triangle",
    children: [
      { id: "sash-royal-triangle-plain", label: "ظهر سادة بدون تطريز", value: "royal_triangle_plain" },
      { id: "sash-royal-triangle-embroidered", label: "ظهر مع تطريز", value: "royal_triangle_embroidered" }
    ]
  },
  { id: "sash-side", label: "وشاح جانبي / مائل", value: "side_slanted" }
];

const capOptions: FormOption[] = [
  { id: "cap-normal", label: "قبعة عادية", value: "normal", description: "لا تحتوي على مثلث من الأمام." },
  { id: "cap-royal", label: "قبعة ملكية", value: "royal", description: "تحتوي على مثلث من الأمام." },
  { id: "cap-tuxedo", label: "قبعة توكسيدو", value: "tuxedo", description: "تحتوي على قماش ستن من الأسفل." },
  { id: "cap-accent", label: "قبعة تطعيم", value: "accent", description: "تحتوي على تطعيم بلون الوشاح." }
];

const imageUploadDefaults: Pick<FormField, "accept" | "maxSizeMb"> = {
  accept: ["image/jpeg", "image/png", "image/webp"],
  maxSizeMb: 8
};

export const defaultWarkaFormDefinition: FormDefinition = {
  id: "warka-default-graduation-form",
  version: 1,
  name: "بطاقة حجز WARKA الافتراضية",
  type: "BATCH",
  sections: [
    {
      id: "student",
      title: "بيانات الطالب",
      description: "المعلومات الأساسية المطلوبة لإتمام الحجز.",
      fields: [
        {
          id: "student_name",
          key: "student_name",
          label: "اسم الطالب",
          type: "read_only",
          required: true,
          locked: true,
          description: "يتم عرض الاسم من رمز الحجز ولا يمكن تعديله في نموذج الدفعات."
        },
        { id: "address", key: "address", label: "العنوان", type: "short_text", required: true },
        {
          id: "phone",
          key: "phone",
          label: "رقم الهاتف",
          type: "phone",
          required: true,
          placeholder: "07xx xxx xxxx"
        },
        {
          id: "booking_type",
          key: "booking_type",
          label: "نوع الحجز",
          type: "radio",
          required: true,
          defaultValue: "full_set",
          options: [
            { id: "full-set", label: "زي كامل", value: "full_set" },
            { id: "single-pieces", label: "قطع منفردة", value: "single_pieces" }
          ]
        }
      ]
    },
    {
      id: "robe",
      title: "الروب",
      fields: [
        {
          id: "robe_model",
          key: "robe_model",
          label: "موديل الروب",
          type: "image_choice",
          required: true,
          options: robeOptions
        },
        {
          id: "robe_addition",
          key: "robe_addition",
          label: "إضافات الروب",
          type: "radio",
          options: [
            { id: "none", label: "بدون إضافة", value: "none" },
            { id: "one-sleeve", label: "تطريز ردن واحدة", value: "one_sleeve" },
            { id: "two-sleeves", label: "تطريز ردن 2", value: "two_sleeves" },
            { id: "sleeve-color", label: "إضافة لون للردن 5 سم", value: "sleeve_color_5cm" },
            { id: "sleeve-color-slit", label: "إضافة لون للردن + فتحة", value: "sleeve_color_slit" }
          ],
          defaultValue: "none"
        },
        {
          ...imageUploadDefaults,
          id: "robe_addition_image",
          key: "robe_addition_image",
          label: "إرفاق صورة نموذج الاختيار المطلوب",
          type: "image_upload",
          conditional: [{ fieldKey: "robe_addition", operator: "not_equals", value: "none" }]
        }
      ]
    },
    {
      id: "sash",
      title: "الوشاح",
      fields: [
        {
          id: "sash_type",
          key: "sash_type",
          label: "نوع الوشاح",
          type: "image_choice",
          required: true,
          options: sashOptions
        },
        {
          id: "sash_back_text",
          key: "sash_back_text",
          label: "تطريز ظهر الوشاح",
          type: "long_text",
          description: "كتابة النص المطلوب تطريزه في ظهر الوشاح أو تركه فارغاً في حال طلب بدون تطريز.",
          conditional: [{ fieldKey: "sash_type", operator: "includes", value: "embroidered" }]
        },
        {
          ...imageUploadDefaults,
          id: "sash_back_image",
          key: "sash_back_image",
          label: "صورة التصميم أو اللوكو المطلوب في ظهر الوشاح",
          type: "image_upload",
          conditional: [{ fieldKey: "sash_type", operator: "includes", value: "embroidered" }]
        },
        {
          id: "sash_edge_embroidery",
          key: "sash_edge_embroidery",
          label: "تطريز حافة الوشاح (إطار للوشاح)",
          type: "boolean",
          defaultValue: false
        }
      ]
    },
    {
      id: "embroidery",
      title: "التطريز",
      fields: [
        {
          id: "name_embroidery",
          key: "name_embroidery",
          label: "تطريز الاسم",
          type: "short_text",
          required: true,
          description: "كتابة الاسم المطلوب تطريزه مع اللقب، مثل: مهندس، دكتور...",
          placeholder: "م. علي أحمد"
        },
        {
          id: "year_side_embroidery",
          key: "year_side_embroidery",
          label: "تطريز جهة السنة",
          type: "short_text",
          description: "كتابة نوع التطريز المطلوب: سنة - اسم القسم - لوكو خاص"
        },
        {
          ...imageUploadDefaults,
          id: "year_side_image",
          key: "year_side_image",
          label: "إرفاق صورة التصميم المطلوب",
          type: "image_upload"
        }
      ]
    },
    {
      id: "cap",
      title: "القبعة",
      fields: [
        {
          id: "cap_type",
          key: "cap_type",
          label: "نوع القبعة",
          type: "image_choice",
          required: true,
          options: capOptions
        },
        {
          ...imageUploadDefaults,
          id: "cap_side_image",
          key: "cap_side_image",
          label: "تطريز القبعة الجانبي",
          type: "image_upload"
        },
        {
          ...imageUploadDefaults,
          id: "cap_top_image",
          key: "cap_top_image",
          label: "تطريز القبعة من الأعلى (المربع)",
          type: "image_upload"
        },
        {
          id: "cap_elastic",
          key: "cap_elastic",
          label: "إضافة لاستيك خلف القبعة",
          type: "boolean",
          required: true,
          defaultValue: false
        }
      ]
    }
  ]
};

export const defaultWizardSteps = ["بيانات الطالب", "الروب", "الوشاح", "التطريز", "القبعة", "مراجعة الطلب"];

export function flattenFields(sections: FormSection[]) {
  return sections.flatMap((section) => section.fields);
}

export function optionLabel(options: FormOption[] | undefined, value: unknown): string {
  if (!options) return String(value ?? "");
  for (const option of options) {
    if (option.value === value) return option.label;
    const child = option.children?.find((entry) => entry.value === value);
    if (child) return `${option.label} - ${child.label}`;
  }
  return String(value ?? "");
}
