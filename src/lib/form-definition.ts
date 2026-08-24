import type { FormDefinition, FormField, FormOption, FormSection } from "@/lib/types";

const robeOptions: FormOption[] = [
  { id: "robe-gulf", label: "الروب الخليجي", value: "gulf", description: "قصة فخمة ومناسبة للدفعات الرسمية.", imageUrl: "/warka/robe-gulf.webp" },
  { id: "robe-american", label: "الروب الأمريكي", value: "american", imageUrl: "/warka/robe-american.webp" },
  { id: "robe-korean", label: "الروب الكوري", value: "korean", imageUrl: "/warka/robe-korean.webp" },
  { id: "robe-cloche", label: "روب الكلوش", value: "cloche", imageUrl: "/warka/robe-cloche.webp" },
  { id: "robe-warka", label: "روب ورگة", value: "warka", imageUrl: "/warka/robe-warka.webp" },
  { id: "robe-indian", label: "الروب الهندي", value: "indian", imageUrl: "/warka/robe-indian.webp" }
];

const sashOptions: FormOption[] = [
  { id: "sash-normal", label: "وشاح عادي بدون ظهر", value: "normal_no_back", imageUrl: "/warka/sash-normal.webp" },
  {
    id: "sash-royal-ribbed",
    label: "وشاح ملكي - ظهر مضلع",
    value: "royal_ribbed",
    imageUrl: "/warka/sash-royal-ribbed.webp",
    children: [
      { id: "sash-royal-ribbed-plain", label: "ظهر سادة بدون تطريز", value: "royal_ribbed_plain", imageUrl: "/warka/sash-royal-ribbed.webp" },
      { id: "sash-royal-ribbed-embroidered", label: "ظهر مع تطريز", value: "royal_ribbed_embroidered", imageUrl: "/warka/sash-royal-ribbed.webp" }
    ]
  },
  {
    id: "sash-royal-triangle",
    label: "وشاح ملكي - ظهر مثلث",
    value: "royal_triangle",
    imageUrl: "/warka/sash-royal-triangle.webp",
    children: [
      { id: "sash-royal-triangle-plain", label: "ظهر سادة بدون تطريز", value: "royal_triangle_plain", imageUrl: "/warka/sash-royal-triangle.webp" },
      { id: "sash-royal-triangle-embroidered", label: "ظهر مع تطريز", value: "royal_triangle_embroidered", imageUrl: "/warka/sash-royal-triangle.webp" }
    ]
  },
  { id: "sash-side", label: "وشاح جانبي / مائل", value: "side_slanted", imageUrl: "/warka/sash-side.webp" }
];

const capOptions: FormOption[] = [
  { id: "cap-normal", label: "قبعة عادية", value: "normal", description: "لا تحتوي على مثلث من الأمام.", imageUrl: "/warka/cap-normal.webp" },
  { id: "cap-royal", label: "قبعة ملكية", value: "royal", description: "تحتوي على مثلث من الأمام.", imageUrl: "/warka/cap-royal.webp" },
  { id: "cap-tuxedo", label: "قبعة توكسيدو", value: "tuxedo", description: "تحتوي على قماش ستن من الأسفل.", imageUrl: "/warka/cap-tuxedo.webp" },
  { id: "cap-accent", label: "قبعة تطعيم", value: "accent", description: "تحتوي على تطعيم بلون الوشاح.", imageUrl: "/warka/cap-accent.webp" }
];

const imageUploadDefaults: Pick<FormField, "accept" | "maxSizeMb"> = {
  accept: ["image/jpeg", "image/png", "image/webp"],
  maxSizeMb: 8
};

export const defaultWarkaFormDefinition: FormDefinition = {
  id: "warka-default-graduation-form",
  version: 3,
  name: "بطاقة حجز WARKA الافتراضية",
  type: "BATCH",
  outfitConfig: {
    fullOutfits: [
      {
        id: "mix",
        name: "زي مكس",
        description: "روب + وشاح + قبعة مع كامل خيارات التخصيص.",
        enabled: true,
        productOrder: ["robe", "sash", "cap"]
      }
    ],
    singleItemEnabled: true,
    singleItemProducts: ["robe", "sash", "cap"],
    productOrder: ["robe", "sash", "cap"]
  },
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
        { id: "address", key: "address", label: "العنوان", type: "short_text", required: true, placeholder: "المدينة / المنطقة / أقرب نقطة دالة" },
        {
          id: "phone",
          key: "phone",
          label: "رقم الهاتف",
          type: "phone",
          required: true,
          placeholder: "07xx xxx xxxx"
        }
      ]
    },
    {
      id: "booking",
      title: "نوع الحجز",
      description: "اختر إن كان الطلب زياً كاملاً أو قطعاً منفردة.",
      fields: [
        {
          id: "booking_type",
          key: "booking_type",
          label: "نوع الحجز",
          type: "radio",
          required: true,
          defaultValue: "full_set",
          options: [
            { id: "full-set", label: "زي كامل", value: "full_set", description: "روب + وشاح + قبعة." },
            { id: "single-pieces", label: "حجز مفرد", value: "single_pieces", description: "طلب قطعة أو أكثر حسب الاختيار." }
          ]
        }
      ]
    },
    {
      id: "robe",
      title: "الروب",
      description: "اختر موديل الروب من الصور المرجعية المعتمدة.",
      fields: [
        {
          id: "robe_model",
          key: "robe_model",
          label: "موديل الروب",
          type: "image_choice",
          required: true,
          showOptionImages: true,
          options: robeOptions
        },
        {
          id: "robe_addition",
          key: "robe_addition",
          label: "إضافات الروب",
          type: "image_choice",
          showOptionImages: true,
          options: [
            { id: "none", label: "بدون إضافة", value: "none", description: "الروب بدون تطريز أو تطعيم إضافي." },
            { id: "one-sleeve", label: "تطريز ردن واحد", value: "one_sleeve", description: "تطريز على ردن واحد حسب التصميم المطلوب." },
            { id: "two-sleeves", label: "تطريز ردن 2", value: "two_sleeves", description: "تطريز على الردنين." },
            { id: "sleeve-color", label: "إضافة لون للردن 5 سم", value: "sleeve_color_5cm", description: "شريط لوني بعرض 5 سم على الردن." },
            { id: "sleeve-color-slit", label: "إضافة لون للردن + فتحة", value: "sleeve_color_slit", description: "إضافة لونية مع فتحة في الردن." }
          ],
          defaultValue: "none"
        },
        {
          ...imageUploadDefaults,
          id: "robe_addition_image",
          key: "robe_addition_image",
          label: "تصميم إضافة الروب",
          type: "image_upload",
          uploadMode: "multiple",
          maxFiles: 5,
          description: "ارفع تصميم التطريز/الإضافة المطلوبة على الروب.",
          conditional: [{ fieldKey: "robe_addition", operator: "not_equals", value: "none" }]
        }
      ]
    },
    {
      id: "sash",
      title: "الوشاح",
      description: "موديل الوشاح وتطريزه وتصميم الطالب واللون والملاحظات.",
      fields: [
        {
          id: "sash_type",
          key: "sash_type",
          label: "نوع الوشاح",
          type: "image_choice",
          required: true,
          showOptionImages: true,
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
          label: "تصميم ظهر الوشاح",
          type: "image_upload",
          uploadMode: "multiple",
          maxFiles: 5,
          description: "ارفع تصميم ظهر الوشاح عندما يكون الوشاح مع تطريز ظهر.",
          conditional: [{ fieldKey: "sash_type", operator: "includes", value: "embroidered" }]
        },
        {
          id: "sash_edge_embroidery",
          key: "sash_edge_embroidery",
          label: "تطريز حافة الوشاح (إطار للوشاح)",
          type: "boolean",
          defaultValue: false
        },
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
          label: "تصميم جهة السنة",
          type: "image_upload",
          uploadMode: "multiple",
          maxFiles: 5,
          description: "اختياري — ارفع تصميم جهة السنة إن وُجد."
        }
      ]
    },
    {
      id: "cap",
      title: "القبعة",
      description: "اختر نوع القبعة، ثم أرفق تصاميم التطريز المرتبطة بها إن لزم.",
      fields: [
        {
          id: "cap_type",
          key: "cap_type",
          label: "نوع القبعة",
          type: "image_choice",
          required: true,
          showOptionImages: true,
          options: capOptions
        },
        {
          id: "cap_elastic",
          key: "cap_elastic",
          label: "إضافة لاستيك خلف القبعة",
          type: "boolean",
          required: true,
          defaultValue: false
        },
        {
          ...imageUploadDefaults,
          id: "cap_side_image",
          key: "cap_side_image",
          label: "تطريز القبعة الجانبي",
          type: "image_upload",
          uploadMode: "multiple",
          maxFiles: 5,
          description: "اختياري — تصميم التطريز الجانبي للقبعة."
        },
        {
          ...imageUploadDefaults,
          id: "cap_top_image",
          key: "cap_top_image",
          label: "تطريز القبعة من الأعلى (المربع)",
          type: "image_upload",
          uploadMode: "multiple",
          maxFiles: 5,
          description: "اختياري — تصميم تطريز المربع العلوي للقبعة."
        }
      ]
    }
  ]
};

export const defaultWizardSteps = [
  "بيانات الطالب",
  "نوع الحجز",
  "الروب",
  "الوشاح",
  "القبعة",
  "مراجعة الطلب"
];

export function flattenFields(sections: FormSection[]) {
  return sections.flatMap((section) => section.fields);
}

export function findSelectedOption(options: FormOption[] | undefined, value: unknown): FormOption | undefined {
  if (!options || value === undefined || value === null || value === "") return undefined;
  for (const option of options) {
    if (option.value === value) return option;
    const child = option.children?.find((entry) => entry.value === value);
    if (child) {
      return {
        ...child,
        label: `${option.label} - ${child.label}`,
        imageUrl: child.imageUrl || option.imageUrl,
        imagePath: child.imagePath || option.imagePath,
        imageAlt: child.imageAlt || option.imageAlt || child.label
      };
    }
  }
  return undefined;
}

export function optionLabel(options: FormOption[] | undefined, value: unknown): string {
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (Array.isArray(value)) {
    return value
      .map((entry) => optionLabel(options, entry))
      .filter(Boolean)
      .join("، ");
  }
  const selected = findSelectedOption(options, value);
  if (selected) return selected.label;
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

export function fieldIsVisible(field: FormField, answers: Record<string, unknown>) {
  if (!field.conditional?.length) return true;
  return field.conditional.every((rule) => {
    const current = answers[rule.fieldKey];
    if (rule.operator === "truthy") {
      if (Array.isArray(current)) return current.length > 0;
      return Boolean(current);
    }
    if (rule.operator === "equals") {
      if (Array.isArray(current)) return current.map(String).includes(String(rule.value ?? ""));
      return current === rule.value;
    }
    if (rule.operator === "not_equals") {
      if (Array.isArray(current)) return !current.map(String).includes(String(rule.value ?? ""));
      return current !== rule.value;
    }
    if (rule.operator === "includes") {
      if (Array.isArray(current)) return current.map(String).includes(String(rule.value ?? ""));
      return String(current ?? "").includes(String(rule.value ?? ""));
    }
    return true;
  });
}
