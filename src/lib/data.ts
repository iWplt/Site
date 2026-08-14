import "server-only";

import { demoBatch, demoForm, demoStudents, demoSubmissions } from "@/lib/demo-data";
import { defaultWarkaFormDefinition } from "@/lib/form-definition";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth";
import type { Batch, BookingFormRecord, StudentWithState, SubmissionSummary } from "@/lib/types";

export async function listBatches(user?: AppUser): Promise<Batch[]> {
  const supabase = await createClient();
  if (!supabase) return [demoBatch];

  let query = supabase
    .from("batches")
    .select("id, name, university, college, department, stage, graduation_year, description, representative_id, status, created_at, updated_at");

  if (user?.role === "REPRESENTATIVE") query = query.eq("representative_id", user.id);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listStudents(user?: AppUser, search?: string): Promise<StudentWithState[]> {
  const supabase = await createClient();
  if (!supabase) {
    const needle = search?.trim();
    return needle ? demoStudents.filter((student) => student.full_name.includes(needle)) : demoStudents;
  }

  let query = supabase
    .from("student_overview")
    .select("*")
    .order("full_name", { ascending: true })
    .limit(100);

  if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,booking_number.ilike.%${search}%`);
  if (user?.role === "REPRESENTATIVE") query = query.eq("representative_id", user.id);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listForms(user?: AppUser): Promise<BookingFormRecord[]> {
  const supabase = await createClient();
  if (!supabase) return [demoForm];

  let query = supabase.from("booking_forms").select("*").order("created_at", { ascending: false });
  if (user?.role === "REPRESENTATIVE") query = query.eq("status", "published");

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((form) => ({
    ...form,
    definition: form.definition ?? defaultWarkaFormDefinition
  }));
}

export async function getPublicForm(slug: string): Promise<BookingFormRecord | null> {
  const supabase = await createClient();
  if (!supabase) return slug === demoForm.slug ? demoForm : null;

  const { data, error } = await supabase
    .from("booking_forms")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    definition: data.definition ?? defaultWarkaFormDefinition
  };
}

export async function listSubmissions(user?: AppUser): Promise<SubmissionSummary[]> {
  const supabase = await createClient();
  if (!supabase) return demoSubmissions;

  let query = supabase.from("submission_overview").select("*").order("submitted_at", { ascending: false });
  if (user?.role === "REPRESENTATIVE") query = query.eq("representative_id", user.id);

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function createDefaultFormIfNeeded() {
  const admin = createAdminClient();
  const { data } = await admin.from("booking_forms").select("id").eq("slug", demoForm.slug).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await admin
    .from("booking_forms")
    .insert({
      name: demoForm.name,
      internal_description: demoForm.internal_description,
      slug: demoForm.slug,
      type: demoForm.type,
      status: "draft",
      definition: defaultWarkaFormDefinition
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}
