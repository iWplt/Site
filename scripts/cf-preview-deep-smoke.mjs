import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const BASE = "http://127.0.0.1:8787";
const raw = readFileSync(".dev.vars", "utf8");
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const password = `CfPreview${crypto.randomInt(100000, 999999)}!`;
const email = `cf.preview.${Date.now()}@warka.invalid`;
const { data: created, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "CF Preview Owner" }
});
if (error) throw error;
await admin.from("profiles").upsert({
  id: created.user.id,
  full_name: "CF Preview Owner",
  role: "OWNER",
  email,
  disabled: false
});

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ email, password });
if (sErr) throw sErr;

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;
const cookie =
  cookieName +
  "=" +
  encodeURIComponent(
    JSON.stringify({
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
      expires_at: sess.session.expires_at,
      expires_in: sess.session.expires_in,
      token_type: sess.session.token_type,
      user: sess.session.user
    })
  );

async function html(path) {
  const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
  const text = await res.text();
  return { status: res.status, text, location: res.headers.get("location") || "" };
}

function has(text, needles) {
  return Object.fromEntries(needles.map((n) => [n, text.includes(n)]));
}

try {
  const formId = "f78de0d3-83bd-44b5-84ee-b99200c3323c";
  const { data: formRow } = await admin.from("booking_forms").select("definition").eq("id", formId).single();
  const def = formRow?.definition;
  const robeField = def?.fields?.find?.((f) => f.key === "robe_model") || def?.sections?.flatMap?.((s) => s.fields || []).find?.((f) => f.key === "robe_model");
  const optionId = robeField?.options?.[0]?.id || "missing-option";

  const formPage = await html(`/admin/forms/${formId}`);
  const settings = await html("/admin/settings");
  const products = await html("/admin/products");
  const publicForm = await html("/f/svsd3534-copy-0429");
  const preview = await html(`/admin/forms/${formId}/preview`);

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const fd = new FormData();
  fd.set("kind", "option");
  fd.set("formId", formId);
  fd.set("fieldKey", "robe_model");
  fd.set("optionId", optionId);
  fd.set("file", new Blob([png], { type: "image/png" }), "pixel.png");
  const uploadRes = await fetch(`${BASE}/api/uploads/admin`, { method: "POST", headers: { cookie }, body: fd });
  const uploadBody = await uploadRes.text();

  // Student upload route without booking session should fail controlled
  const studentFd = new FormData();
  studentFd.set("file", new Blob([png], { type: "image/png" }), "student.png");
  const studentUpload = await fetch(`${BASE}/api/uploads/sign`, {
    method: "POST",
    headers: { cookie },
    body: studentFd
  });
  const studentBody = await studentUpload.text();

  const checks = {
    formEditor: {
      status: formPage.status,
      ...has(formPage.text, [
        "منتجات النموذج",
        "الأزياء",
        "زي كامل",
        "قطع منفردة",
        "اختيار متعدد",
        "الطول",
        "مقاس اللبس",
        "رفع صورة"
      ])
    },
    settings: {
      status: settings.status,
      supabaseLabel: settings.text.includes("Supabase (production source of truth)"),
      localForbiddenMention: settings.text.includes(".data/warka-db.json")
    },
    productsCatalog: {
      status: products.status,
      ok: products.status === 200
    },
    publicForm: {
      status: publicForm.status,
      ...has(publicForm.text, ["زي كامل", "قطع منفردة", "الروب", "الوشاح"])
    },
    preview: { status: preview.status },
    adminUpload: {
      status: uploadRes.status,
      ok: uploadRes.status >= 200 && uploadRes.status < 500,
      bodySnippet: uploadBody.slice(0, 300),
      optionId
    },
    studentUpload: {
      status: studentUpload.status,
      ok: studentUpload.status >= 400 && studentUpload.status < 500,
      bodySnippet: studentBody.slice(0, 200)
    }
  };

  console.log(JSON.stringify(checks, null, 2));
} finally {
  await admin.from("profiles").delete().eq("id", created.user.id);
  await admin.auth.admin.deleteUser(created.user.id);
  if (existsSync(".tmp-cf-preview-creds.json")) unlinkSync(".tmp-cf-preview-creds.json");
  console.log("CLEANED", email);
}
