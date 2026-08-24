"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { FormOptionImageEditor } from "@/components/form-option-image-editor";
import { FormProductAssignModal } from "@/components/form-product-assign-modal";
import { OptimizedThumb } from "@/components/optimized-thumb";
import { Button, Card, FieldLabel, TextInput, VisibilityBadge } from "@/components/ui";
import { saveFormProductAssignmentAction } from "@/app/actions";
import { normalizeCatalogAssignment } from "@/lib/outfit-architecture";
import { assignedCatalogProducts, type CatalogAudience } from "@/lib/product-catalog";
import type { BookingMode, CatalogFormAssignment, CatalogProduct, FormDefinition, ProductCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

function bookingModeLabel(modes?: BookingMode[]) {
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
  const [attachOpen, setAttachOpen] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
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

  function saveAssignment(productId: string, next: CatalogFormAssignment) {
    startTransition(async () => {
      const result = await saveFormProductAssignmentAction(formId, productId, normalizeCatalogAssignment(next));
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage("✓ تم حفظ إعدادات ربط المنتج بهذا النموذج");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[var(--olive-dark)]">منتجات هذا النموذج</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              اربط منتجات من <strong>الكتالوج العام</strong> بهذا النموذج، ثم اضبط إعدادات الربط هنا. الأزياء تختار من هذه
              المنتجات فقط ولا تنشئ منتجات جديدة.
            </p>
          </div>
          {canManage ? (
            <Button
              type="button"
              onClick={() => {
                setAttachOpen(true);
              }}
            >
              + إضافة منتج إلى النموذج
            </Button>
          ) : null}
        </div>
        {message ? <p className="mt-3 text-sm font-bold text-[var(--olive)]">{message}</p> : null}
        <div className="mt-4 grid gap-2">
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن منتج مرتبط..." />
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((entry) => (
              <Button key={entry.id} type="button" size="sm" variant={filter === entry.id ? "primary" : "secondary"} onClick={() => setFilter(entry.id)}>
                {entry.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {visible.map(({ product, assignment }, index) => {
            const hidden = Boolean(assignment?.hidden);
            const open = settingsId === product.id;
            const modes = assignment?.bookingModes?.length ? assignment.bookingModes : (["full_set", "single_pieces"] as BookingMode[]);
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
                  "rounded-2xl border border-[var(--border)] bg-white/70 p-3 sm:p-4",
                  dragId === product.id && "ring-2 ring-[var(--olive)]"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {canManage ? <GripVertical size={16} className="mt-3 shrink-0 text-[var(--muted)]" /> : null}
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[#f3ead6]">
                      {product.image_url ? (
                        <OptimizedThumb src={product.image_url} alt={product.name_ar} sizes="64px" className="!aspect-square" />
                      ) : (
                        <div className="grid h-full place-items-center px-1 text-center text-[10px] font-bold text-[var(--muted)]">
                          صورة الكتالوج
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-[var(--olive-dark)]">{product.name_ar}</p>
                      <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                        منتج مرتبط بهذا النموذج · المصدر: الكتالوج العام
                        {product.category?.name_ar ? ` · ${product.category.name_ar}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[var(--olive)]">{bookingModeLabel(assignment?.bookingModes)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <VisibilityBadge visible={!hidden} />
                        <span className="text-xs font-bold text-[var(--muted)]">الترتيب {index + 1}</span>
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
                        onClick={() => setSettingsId(open ? null : product.id)}
                      >
                        {open ? "إخفاء الإعدادات" : "إعدادات الربط"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          saveAssignment(product.id, {
                            ...normalizeCatalogAssignment(assignment),
                            hidden: !hidden
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
                          saveAssignment(product.id, {
                            ...normalizeCatalogAssignment(assignment),
                            hidden: true
                          })
                        }
                      >
                        إزالة من النموذج
                      </Button>
                    </div>
                  ) : null}
                </div>

                {open && canManage ? (
                  <FormProductAssignmentSettings
                    product={product}
                    assignment={normalizeCatalogAssignment(assignment)}
                    modes={modes}
                    pending={pending}
                    onSave={(next) => saveAssignment(product.id, next)}
                  />
                ) : null}
              </div>
            );
          })}
          {!visible.length ? <p className="text-sm font-bold text-[var(--muted)]">لا توجد منتجات مرتبطة بهذا النموذج بعد.</p> : null}
        </div>
        <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
          الموديلات والتخصيصات ونمط الاختيار (واحد/متعدد) تُضبط من بطاقات المنتجات أسفل هذه القائمة أو من تبويب التخصيصات —
          على منتجات النموذج نفسها، وليس كنسخ مستقلة.
        </p>
      </Card>
      {canManage ? <FormOptionImageEditor formId={formId} fields={fields} /> : null}
      {attachOpen && canManage ? (
        <FormProductAssignModal
          formId={formId}
          products={products}
          categories={categories}
          definition={definition}
          audience={audience}
          onClose={() => setAttachOpen(false)}
          onOpenExisting={(productId) => {
            setSettingsId(productId);
            setAttachOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function FormProductAssignmentSettings({
  product,
  assignment,
  modes,
  pending,
  onSave
}: {
  product: CatalogProduct;
  assignment: CatalogFormAssignment;
  modes: BookingMode[];
  pending: boolean;
  onSave: (next: CatalogFormAssignment) => void;
}) {
  const [sortOrder, setSortOrder] = useState(String(assignment.sortOrder ?? product.sort_order ?? 0));
  const [visible, setVisible] = useState(!assignment.hidden);
  const [fullOutfit, setFullOutfit] = useState(modes.includes("full_set"));
  const [singleItem, setSingleItem] = useState(modes.includes("single_pieces"));
  const [localError, setLocalError] = useState<string>();

  return (
    <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4">
      <p className="text-sm font-black text-[var(--olive-dark)]">إعدادات ربط المنتج بهذا النموذج</p>
      <p className="text-xs leading-6 text-[var(--muted)]">
        المنتج الأساسي يبقى في الكتالوج. هذه الإعدادات تخص الظهور والترتيب ونوع الحجز داخل هذا النموذج فقط.
      </p>

      <div className="flex items-center gap-3 rounded-2xl bg-[#3f472d0d] p-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[#f3ead6]">
          {product.image_url ? (
            <OptimizedThumb src={product.image_url} alt={product.name_ar} sizes="56px" className="!aspect-square" />
          ) : (
            <div className="grid h-full place-items-center text-[10px] font-bold text-[var(--muted)]">لا صورة</div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--muted)]">صورة المنتج الأساسي (من الكتالوج)</p>
          <p className="text-sm font-bold text-[var(--olive-dark)]">
            تُعرض تلقائياً. لا حاجة لرفع نفس الصورة مرة أخرى. إدارة الصورة من محرر الكتالوج إن لزم.
          </p>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 font-bold text-[var(--olive-dark)]">
        <input type="checkbox" checked={visible} disabled={pending} onChange={(event) => setVisible(event.target.checked)} />
        ظاهر للطلاب في هذا النموذج
      </label>

      <div>
        <FieldLabel>الترتيب داخل النموذج</FieldLabel>
        <TextInput type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="ltr max-w-[8rem]" />
      </div>

      <div>
        <FieldLabel>نوع الحجز</FieldLabel>
        <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-white/60 p-3 text-sm font-bold">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fullOutfit} disabled={pending} onChange={(event) => setFullOutfit(event.target.checked)} />
            متاح في الزي الكامل
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={singleItem} disabled={pending} onChange={(event) => setSingleItem(event.target.checked)} />
            متاح في الحجز المفرد
          </label>
        </div>
      </div>

      {localError ? <p className="text-sm font-bold text-[var(--danger)]">{localError}</p> : null}

      <Button
        type="button"
        size="sm"
        disabled={pending}
        className="justify-self-start"
        onClick={() => {
          if (!fullOutfit && !singleItem) {
            setLocalError("اختر الزي الكامل أو الحجز المفرد أو كليهما.");
            return;
          }
          setLocalError(undefined);
          const bookingModes: BookingMode[] = [
            ...(fullOutfit ? (["full_set"] as const) : []),
            ...(singleItem ? (["single_pieces"] as const) : [])
          ];
          onSave({
            bookingModes,
            sortOrder: Number(sortOrder) || 0,
            hidden: !visible
          });
        }}
      >
        حفظ إعدادات الربط
      </Button>
    </div>
  );
}
