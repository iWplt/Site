-- Student customization permission policy (Owner ceiling + Rep gate)
-- and per-student overrides. Does not alter product/outfit definitions.

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS student_permission_policy jsonb NOT NULL DEFAULT jsonb_build_object(
    'allowRepresentativesToConfigure', false,
    'defaults', jsonb_build_object(
      'allowAdditions', true,
      'allowEmbroidery', true,
      'allowColors', true,
      'allowDesignUploads', true,
      'allowNotes', true
    )
  );

ALTER TABLE public.booking_forms
  ADD COLUMN IF NOT EXISTS student_permission_policy jsonb NOT NULL DEFAULT jsonb_build_object(
    'allowRepresentativesToConfigure', false,
    'defaults', jsonb_build_object(
      'allowAdditions', true,
      'allowEmbroidery', true,
      'allowColors', true,
      'allowDesignUploads', true,
      'allowNotes', true
    )
  );

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS customization_permissions jsonb NULL;
