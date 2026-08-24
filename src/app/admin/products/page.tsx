import { ProductEditor } from "@/components/product-editor";
import { ProductList } from "@/components/product-list";
import { BookingWorkspaceNav } from "@/components/booking-workspace-nav";
import { LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listBatches, listFormSummaries } from "@/lib/data";
import { listCatalogProducts, listProductCategories } from "@/lib/store/catalog-store";

const MODEL_SLUGS = new Set(["robe", "sash", "cap", "robe_additions"]);

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ edit?: string; new?: string; view?: string }>;
}) {
  const user = await requireUser(["OWNER"]);
  const params = await searchParams;
  const modelsView = params.view === "models";
  let categories: Awaited<ReturnType<typeof listProductCategories>> = [];
  let products: Awaited<ReturnType<typeof listCatalogProducts>> = [];
  try {
    [categories, products] = await Promise.all([listProductCategories(), listCatalogProducts()]);
  } catch {
    categories = [];
    products = [];
  }
  const [batches, forms] = await Promise.all([listBatches(user), listFormSummaries(user)]);
  const visibleCategories = modelsView ? categories.filter((category) => MODEL_SLUGS.has(category.slug)) : categories;
  const visibleProducts = modelsView
    ? products.filter((product) => product.category?.slug && MODEL_SLUGS.has(product.category.slug))
    : products;
  const editing = visibleProducts.find((product) => product.id === params.edit);
  const showEditor = Boolean(params.new) || Boolean(editing);

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">النماذج والمنتجات</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">{modelsView ? "الموديلات" : "المنتجات"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            {modelsView
              ? "الموديلات جزء من الكتالوج العام. ربطها بالنموذج وإعداد الظهور يتم من محرر النموذج."
              : "الكتالوج العام مصدر المنتجات. إعداد النموذج يتم من محرر النموذج دون مغادرة صفحة الحجز."}
          </p>
        </div>
        <LinkButton href={modelsView ? "/admin/products?view=models&new=1" : "/admin/products?new=1"}>+ إضافة منتج</LinkButton>
      </div>
      <BookingWorkspaceNav
        items={[
          { href: "/admin/batches", label: "الدفعات" },
          { href: "/admin/forms", label: "النماذج" },
          { href: "/admin/products", label: "المنتجات", current: !modelsView },
          { href: "/admin/products?view=models", label: "الموديلات", current: modelsView },
          { href: "/admin/settings", label: "الصلاحيات" }
        ]}
      />
      {showEditor ? (
        <ProductEditor
          categories={visibleCategories.length ? visibleCategories : categories}
          batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))}
          forms={forms.map((form) => ({ id: form.id, name: form.name, slug: form.slug }))}
          product={editing}
        />
      ) : null}
      <ProductList products={visibleProducts} categories={visibleCategories.length ? visibleCategories : categories} />
    </div>
  );
}
