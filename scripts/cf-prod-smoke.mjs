/**
 * Production smoke against the live Worker URL.
 * Does not print secrets.
 */
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const BASE = process.env.CF_PROD_URL || "https://graduation.warka.workers.dev";
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

const password = `CfProd${crypto.randomInt(100000, 999999)}!`;
const email = `cf.prod.${Date.now()}@warka.invalid`;
const { data: created, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "CF Prod Smoke Owner" }
});
if (error) throw error;
await admin.from("profiles").upsert({
  id: created.user.id,
  full_name: "CF Prod Smoke Owner",
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
const cookie =
  `sb-${projectRef}-auth-token=` +
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

async function hit(path, init = {}) {
  const res = await fetch(BASE + path, { redirect: "manual", ...init });
  return {
    path,
    status: res.status,
    location: res.headers.get("location") || "",
    ok: res.status >= 200 && res.status < 400
  };
}

try {
  const { data: forms } = await admin
    .from("booking_forms")
    .select("id,slug,status")
    .eq("status", "published")
    .limit(1);
  const form = forms?.[0];
  if (!form) throw new Error("no published form");

  const login = await hit("/login");
  const adminUnauth = await hit("/admin");
  const adminAuth = await hit("/admin", { headers: { cookie } });
  const settings = await hit("/admin/settings", { headers: { cookie } });
  const publicForm = await hit(`/f/${form.slug}`);
  const formEditor = await hit(`/admin/forms/${form.id}`, { headers: { cookie } });

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const { data: formRow } = await admin.from("booking_forms").select("definition").eq("id", form.id).single();
  const def = formRow?.definition;
  const robeField =
    def?.fields?.find?.((f) => f.key === "robe_model") ||
    def?.sections?.flatMap?.((s) => s.fields || []).find?.((f) => f.key === "robe_model");
  const optionId = robeField?.options?.[0]?.id || "robe-gulf";

  const fd = new FormData();
  fd.set("kind", "option");
  fd.set("formId", form.id);
  fd.set("fieldKey", "robe_model");
  fd.set("optionId", optionId);
  fd.set("file", new Blob([png], { type: "image/png" }), "pixel.png");
  const uploadRes = await fetch(`${BASE}/api/uploads/admin`, {
    method: "POST",
    headers: { cookie },
    body: fd
  });
  const uploadBody = await uploadRes.text();
  const uploadJson = (() => {
    try {
      return JSON.parse(uploadBody);
    } catch {
      return { raw: uploadBody.slice(0, 120) };
    }
  })();

  const { data: profileCheck } = await admin.from("profiles").select("id").eq("id", created.user.id).maybeSingle();

  const report = {
    base: BASE,
    workerReady: login.ok,
    login,
    adminUnauth,
    adminAuth,
    settings: {
      ...settings,
      supabaseLabel: false
    },
    publicForm,
    formEditor,
    upload: {
      status: uploadRes.status,
      success: uploadJson.success === true,
      supabaseStorage: String(uploadJson?.data?.imageUrl || "").includes("supabase.co")
    },
    supabaseConnectivity: Boolean(profileCheck?.id)
  };

  // settings HTML check
  const settingsHtml = await fetch(BASE + "/admin/settings", { headers: { cookie } }).then((r) => r.text());
  report.settings.supabaseLabel = settingsHtml.includes("Supabase (production source of truth)");

  console.log(JSON.stringify(report, null, 2));

  const allOk =
    report.login.status === 200 &&
    report.adminUnauth.status === 307 &&
    report.adminAuth.status === 200 &&
    report.publicForm.status === 200 &&
    report.formEditor.status === 200 &&
    report.upload.success &&
    report.upload.supabaseStorage &&
    report.supabaseConnectivity &&
    report.settings.supabaseLabel;

  console.log(allOk ? "PRODUCTION_SMOKE_SUCCESS" : "PRODUCTION_SMOKE_FAILED");
  if (!allOk) process.exit(1);
} finally {
  await admin.from("profiles").delete().eq("id", created.user.id);
  await admin.auth.admin.deleteUser(created.user.id);
  if (existsSync(".tmp-cf-preview-creds.json")) unlinkSync(".tmp-cf-preview-creds.json");
  console.log("CLEANED", email);
}
