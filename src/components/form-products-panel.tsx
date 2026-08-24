"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { FormOptionImageEditor } from "@/components/form-option-image-editor";
import { FormProductAssignModal } from "@/components/form-product-assign-modal";
import { Button, Card, TextInput, VisibilityBadge } from "@/components/ui";
import { saveFormProductAssignmentAction } from "@/app/actions";
import { normalizeCatalogAssignment } from "@/lib/outfit-architecture";
import { assignedCatalogProducts, type CatalogAudience } from "@/lib/product-catalog";
import type { CatalogProduct, FormDefinition, ProductCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

function bookingModeLabel(modes?: Array<"full_set" | "single_pieces">) {
  const set = new Set(modes?.length ? modes : ["full_set", "single_pieces"]);
  if (set.has("full_set") && set.has("single_pieces")) return "الزي الكامل والمفرد";
  if (set.has("single_pieces")) return "الحجز المفرد فقط";
  return "الزي الكامل فقط";
}

const FILTERS = [
  { id: "all", label: "الكل", slugs: null as string[] | null },
  { id: "robe", label: "روب", slugs: ["robe", "robe_additions"] },
  { id: "sash", label: "وشاح", slugs: ["sash"] },
  { id: "cap", label: "قبعة", slugs: ["cap"] },
  { id: "other", label: "أخرى", slugs: [] as string[] }
];

const CORE_FILTER_SLUGS = new Set(["robe", "robe_additions", "sash", "cap"]);

export function FormProductsPanel({
  formId,
  definition,
  products,
  categories,
  audience,
  canManage
}: {
  formId: string;
  definition: FormDefinition;
  products: CatalogProduct[];
  categories: ProductCategory[];
  audience: CatalogAudience;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogProduct | undefined>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const assigned = assignedCatalogProducts(products, audience, definition.outfitConfig?.catalogAssignments);
  const fields = definition.sections.flatMap((section) => section.fields);
  const selectedFilter = FILTERS.find((entry) => entry.id === filter) ?? FILTERS[0];
  const visible = assigned.filter(({ product }) => {
    const slug = product.category?.slug ?? "";
    if (selectedFilter.id === "other" && CORE_FILTER_SLUGS.has(slug)) return false;
    if (selectedFilter.slugs && selectedFilter.id !== "other" && !selectedFilter.slugs.includes(slug)) return false;
    if (query.trim() && !`${product.name_ar} ${product.category?.name_ar ?? ""}`.includes(query.trim())) return false;
    return true;
  });

  function persistOrder(items: typeof assigned) {
    startTransition(async () => {
      for (const [index, item] of items.entries()) {
        await saveFormProductAssignmentAction(formId, item.product.id, {
          ...normalizeCatalogAssignment(item.assignment),
          sortOrder: index
        });
      }
      router.refresh();
    });
  }

  function moveAssigned(fromId: string, toId: string) {
    if (!canManage || fromId === toId) return;
    const items = [...assigned];
    const from = items.findIndex((entry) => entry.product.id === fromId);
    const to = items.findIndex((entry) => entry.product.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    persistOrder(items);
  }

  function moveAssignedByIndex(productId: string, offset: number) {
    const from = assigned.findIndex((entry) => entry.product.id === productId);
    const target = assigned[from + offset];
    if (from < 0 || !target) return;
    moveAssigned(productId, target.product.id);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">المنتجات الظاهرة للطلاب</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              أضف المنتج هنا مباشرة. الكتالوج العام يبقى المصدر، وهذا النموذج يضبط الظهور والترتيب ونوع الحجز.
            </p>
          </div>
          {canManage ? (
            <Button
              type="button"
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              + إضافة منتج
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-2">
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن منتج..." />
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((entry) => (
              <Button key={entry.id} type="button" size="sm" variant={filter === entry.id ? "primary" : "secondary"} onClick={() => setFilter(entry.id)}>
                {entry.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {visible.map(({ product, assignment }) => {
            const hidden = Boolean(assignment?.hidden);
            return (
              <div
                key={product.id}
                draggable={canManage}
                onDragStart={() => setDragId(product.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragId) moveAssigned(dragId, product.id);
                  setDragId(null);
                }}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3",
                  dragId === product.id && "ring-2 ring-[var(--olive)]"
                )}
              >
                <div className="flex min-w-0 items-start gap-2">
                  {canManage ? <GripVertical size={16} className="mt-1 shrink-0 text-[var(--muted)]" /> : null}
                  <div className="min-w-0">
                    <p className="font-black text-[var(--olive-dark)]">{product.name_ar}</p>
                    <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                      {product.category?.name_ar ?? "بدون تصنيف"} · {bookingModeLabel(assignment?.bookingModes)}
                    </p>
                    <div className="mt-2">
                      <VisibilityBadge visible={!hidden} />
                    </div>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="icon" aria-label="أعلى" disabled={pending} onClick={() => moveAssignedByIndex(product.id, -1)}>
                      ↑
                    </Button>
                    <Button type="button" variant="secondary" size="icon" aria-label="أسفل" disabled={pending} onClick={() => moveAssignedByIndex(product.id, 1)}>
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditing(product);
                        setOpen(true);
                      }}
                    >
                      تعديل
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await saveFormProductAssignmentAction(formId, product.id, {
                            ...normalizeCatalogAssignment(assignment),
                            hidden: !hidden
                          });
                          router.refresh();
                        })
                      }
                    >
                      {hidden ? "إظهار" : "إخفاء"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await saveFormProductAssignmentAction(formId, product.id, { ...normalizeCatalogAssignment(assignment), hidden: true });
                          router.refresh();
                        })
                      }
                    >
                      حذف من النموذج
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {!visible.length ? <p className="text-sm font-bold text-[var(--muted)]">لا توجد منتجات مطابقة.</p> : null}
        </div>
      </Card>
      {canManage ? <FormOptionImageEditor formId={formId} fields={fields} /> : null}
      {open && canManage ? (
        <FormProductAssignModal
          formId={formId}
          products={products}
          categories={categories}
          definition={definition}
          audience={audience}
          existingProduct={editing}
          onClose={() => {
            setOpen(false);
            setEditing(undefined);
          }}
        />
      ) : null}
    </div>
  );
}
