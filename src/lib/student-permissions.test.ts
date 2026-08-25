import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStudentPermissionsToDefinition,
  unauthorizedPermissionErrors
} from "./apply-student-permissions.ts";
import {
  clampOverrideToCeiling,
  DEFAULT_STUDENT_PERMISSIONS,
  DEFAULT_STUDENT_PERMISSION_POLICY,
  normalizeStudentPermissionPolicy,
  representativeMayConfigurePermissions,
  resolveStudentPermissions,
  type StudentCustomizationPermissions
} from "./student-permissions.ts";
import type { FormDefinition } from "./types.ts";

function sampleDefinition(): FormDefinition {
  return {
    id: "def-1",
    version: 1,
    name: "اختبار",
    type: "BATCH",
    sections: [
      {
        id: "s1",
        title: "تخصيص",
        fields: [
          {
            id: "f-add",
            key: "robe_addition",
            label: "إضافة",
            type: "radio",
            required: false,
            options: [{ id: "a1", value: "yes", label: "نعم", enabled: true }]
          },
          {
            id: "f-emb",
            key: "name_embroidery",
            label: "تطريز",
            type: "text",
            required: false
          },
          {
            id: "f-color",
            key: "robe_color",
            label: "لون",
            type: "radio",
            required: false,
            options: [{ id: "c1", value: "black", label: "أسود", enabled: true }]
          },
          {
            id: "f-up",
            key: "design_images",
            label: "تصميم",
            type: "image_upload",
            required: true
          },
          {
            id: "f-notes",
            key: "student_notes",
            label: "ملاحظات",
            type: "textarea",
            required: false
          },
          {
            id: "f-products",
            key: "selected_products",
            label: "منتجات",
            type: "checkbox",
            required: false
          },
          {
            id: "f-outfit",
            key: "full_outfit_id",
            label: "زي",
            type: "radio",
            required: false
          }
        ]
      }
    ]
  };
}

test("representative cannot configure when Owner disallows", () => {
  const policy = normalizeStudentPermissionPolicy({
    allowRepresentativesToConfigure: false,
    defaults: DEFAULT_STUDENT_PERMISSIONS
  });
  assert.equal(representativeMayConfigurePermissions(policy), false);
});

test("representative can configure when Owner allows", () => {
  const policy = normalizeStudentPermissionPolicy({
    allowRepresentativesToConfigure: true,
    defaults: DEFAULT_STUDENT_PERMISSIONS
  });
  assert.equal(representativeMayConfigurePermissions(policy), true);
});

test("rep clamp cannot grant above Owner ceiling", () => {
  const ceiling: StudentCustomizationPermissions = {
    ...DEFAULT_STUDENT_PERMISSIONS,
    allowAdditions: false,
    allowNotes: false
  };
  const clamped = clampOverrideToCeiling(ceiling, {
    allowAdditions: true,
    allowNotes: true,
    allowColors: true
  });
  assert.equal(clamped.allowAdditions, false);
  assert.equal(clamped.allowNotes, false);
  assert.equal(clamped.allowColors, true);
});

test("per-student override restricts within ceiling", () => {
  const policy = {
    ...DEFAULT_STUDENT_PERMISSION_POLICY,
    defaults: { ...DEFAULT_STUDENT_PERMISSIONS, allowAdditions: true, allowEmbroidery: true }
  };
  const effective = resolveStudentPermissions({
    policy,
    override: { allowAdditions: false, allowEmbroidery: true },
    allowAboveCeiling: false
  });
  assert.equal(effective.allowAdditions, false);
  assert.equal(effective.allowEmbroidery, true);
});

test("owner override may enable above default ceiling", () => {
  const policy = {
    ...DEFAULT_STUDENT_PERMISSION_POLICY,
    defaults: { ...DEFAULT_STUDENT_PERMISSIONS, allowAdditions: false }
  };
  const effective = resolveStudentPermissions({
    policy,
    override: { allowAdditions: true },
    allowAboveCeiling: true
  });
  assert.equal(effective.allowAdditions, true);
});

test("locked customization fields become locked in definition; product membership untouched", () => {
  const definition = sampleDefinition();
  const permissions: StudentCustomizationPermissions = {
    ...DEFAULT_STUDENT_PERMISSIONS,
    allowAdditions: false,
    allowDesignUploads: false
  };
  const next = applyStudentPermissionsToDefinition(definition, permissions);
  const fields = next.sections[0].fields;
  assert.equal(fields.find((f) => f.key === "robe_addition")?.locked, true);
  assert.equal(fields.find((f) => f.key === "design_images")?.locked, true);
  assert.equal(fields.find((f) => f.key === "design_images")?.required, false);
  assert.equal(fields.find((f) => f.key === "selected_products")?.locked, undefined);
  assert.equal(fields.find((f) => f.key === "full_outfit_id")?.locked, undefined);
  assert.equal(fields.find((f) => f.key === "robe_color")?.locked, undefined);
});

test("server rejects unauthorized customization answers and uploads", () => {
  const definition = sampleDefinition();
  const permissions: StudentCustomizationPermissions = {
    ...DEFAULT_STUDENT_PERMISSIONS,
    allowAdditions: false,
    allowDesignUploads: false,
    allowNotes: false
  };
  const errors = unauthorizedPermissionErrors(
    definition,
    permissions,
    { robe_addition: "yes", student_notes: "hi" },
    { design_images: [{ id: "x" }] }
  );
  assert.ok(errors.robe_addition);
  assert.ok(errors.student_notes);
  assert.ok(errors.design_images);
});

test("permissions never unlock product membership keys", () => {
  const definition = sampleDefinition();
  const permissions: StudentCustomizationPermissions = {
    allowAdditions: false,
    allowEmbroidery: false,
    allowColors: false,
    allowDesignUploads: false,
    allowNotes: false
  };
  const errors = unauthorizedPermissionErrors(
    definition,
    permissions,
    { selected_products: ["robe"], full_outfit_id: "royal" },
    {}
  );
  assert.equal(errors.selected_products, undefined);
  assert.equal(errors.full_outfit_id, undefined);
});
