import { ProductEditor } from "@/components/product-editor";
import { ProductList } from "@/components/product-list";
import { requireUser } from "@/lib/auth";
import { listBatches, listFormSummaries } from "@/lib/data";
import { listCatalogProducts, listProductCategories } from "@/lib/store/catalog-store";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const user = await requireUser(["OWNER"]);
  const params = await searchParams;
  let categories: Awaited<ReturnType<typeof listProductCategories>> = [];
  let products: Awaited<ReturnType<typeof listCatalogProducts>> = [];
  try {
    [categories, products] = await Promise.all([listProductCategories(), listCatalogProducts()]);
  } catch {
    categories = [];
    products = [];
  }
  const [batches, forms] = await Promise.all([listBatches(user), listFormSummaries(user)]);
  const editing = products.find((product) => product.id === params.edit);
  const showEditor = Boolean(params.new) || Boolean(editing);

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--gold)]">كتالوج المالك</p>
          <h1 className="text-3xl font-black text-[var(--olive-dark)] sm:text-4xl">المنتجات</h1>
        </div>
        <a href="/admin/products?new=1" className="inline-flex min-h-12 items-center rounded-2xl bg-[var(--olive)] px-5 font-bold text-[var(--paper)]">
          + إضافة منتج
        </a>
      </div>
      {showEditor ? (
        <ProductEditor
          categories={categories}
          batches={batches.map((batch) => ({ id: batch.id, name: batch.name }))}
          forms={forms.map((form) => ({ id: form.id, name: form.name, slug: form.slug }))}
          product={editing}
        />
      ) : null}
      <ProductList products={products} categories={categories} />
    </div>
  );
}
