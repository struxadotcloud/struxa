"use client";

import { useTranslations } from "next-intl";
import { AllocationCombobox, type AllocationResult } from "./allocation-combobox";

export function AdditionalAllocations({ nodeId, primaryId, value, onChange, assignedAllocations = [] }: {
  nodeId: string;
  primaryId: string;
  value: AllocationResult[];
  onChange: (allocations: AllocationResult[]) => void;
  assignedAllocations?: AllocationResult[];
}) {
  const t = useTranslations("admin.servers");
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground">{t("additionalAllocations")}</p>
      {value.filter((a) => a.id !== primaryId).map((allocation) => (
        <div key={allocation.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="font-mono">{allocation.ipAlias ?? allocation.ip}:{allocation.port}</span>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange(value.filter((a) => a.id !== allocation.id))}>
            {t("removeAllocation")}
          </button>
        </div>
      ))}
      <AllocationCombobox
        nodeId={nodeId} value="" excludeIds={[primaryId, ...value.map((a) => a.id)]}
        assignedAllocations={assignedAllocations}
        onChange={() => {}}
        onSelect={(allocation) => onChange([...value, allocation])}
      />
      <p className="text-xs text-muted-foreground">{t("allocationRestartHint")}</p>
    </div>
  );
}
