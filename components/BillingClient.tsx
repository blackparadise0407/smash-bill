"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import BillingRow from "@/components/BillingRow";
import type {
  BillingMemberDraft,
  BillingParticipant,
  FinalSummaryRow,
  SavedBillingDraft,
  SplitMode,
} from "@/types/billing";

type EventInfo = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

type Props = {
  eventId: string;
};

const DEFAULT_HOURS = 2;
const DEFAULT_CATEGORIES = [
  "Badminton court",
  "Food & drinks",
  "Water",
  "Other",
];

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function roundMoney(value: number) {
  return Math.round(value);
}

function buildInitialGroup(
  participants: BillingParticipant[],
): BillingMemberDraft[] {
  return participants.map((participant) => ({
    voterId: participant.id,
    username: participant.username,
    enabled: true,
    hours: DEFAULT_HOURS,
    amount: 0,
  }));
}

function recalculateGroup(
  group: BillingMemberDraft[],
  totalAmount: number,
  splitMode: SplitMode,
) {
  const enabledRows = group.filter((row) => row.enabled);

  if (enabledRows.length === 0 || totalAmount <= 0) {
    return group.map((row) => ({ ...row, amount: 0 }));
  }

  if (splitMode === "EQUAL") {
    const amountPerMember = roundMoney(totalAmount / enabledRows.length);

    return group.map((row) => ({
      ...row,
      amount: row.enabled ? amountPerMember : 0,
    }));
  }

  const totalHours = enabledRows.reduce((sum, row) => sum + row.hours, 0);

  if (totalHours <= 0) {
    return group.map((row) => ({ ...row, amount: 0 }));
  }

  return group.map((row) => ({
    ...row,
    amount: row.enabled
      ? roundMoney((totalAmount / totalHours) * row.hours)
      : 0,
  }));
}

export default function BillingClient({ eventId }: Props) {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [participants, setParticipants] = useState<BillingParticipant[]>([]);
  const [savedBillings, setSavedBillings] = useState<SavedBillingDraft[]>([]);
  const [currentCategory, setCurrentCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [currentAmount, setCurrentAmount] = useState(0);
  const [splitMode, setSplitMode] = useState<SplitMode>("BY_HOURS");
  const [currentGroup, setCurrentGroup] = useState<BillingMemberDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadInvoiceSeed = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch(`/api/event/${eventId}/invoice`, {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? "Unable to load billing data.");
      setIsLoading(false);
      return;
    }

    setEvent(data.event);
    setParticipants(data.participants ?? []);
    setCurrentGroup(buildInitialGroup(data.participants ?? []));
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadInvoiceSeed();
  }, [loadInvoiceSeed]);

  // useMemo keeps row and preview calculations in sync with amount/group/split mode changes.
  const calculatedCurrentGroup = useMemo(
    () => recalculateGroup(currentGroup, currentAmount, splitMode),
    [currentAmount, currentGroup, splitMode],
  );

  const currentTotalHours = useMemo(
    () =>
      calculatedCurrentGroup
        .filter((row) => row.enabled)
        .reduce((sum, row) => sum + row.hours, 0),
    [calculatedCurrentGroup],
  );

  const finalSummary: FinalSummaryRow[] = useMemo(() => {
    const summaryByUsername = new Map<string, number>();

    participants.forEach((participant) => {
      summaryByUsername.set(participant.username, 0);
    });

    savedBillings.forEach((billing) => {
      billing.details.forEach((detail) => {
        summaryByUsername.set(
          detail.username,
          (summaryByUsername.get(detail.username) ?? 0) + detail.amount,
        );
      });
    });

    return Array.from(summaryByUsername.entries()).map(
      ([username, totalDebt]) => ({
        username,
        totalDebt,
      }),
    );
  }, [participants, savedBillings]);

  function updateEnabled(voterId: string, enabled: boolean) {
    setCurrentGroup((group) =>
      group.map((row) => (row.voterId === voterId ? { ...row, enabled } : row)),
    );
  }

  function updateHours(voterId: string, hours: number) {
    setCurrentGroup((group) =>
      group.map((row) =>
        row.voterId === voterId ? { ...row, hours: Math.max(0, hours) } : row,
      ),
    );
  }

  function resetCurrentCategoryForm() {
    setCurrentAmount(0);
    setCurrentCategory(DEFAULT_CATEGORIES[0]);
    setSplitMode("BY_HOURS");
    setCurrentGroup(buildInitialGroup(participants));
  }

  function handleSaveCategory() {
    if (!currentCategory.trim()) {
      setMessage("Please enter a category.");
      return;
    }

    if (currentAmount <= 0) {
      setMessage("Total amount must be greater than 0.");
      return;
    }

    if (!calculatedCurrentGroup.some((row) => row.enabled)) {
      setMessage("Select at least one participant for this category.");
      return;
    }

    if (splitMode === "BY_HOURS" && currentTotalHours <= 0) {
      setMessage("Total hours must be greater than 0 when splitting by hours.");
      return;
    }

    setSavedBillings((billings) => [
      ...billings,
      {
        id: window.crypto.randomUUID(),
        category: currentCategory.trim(),
        totalAmount: currentAmount,
        splitMode,
        details: calculatedCurrentGroup,
      },
    ]);
    setMessage("Draft category saved. You can continue with another category.");
    resetCurrentCategoryForm();
  }

  function removeSavedBilling(id: string) {
    setSavedBillings((billings) =>
      billings.filter((billing) => billing.id !== id),
    );
  }

  function finalizeInvoice() {
    if (savedBillings.length === 0) {
      setMessage(
        "At least one draft category is required before finalizing the invoice.",
      );
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/event/${eventId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billings: savedBillings.map((billing) => ({
            category: billing.category,
            totalAmount: billing.totalAmount,
            details: billing.details.map((detail) => ({
              username: detail.username,
              hours: detail.enabled ? detail.hours : 0,
              amount: detail.amount,
            })),
          })),
        }),
      });
      const data = await response.json();

      setMessage(
        data.message ??
          (response.ok ? "Invoice finalized." : "Unable to finalize invoice."),
      );

      if (response.ok) {
        await loadInvoiceSeed();
      }
    });
  }

  if (isLoading) {
    return (
      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Loading billing data...</h2>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      {message ? (
        <p className="border-[3px] border-black bg-[#5dc9ff] px-4 py-3 font-black shadow-[4px_4px_0_#111]">
          {message}
        </p>
      ) : null}

      <header className="brutal-card bg-[#ff5fb7] p-6">
        <p className="mb-3 inline-block border-[3px] border-black bg-white px-3 py-1 font-black uppercase shadow-[4px_4px_0_#111]">
          Billing · {event?.status ?? "OPEN"}
        </p>
        <h1 className="text-4xl font-black md:text-6xl">
          {event?.name ?? "Event billing"}
        </h1>
        {event?.description ? (
          <p className="mt-4 text-lg font-bold">{event.description}</p>
        ) : null}
      </header>

      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Saved draft categories</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {savedBillings.length === 0 ? (
            <p className="font-bold">No draft categories yet.</p>
          ) : (
            savedBillings.map((billing) => (
              <article
                key={billing.id}
                className="border-[3px] border-black bg-[#7dff7a] p-4 shadow-[5px_5px_0_#111]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black">{billing.category}</h3>
                    <p className="font-bold">
                      {currencyFormatter.format(billing.totalAmount)}
                    </p>
                    <p className="text-sm font-black uppercase">
                      {billing.splitMode === "BY_HOURS"
                        ? "By hours"
                        : "Split equally"}
                    </p>
                  </div>
                  <button
                    className="border-[3px] border-black bg-[#ff5fb7] px-3 py-1 font-black"
                    onClick={() => removeSavedBilling(billing.id)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Create draft category</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block font-black uppercase">Category</span>
            <input
              list="billing-categories"
              value={currentCategory}
              onChange={(event) => setCurrentCategory(event.target.value)}
              className="brutal-input w-full px-4 py-3 font-bold"
            />
            <datalist id="billing-categories">
              {DEFAULT_CATEGORIES.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <span className="mb-2 block font-black uppercase">
              Total amount
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              value={currentAmount}
              onChange={(event) =>
                setCurrentAmount(Number(event.target.value || 0))
              }
              className="brutal-input w-full px-4 py-3 font-bold"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-black uppercase">Split mode</span>
            <select
              value={splitMode}
              onChange={(event) =>
                setSplitMode(event.target.value as SplitMode)
              }
              className="brutal-input w-full px-4 py-3 font-bold"
            >
              <option value="BY_HOURS">By hours</option>
              <option value="EQUAL">
                Split equally among selected members
              </option>
            </select>
          </label>
        </div>

        <div className="mt-6 space-y-3">
          {calculatedCurrentGroup.length === 0 ? (
            <p className="border-[3px] border-black bg-[#ff9f1c] p-4 font-black shadow-[4px_4px_0_#111]">
              This event has no "Participating" voters yet, so billing cannot be
              created.
            </p>
          ) : (
            calculatedCurrentGroup.map((row) => (
              <BillingRow
                key={row.voterId}
                row={row}
                splitMode={splitMode}
                onToggle={updateEnabled}
                onHoursChange={updateHours}
              />
            ))
          )}
        </div>

        <button
          className="brutal-button mt-6 px-5 py-3 text-lg font-black"
          onClick={handleSaveCategory}
        >
          Save category
        </button>
      </section>

      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Estimated summary</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] border-[3px] border-black bg-white text-left font-bold">
            <thead className="bg-[#5dc9ff]">
              <tr>
                <th className="border-[3px] border-black p-3">Participant</th>
                <th className="border-[3px] border-black p-3">Total</th>
                <th className="border-[3px] border-black p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {finalSummary.map((row) => (
                <tr key={row.username}>
                  <td className="border-[3px] border-black p-3">
                    {row.username}
                  </td>
                  <td className="border-[3px] border-black p-3 font-black">
                    {currencyFormatter.format(row.totalDebt)}
                  </td>
                  <td className="border-[3px] border-black p-3">UNPAID</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          disabled={isPending || savedBillings.length === 0}
          className="brutal-button mt-6 px-5 py-3 text-lg font-black disabled:opacity-60"
          onClick={finalizeInvoice}
        >
          {isPending ? "Finalizing invoice..." : "Finalize & Publish invoice"}
        </button>
      </section>
    </section>
  );
}
