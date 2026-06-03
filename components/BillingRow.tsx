import type { BillingMemberDraft, SplitMode } from "@/types/billing";

type Props = {
  row: BillingMemberDraft;
  splitMode: SplitMode;
  onToggle: (voterId: string, enabled: boolean) => void;
  onHoursChange: (voterId: string, hours: number) => void;
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export default function BillingRow({
  row,
  splitMode,
  onToggle,
  onHoursChange,
}: Props) {
  return (
    <div
      className={`grid gap-3 border-[3px] border-black p-3 shadow-[4px_4px_0_#111] md:grid-cols-[1.3fr_0.8fr_1fr] ${
        row.enabled ? "bg-white" : "bg-gray-200 opacity-70"
      }`}
    >
      <label className="flex items-center gap-3 font-black">
        <input
          type="checkbox"
          checked={row.enabled}
          onChange={(event) => onToggle(row.voterId, event.target.checked)}
          className="h-5 w-5 accent-black"
        />
        <span>{row.username}</span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-black uppercase">Hours</span>
        <input
          type="number"
          min={0}
          step={0.5}
          value={row.hours}
          disabled={!row.enabled || splitMode === "EQUAL"}
          onChange={(event) =>
            onHoursChange(row.voterId, Number(event.target.value || 0))
          }
          className="brutal-input w-full px-3 py-2 font-bold disabled:cursor-not-allowed disabled:bg-gray-300"
        />
      </label>

      <div className="flex items-end justify-between gap-3 md:block">
        <span className="text-xs font-black uppercase">Subtotal</span>
        <p className="text-xl font-black">
          {currencyFormatter.format(row.amount)}
        </p>
      </div>
    </div>
  );
}
