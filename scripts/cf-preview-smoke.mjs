/**
 * Temporary Cloudflare Workers preview smoke helper.
 * Creates a short-lived OWNER, exercises preview routes, then deletes the user.
 * Creds are written only to gitignored .tmp-cf-preview-creds.json.
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const BASE = process.env.CF_PREVIEW_URL || "http://127.0.0.1:8787";
const CREDS_PATH = ".tmp-cf-preview-creds.json";

function loadDevVars() {
  const raw = readFileSync(".dev.vars", "utf8");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
}

function adminClient() {
  const env = loadDevVars();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function createTempOwner() {
  const admin = adminClient();
  const password = `CfPreview${crypto.randomInt(100000, 999999)}!`;
  const email = `cf.preview.${Date.now()}@warka.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "CF Preview Owner" }
  });
  if (error) throw error;
  const { error: pErr } = await admin.from("profiles").upsert({
    id: data.user.id,
    full_name: "CF Preview Owner",
    role: "OWNER",
    email,
    disabled: false
  });
  if (pErr) throw pErr;
  const creds = { email, password, userId: data.user.id };
  writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));
  return creds;
}

async function cleanupTempOwner() {
  if (!existsSync(CREDS_PATH)) return;
  const creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
  const admin = adminClient();
  await admin.from("profiles").delete().eq("id", creds.userId);
  await admin.auth.admin.deleteUser(creds.userId);
  unlinkSync(CREDS_PATH);
  console.log("CLEANED", creds.email);
}

async function fetchStatus(path, cookie = "") {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {}
  });
  const location = res.headers.get("location") || "";
  return { path, status: res.status, location, ok: res.status >= 200 && res.status < 400 };
}

async function loginViaSupabaseAndCookie() {
  const env = loadDevVars();
  const creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: creds.email,
    password: creds.password
  });
  if (error) throw error;

  // Mirror @supabase/ssr cookie shape used by createServerClient
  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const payload = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user
  };
  // Chunk if needed — for smoke we store as single cookie value (may exceed limits for large JWT)
  const value = encodeURIComponent(JSON.stringify(payload));
  return `${cookieName}=${value}`;
}

async function smokePublic() {
  const results = [];
  for (const path of ["/login", "/privacy", "/admin", "/admin/forms", "/admin/products", "/admin/settings"]) {
    results.push(await fetchStatus(path));
  }

  const admin = adminClient();
  const { data: forms } = await admin
    .from("booking_forms")
    .select("slug,status,name")
    .eq("status", "published")
    .limit(5);
  for (const form of forms ?? []) {
    results.push(await fetchStatus(`/f/${form.slug}`));
    results.push(await fetchStatus(`/f/${form.slug}/book`));
  }
  return { results, forms: forms ?? [] };
}

async function smokeAuthenticated(cookie) {
  const paths = [
    "/admin",
    "/admin/forms",
    "/admin/products",
    "/admin/settings",
    "/admin/orders",
    "/admin/students",
    "/admin/batches"
  ];
  const results = [];
  for (const path of paths) {
    results.push(await fetchStatus(path, cookie));
  }

  // Pick first form for Form Products / Outfits admin editor
  const admin = adminClient();
  const { data: forms } = await admin.from("booking_forms").select("id,slug,name").limit(3);
  for (const form of forms ?? []) {
    results.push(await fetchStatus(`/admin/forms/${form.id}`, cookie));
  }

  // Upload route should reject unauthenticated/malformed (with cookie still needs multipart)
  const uploadRes = await fetch(`${BASE}/api/uploads/admin`, {
    method: "POST",
    headers: { cookie },
    body: new FormData()
  });
  results.push({
    path: "/api/uploads/admin POST empty",
    status: uploadRes.status,
    location: "",
    ok: uploadRes.status >= 400 && uploadRes.status < 500
  });

  return { results, forms: forms ?? [] };
}

async function supabaseReadWriteProbe() {
  const admin = adminClient();
  const marker = `cf-preview-${Date.now()}`;
  const { data: before, error: readErr } = await admin.from("audit_logs").select("id").limit(1);
  if (readErr) throw readErr;

  // Soft write probe via profiles update of temp user full_name then restore
  if (!existsSync(CREDS_PATH)) throw new Error("missing creds");
  const creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
  const { error: wErr } = await admin.from("profiles").update({ full_name: marker }).eq("id", creds.userId);
  if (wErr) throw wErr;
  const { data: row, error: r2 } = await admin.from("profiles").select("full_name").eq("id", creds.userId).single();
  if (r2) throw r2;
  await admin.from("profiles").update({ full_name: "CF Preview Owner" }).eq("id", creds.userId);
  return { readOk: Array.isArray(before), writeOk: row.full_name === marker, auditSample: before?.length ?? 0 };
}

const cmd = process.argv[2] || "all";

if (cmd === "cleanup") {
  await cleanupTempOwner();
} else if (cmd === "create") {
  const creds = await createTempOwner();
  console.log("CREATED", creds.email);
} else {
  const report = { public: null, auth: null, supabase: null, cookieWorks: false };
  try {
    await createTempOwner();
    report.public = await smokePublic();
    let cookie;
    try {
      cookie = await loginViaSupabaseAndCookie();
      report.cookieWorks = true;
    } catch (e) {
      report.cookieWorks = false;
      report.cookieError = e instanceof Error ? e.message : String(e);
    }
    if (cookie) {
      report.auth = await smokeAuthenticated(cookie);
    }
    report.supabase = await supabaseReadWriteProbe();
  } finally {
    await cleanupTempOwner();
  }
  console.log(JSON.stringify(report, null, 2));
}
