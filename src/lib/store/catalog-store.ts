import "server-only";

import { randomUUID } from "node:crypto";
import type { AppUser } from "@/lib/auth";
import {
  DEFAULT_PRODUCT_CATEGORIES,
  filterAvailableProducts,
  isProductAvailable,
  mergeCatalogIntoDefinition,
  type CatalogAudience
} from "@/lib/product-catalog";
import { applyOutfitArchitecture } from "@/lib/outfit-architecture";
import { normalizeFormCustomizationGrouping } from "@/lib/form-customization";
import type {
  BookingFormRecord,
  CatalogProduct,
  ProductAvailability,
  ProductAvailabilityScope,
  ProductCategory
} from "@/lib/types";
import { getPersistenceMode } from "@/lib/persistence";
import { mutateDb, readDb, type LocalDatabase } from "@/lib/store/local-db";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSupabaseSecretsForWrites } from "@/lib/env";
import { extensionForMime, stableStorageSegment } from "@/lib/upload-security";
import { safeSlug } from "@/lib/utils";

const FORM_OPTIONS_BUCKET = "form-options";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function resolveCatalogImageUrl(imagePath: string | undefined | null): Promise<string | undefined> {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("/") || /^https?:\/\//.test(imagePath)) return imagePath;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(FORM_OPTIONS_BUCKET).createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return undefined;
  return data.signedUrl;
}

export type ProductWriteInput = {
  category_id: string;
  name_ar: string;
  name_en?: string;
  description?: string;
  price_iqd?: number | null;
  active?: boolean;
  sort_order?: number;
  availability: Array<{
    scope: ProductAvailabilityScope;
    batch_id?: string | null;
    form_id?: string | null;
  }>;
};

function now() {
  return new Date().toISOString();
}

function ensureLocalCatalog(db: LocalDatabase) {
  if (!db.product_categories?.length) {
    db.product_categories = DEFAULT_PRODUCT_CATEGORIES.map((category) => ({
      id: `cat-${category.slug}`,
      slug: category.slug,
      name_ar: category.name_ar,
      name_en: category.name_en,
      sort_order: category.sort_order,
      created_at: now(),
      updated_at: now()
    }));
  }
  if (!db.products) db.products = [];
}

function mapProduct(
  product: CatalogProduct,
  categories: ProductCategory[],
  availability: ProductAvailability[],
  imageUrl?: string
): CatalogProduct {
  return {
    ...product,
    category: categories.find((category) => category.id === product.category_id),
    availability: availability.filter((row) => row.product_id === product.id),
    image_url: imageUrl ?? product.image_url ?? undefined
  };
}

export async function listProductCategories(): Promise<ProductCategory[]> {
  if (getPersistenceMode() === "supabase") {
    const admin = createAdminClient();
    const { data, error } = await admin.from("product_categories").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as ProductCategory[];
  }
  const db = readDb();
  ensureLocalCatalog(db);
  return [...db.product_categories].sort((a, b) => a.sort_order - b.sort_order);
}

export async function listCatalogProducts(options?: { resolveImages?: boolean }): Promise<CatalogProduct[]> {
  const resolveImages = options?.resolveImages !== false;
  if (getPersistenceMode() === "supabase") {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("products")
      .select("*, product_categories(*), product_availability(*)")
      .order("sort_order");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    return Promise.all(
      rows.map(async (row) => {
        const { product_categories, product_availability, ...product } = row;
        const category = product_categories as ProductCategory | null;
        const availability = (product_availability ?? []) as ProductAvailability[];
        const image_url = resolveImages ? await resolveCatalogImageUrl(row.image_path) : undefined;
        return {
          ...(product as CatalogProduct),
          price_iqd: product.price_iqd == null ? null : Number(product.price_iqd),
          category: category ?? undefined,
          availability,
          image_url
        };
      })
    );
  }
  const db = readDb();
  ensureLocalCatalog(db);
  return db.products
    .map((product) => mapProduct(product, db.product_categories, product.availability, product.image_path ?? undefined))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function listAvailableCatalogProducts(audience: CatalogAudience): Promise<CatalogProduct[]> {
  const products = await listCatalogProducts();
  return filterAvailableProducts(products, audience);
}

function normalizeAvailability(
  productId: string,
  rows: ProductWriteInput["availability"]
): ProductAvailability[] {
  const unique: ProductAvailability[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.scope === "all") {
      unique.push({ id: randomUUID(), product_id: productId, scope: "all", batch_id: null, form_id: null });
      return unique;
    }
  }
  for (const row of rows) {
    const key = `${row.scope}:${row.batch_id ?? ""}:${row.form_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.scope === "batches" && !row.batch_id) continue;
    if (row.scope === "forms" && !row.form_id) continue;
    unique.push({
      id: randomUUID(),
      product_id: productId,
      scope: row.scope,
      batch_id: row.batch_id ?? null,
      form_id: row.form_id ?? null
    });
  }
  return unique.length ? unique : [{ id: randomUUID(), product_id: productId, scope: "all", batch_id: null, form_id: null }];
}

export async function createCatalogProduct(user: AppUser, input: ProductWriteInput): Promise<CatalogProduct> {
  const name = input.name_ar.trim();
  if (!name) throw new Error("اسم المنتج مطلوب.");
  if (!input.category_id) throw new Error("التصنيف مطلوب.");
  const price = input.price_iqd;
  if (price != null && (!Number.isFinite(price) || price < 0)) throw new Error("السعر غير صالح.");

  if (getPersistenceMode() === "supabase") {
    requireSupabaseSecretsForWrites();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("products")
      .insert({
        category_id: input.category_id,
        name_ar: name,
        name_en: input.name_en?.trim() || null,
        description: input.description?.trim() || null,
        price_iqd: price ?? null,
        active: input.active ?? true,
        archived: false,
        sort_order: input.sort_order ?? 0,
        created_by: user.id
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "تعذر حفظ المنتج.");
    const availability = normalizeAvailability(data.id, input.availability);
    if (availability.length) {
      const { error: availError } = await admin.from("product_availability").insert(
        availability.map((row) => ({
          product_id: data.id,
          scope: row.scope,
          batch_id: row.batch_id,
          form_id: row.form_id
        }))
      );
      if (availError) throw new Error(availError.message);
    }
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_label: user.fullName,
      action: "PRODUCT_CREATED",
      entity_type: "product",
      entity_id: data.id,
      metadata: { name }
    });
    const products = await listCatalogProducts();
    return products.find((product) => product.id === data.id)!;
  }

  return mutateDb((db) => {
    ensureLocalCatalog(db);
    if (!db.product_categories.some((category) => category.id === input.category_id)) {
      throw new Error("التصنيف غير موجود.");
    }
    const id = randomUUID();
    const product: CatalogProduct = {
      id,
      category_id: input.category_id,
      name_ar: name,
      name_en: input.name_en?.trim() || null,
      description: input.description?.trim() || null,
      price_iqd: price ?? null,
      active: input.active ?? true,
      archived: false,
      sort_order: input.sort_order ?? 0,
      created_at: now(),
      updated_at: now(),
      created_by: user.id,
      availability: normalizeAvailability(id, input.availability)
    };
    db.products.unshift(product);
    return mapProduct(product, db.product_categories, product.availability, product.image_path ?? undefined);
  });
}

export async function updateCatalogProduct(user: AppUser, productId: string, input: ProductWriteInput): Promise<CatalogProduct> {
  const name = input.name_ar.trim();
  if (!name) throw new Error("اسم المنتج مطلوب.");
  if (getPersistenceMode() === "supabase") {
    requireSupabaseSecretsForWrites();
    const admin = createAdminClient();
    const { error } = await admin
      .from("products")
      .update({
        category_id: input.category_id,
        name_ar: name,
        name_en: input.name_en?.trim() || null,
        description: input.description?.trim() || null,
        price_iqd: input.price_iqd ?? null,
        active: input.active ?? true,
        sort_order: input.sort_order ?? 0,
        updated_at: now()
      })
      .eq("id", productId);
    if (error) throw new Error(error.message);
    await admin.from("product_availability").delete().eq("product_id", productId);
    const availability = normalizeAvailability(productId, input.availability);
    const { error: availError } = await admin.from("product_availability").insert(
      availability.map((row) => ({
        product_id: productId,
        scope: row.scope,
        batch_id: row.batch_id,
        form_id: row.form_id
      }))
    );
    if (availError) throw new Error(availError.message);
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_label: user.fullName,
      action: "PRODUCT_UPDATED",
      entity_type: "product",
      entity_id: productId,
      metadata: { name }
    });
    const products = await listCatalogProducts();
    const product = products.find((entry) => entry.id === productId);
    if (!product) throw new Error("المنتج غير موجود.");
    return product;
  }
  return mutateDb((db) => {
    ensureLocalCatalog(db);
    const product = db.products.find((entry) => entry.id === productId);
    if (!product) throw new Error("المنتج غير موجود.");
    product.category_id = input.category_id;
    product.name_ar = name;
    product.name_en = input.name_en?.trim() || null;
    product.description = input.description?.trim() || null;
    product.price_iqd = input.price_iqd ?? null;
    product.active = input.active ?? product.active;
    product.sort_order = input.sort_order ?? product.sort_order;
    product.updated_at = now();
    product.availability = normalizeAvailability(productId, input.availability);
    return mapProduct(product, db.product_categories, product.availability, product.image_path ?? undefined);
  });
}

export async function attachProductToForm(productId: string, audience: CatalogAudience): Promise<CatalogProduct> {
  const products = await listCatalogProducts({ resolveImages: false });
  const product = products.find((entry) => entry.id === productId && !entry.archived);
  if (!product) throw new Error("المنتج غير موجود.");

  if (!product.active) {
    await setCatalogProductActive(productId, true);
  }

  if (isProductAvailable(product.availability, audience)) {
    const refreshed = await listCatalogProducts({ resolveImages: false });
    return refreshed.find((entry) => entry.id === productId)!;
  }

  const row: ProductAvailability = {
    id: randomUUID(),
    product_id: productId,
    scope: "forms",
    batch_id: null,
    form_id: audience.formId
  };

  if (getPersistenceMode() === "supabase") {
    requireSupabaseSecretsForWrites();
    const admin = createAdminClient();
    const { error } = await admin.from("product_availability").insert({
      product_id: productId,
      scope: "forms",
      batch_id: null,
      form_id: audience.formId
    });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  } else {
    mutateDb((db) => {
      ensureLocalCatalog(db);
      const local = db.products.find((entry) => entry.id === productId);
      if (!local) throw new Error("المنتج غير موجود.");
      const exists = local.availability.some((entry) => entry.scope === "forms" && entry.form_id === audience.formId);
      if (!exists) local.availability.push(row);
      local.active = true;
      local.updated_at = now();
    });
  }

  const refreshed = await listCatalogProducts({ resolveImages: false });
  const attached = refreshed.find((entry) => entry.id === productId);
  if (!attached) throw new Error("المنتج غير موجود.");
  return attached;
}

export async function setCatalogProductActive(productId: string, active: boolean) {
  if (getPersistenceMode() === "supabase") {
    requireSupabaseSecretsForWrites();
    const admin = createAdminClient();
    const { error } = await admin.from("products").update({ active, updated_at: now() }).eq("id", productId).eq("archived", false);
    if (error) throw new Error(error.message);
    return;
  }
  mutateDb((db) => {
    ensureLocalCatalog(db);
    const product = db.products.find((entry) => entry.id === productId);
    if (!product || product.archived) throw new Error("المنتج غير موجود.");
    product.active = active;
    product.updated_at = now();
  });
}

export async function archiveCatalogProduct(productId: string) {
  if (getPersistenceMode() === "supabase") {
    requireSupabaseSecretsForWrites();
    const admin = createAdminClient();
    const { error } = await admin
      .from("products")
      .update({ archived: true, active: false, updated_at: now() })
      .eq("id", productId);
    if (error) throw new Error(error.message);
    return;
  }
  mutateDb((db) => {
    ensureLocalCatalog(db);
    const product = db.products.find((entry) => entry.id === productId);
    if (!product) throw new Error("المنتج غير موجود.");
    product.archived = true;
    product.active = false;
    product.updated_at = now();
  });
}

export async function reorderCatalogProduct(productId: string, sortOrder: number) {
  if (!Number.isFinite(sortOrder)) throw new Error("الترتيب غير صالح.");
  if (getPersistenceMode() === "supabase") {
    requireSupabaseSecretsForWrites();
    const admin = createAdminClient();
    const { error } = await admin.from("products").update({ sort_order: sortOrder, updated_at: now() }).eq("id", productId);
    if (error) throw new Error(error.message);
    return;
  }
  mutateDb((db) => {
    ensureLocalCatalog(db);
    const product = db.products.find((entry) => entry.id === productId);
    if (!product) throw new Error("المنتج غير موجود.");
    product.sort_order = sortOrder;
    product.updated_at = now();
  });
}

export async function createProductCategory(nameAr: string, nameEn?: string) {
  const name = nameAr.trim();
  if (!name) throw new Error("اسم التصنيف مطلوب.");
  const slug = safeSlug(nameEn || name) || `cat-${Date.now()}`;
  if (getPersistenceMode() === "supabase") {
    requireSupabaseSecretsForWrites();
    const admin = createAdminClient();
    const { data: last } = await admin.from("product_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const sort_order = (last?.[0]?.sort_order ?? 100) + 10;
    const { data, error } = await admin
      .from("product_categories")
      .insert({ slug, name_ar: name, name_en: nameEn?.trim() || null, sort_order })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء التصنيف.");
    return data as ProductCategory;
  }
  return mutateDb((db) => {
    ensureLocalCatalog(db);
    if (db.product_categories.some((category) => category.slug === slug || category.name_ar === name)) {
      throw new Error("التصنيف موجود مسبقاً.");
    }
    const category: ProductCategory = {
      id: randomUUID(),
      slug,
      name_ar: name,
      name_en: nameEn?.trim() || null,
      sort_order: (db.product_categories.at(-1)?.sort_order ?? 100) + 10,
      created_at: now(),
      updated_at: now()
    };
    db.product_categories.push(category);
    return category;
  });
}

export async function saveCatalogProductImage(productId: string, file: { buffer: Buffer; mimeType: string; originalName: string }) {
  const extension = extensionForMime(file.mimeType);
  const path = `catalog/${stableStorageSegment(productId)}/reference.${extension}`;
  if (getPersistenceMode() === "supabase") {
    requireSupabaseSecretsForWrites();
    const admin = createAdminClient();
    const { error } = await admin.storage.from(FORM_OPTIONS_BUCKET).upload(path, file.buffer, {
      contentType: file.mimeType,
      upsert: true
    });
    if (error) throw new Error(error.message);
    const { error: updateError } = await admin.from("products").update({ image_path: path, updated_at: now() }).eq("id", productId);
    if (updateError) throw new Error(updateError.message);
    return { imagePath: path, imageUrl: await resolveCatalogImageUrl(path) };
  }
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const relativeDir = join("uploads", "form-options", "catalog", stableStorageSegment(productId));
  const absoluteDir = join(process.cwd(), "public", relativeDir);
  mkdirSync(absoluteDir, { recursive: true });
  writeFileSync(join(absoluteDir, `reference.${extension}`), file.buffer);
  const imagePath = `/${relativeDir.replaceAll("\\", "/")}/reference.${extension}`;
  mutateDb((db) => {
    ensureLocalCatalog(db);
    const product = db.products.find((entry) => entry.id === productId);
    if (!product) throw new Error("المنتج غير موجود.");
    product.image_path = imagePath;
    product.updated_at = now();
  });
  return { imagePath, imageUrl: imagePath };
}

export async function withCatalogDefinition(form: BookingFormRecord): Promise<BookingFormRecord> {
  const base = {
    ...form,
    definition: normalizeFormCustomizationGrouping(form.definition)
  };
  try {
    const [products, categories] = await Promise.all([
      listAvailableCatalogProducts({
        formId: form.id,
        formType: form.type,
        batchId: form.batch_id ?? null
      }),
      listProductCategories()
    ]);
    return { ...base, definition: applyOutfitArchitecture(mergeCatalogIntoDefinition(base.definition, products, categories)) };
  } catch {
    return { ...base, definition: applyOutfitArchitecture(base.definition) };
  }
}
