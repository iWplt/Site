import { Card } from "@/components/ui";
import { formConfigurationWarnings } from "@/lib/form-config";
import type { FormDefinition } from "@/lib/types";

export function FormConfigWarnings({ definition }: { definition: FormDefinition }) {
  const warnings = formConfigurationWarnings(definition);
  if (!warnings.length) return null;
  return (
    <Card className="border-[#b59a63]/40">
      <h2 className="text-lg font-black text-[var(--olive-dark)]">تنبيهات الإعداد</h2>
      <ul className="mt-3 grid gap-2">
        {warnings.map((warning) => (
          <li key={warning.id} className="rounded-2xl bg-[#b59a6314] px-4 py-3 text-sm font-bold leading-7 text-[#836528]">
            {warning.message}
          </li>
        ))}
      </ul>
    </Card>
  );
}
