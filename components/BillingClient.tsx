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
  FinalizedBillingSummary,
  FinalSummaryRow,
  InvoiceStatus,
  SavedBillingDraft,
  SplitMode,
} from "@/types/billing";

type EventInfo = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

type FinalizedDebt = {
  username: string;
  totalDebt: number;
  status: InvoiceStatus;
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

const INVOICE_EXPORT_WIDTH = 1200;
const INVOICE_EXPORT_PADDING = 64;
const INVOICE_EXPORT_ROW_HEIGHT = 76;

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function roundMoney(value: number) {
  return Math.round(value);
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (context.measureText(nextLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });

  return lines.length * lineHeight;
}

function createInvoicePngBlob(
  event: EventInfo | null,
  rows: FinalSummaryRow[],
  billings: FinalizedBillingSummary[],
  finalizedAt: Date,
) {
  return new Promise<Blob>((resolve, reject) => {
    const rowCount = Math.max(rows.length, 1);
    const billingCount = Math.max(billings.length, 0);
    const canvas = document.createElement("canvas");
    canvas.width = INVOICE_EXPORT_WIDTH;
    canvas.height =
      620 +
      rowCount * INVOICE_EXPORT_ROW_HEIGHT +
      (billingCount > 0 ? 140 + billingCount * INVOICE_EXPORT_ROW_HEIGHT : 0);

    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("Unable to create invoice image."));
      return;
    }

    context.fillStyle = "#f8f13d";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#fff7e6";
    context.strokeStyle = "#111111";
    context.lineWidth = 8;
    context.fillRect(32, 32, canvas.width - 64, canvas.height - 64);
    context.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

    context.fillStyle = "#ff5fb7";
    context.fillRect(64, 64, canvas.width - 128, 120);
    context.strokeRect(64, 64, canvas.width - 128, 120);

    context.fillStyle = "#111111";
    context.font = "900 52px Arial, Helvetica, sans-serif";
    context.fillText("Final Invoice", INVOICE_EXPORT_PADDING + 24, 132);

    context.font = "700 28px Arial, Helvetica, sans-serif";
    context.fillText(
      finalizedAt.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      INVOICE_EXPORT_WIDTH - 350,
      132,
    );

    let y = 240;
    context.font = "900 42px Arial, Helvetica, sans-serif";
    y += drawWrappedText(
      context,
      event?.name ?? "Event billing",
      INVOICE_EXPORT_PADDING,
      y,
      INVOICE_EXPORT_WIDTH - INVOICE_EXPORT_PADDING * 2,
      48,
    );

    if (event?.description) {
      context.font = "700 24px Arial, Helvetica, sans-serif";
      y += drawWrappedText(
        context,
        event.description,
        INVOICE_EXPORT_PADDING,
        y + 18,
        INVOICE_EXPORT_WIDTH - INVOICE_EXPORT_PADDING * 2,
        32,
      );
    }

    y += 40;
    const tableX = INVOICE_EXPORT_PADDING;
    const tableWidth = INVOICE_EXPORT_WIDTH - INVOICE_EXPORT_PADDING * 2;
    const participantWidth = 500;
    const totalWidth = 360;

    context.fillStyle = "#5dc9ff";
    context.fillRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
    context.strokeRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
    context.fillStyle = "#111111";
    context.font = "900 26px Arial, Helvetica, sans-serif";
    context.fillText("Participant", tableX + 24, y + 48);
    context.fillText("Total", tableX + participantWidth + 24, y + 48);
    context.fillText(
      "Status",
      tableX + participantWidth + totalWidth + 24,
      y + 48,
    );

    y += INVOICE_EXPORT_ROW_HEIGHT;
    context.font = "800 28px Arial, Helvetica, sans-serif";

    if (rows.length === 0) {
      context.fillStyle = "#ffffff";
      context.fillRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
      context.strokeRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
      context.fillStyle = "#111111";
      context.fillText("No invoice totals available.", tableX + 24, y + 48);
    } else {
      rows.forEach((row, index) => {
        context.fillStyle = index % 2 === 0 ? "#ffffff" : "#fffbd1";
        context.fillRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
        context.strokeRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
        context.fillStyle = "#111111";
        context.fillText(row.username, tableX + 24, y + 48);
        context.fillText(
          currencyFormatter.format(row.totalDebt),
          tableX + participantWidth + 24,
          y + 48,
        );
        context.fillText(
          row.status,
          tableX + participantWidth + totalWidth + 24,
          y + 48,
        );
        y += INVOICE_EXPORT_ROW_HEIGHT;
      });
    }

    if (billings.length > 0) {
      y += 96;
      context.fillStyle = "#ff9f1c";
      context.fillRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
      context.strokeRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
      context.fillStyle = "#111111";
      context.font = "900 26px Arial, Helvetica, sans-serif";
      context.fillText("Category", tableX + 24, y + 48);
      context.fillText("Amount", tableX + participantWidth + 24, y + 48);

      y += INVOICE_EXPORT_ROW_HEIGHT;
      context.font = "800 28px Arial, Helvetica, sans-serif";

      billings.forEach((billing, index) => {
        context.fillStyle = index % 2 === 0 ? "#ffffff" : "#fffbd1";
        context.fillRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
        context.strokeRect(tableX, y, tableWidth, INVOICE_EXPORT_ROW_HEIGHT);
        context.fillStyle = "#111111";
        context.fillText(billing.category, tableX + 24, y + 48);
        context.fillText(
          currencyFormatter.format(billing.totalAmount),
          tableX + participantWidth + 24,
          y + 48,
        );
        y += INVOICE_EXPORT_ROW_HEIGHT;
      });
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to export invoice PNG."));
          return;
        }

        resolve(blob);
      },
      "image/png",
      0.92,
    );
  });
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
  const [finalizedDebts, setFinalizedDebts] = useState<FinalizedDebt[]>([]);
  const [finalizedBillings, setFinalizedBillings] = useState<
    FinalizedBillingSummary[]
  >([]);
  const [currentCategory, setCurrentCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [currentAmount, setCurrentAmount] = useState(0);
  const [splitMode, setSplitMode] = useState<SplitMode>("BY_HOURS");
  const [currentGroup, setCurrentGroup] = useState<BillingMemberDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
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
    setFinalizedDebts(data.debts ?? []);
    setFinalizedBillings(data.billings ?? []);
    setCurrentGroup(buildInitialGroup(data.participants ?? []));
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadInvoiceSeed();
    });
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
    if (finalizedDebts.length > 0) {
      return finalizedDebts.map((debt) => ({
        username: debt.username,
        totalDebt: debt.totalDebt,
        status: debt.status,
      }));
    }

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
        status: "UNPAID",
      }),
    );
  }, [finalizedDebts, participants, savedBillings]);

  const hasInvoiceSummary =
    finalizedDebts.length > 0 ||
    finalizedBillings.length > 0 ||
    savedBillings.length > 0;

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

    setFinalizedDebts([]);
    setFinalizedBillings([]);
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
    setFinalizedDebts([]);
    setFinalizedBillings([]);
    setSavedBillings((billings) =>
      billings.filter((billing) => billing.id !== id),
    );
  }

  async function copyInvoiceAsPng() {
    if (!hasInvoiceSummary) {
      setMessage("Save or finalize an invoice before exporting it.");
      return;
    }

    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      setMessage(
        "Your browser does not support copying image files to the clipboard.",
      );
      return;
    }

    if (ClipboardItem.supports && !ClipboardItem.supports("image/png")) {
      setMessage("Your browser does not support copying PNG files yet.");
      return;
    }

    setIsExporting(true);

    try {
      const blob = await createInvoicePngBlob(
        event,
        finalSummary,
        finalizedBillings,
        new Date(),
      );

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setMessage("Invoice PNG copied to clipboard.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to copy invoice PNG to the clipboard.",
      );
    } finally {
      setIsExporting(false);
    }
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
        setFinalizedDebts(data.debts ?? []);
        await loadInvoiceSeed();
      }
    });
  }

  function updatePaymentStatus(username: string, paid: boolean) {
    if (finalizedDebts.length === 0) {
      setMessage("Finalize the invoice before marking payments as paid.");
      return;
    }

    const status: InvoiceStatus = paid ? "PAID" : "UNPAID";

    startTransition(async () => {
      const response = await fetch(`/api/event/${eventId}/invoice`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, status }),
      });
      const data = await response.json();

      setMessage(
        data.message ??
          (response.ok
            ? "Payment status updated."
            : "Unable to update payment status."),
      );

      if (!response.ok) {
        return;
      }

      setFinalizedDebts((debts) =>
        debts.map((debt) =>
          debt.username === username
            ? {
                ...debt,
                totalDebt: data.debt?.totalDebt ?? debt.totalDebt,
                status: data.debt?.status ?? status,
              }
            : debt,
        ),
      );
      setEvent((currentEvent) =>
        currentEvent && data.eventStatus
          ? { ...currentEvent, status: data.eventStatus }
          : currentEvent,
      );
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
              This event has no &quot;Participating&quot; voters yet, so billing cannot be
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

      {finalizedBillings.length > 0 ? (
        <section className="brutal-card bg-[#fff7e6] p-6">
          <h2 className="text-3xl font-black">Finalized categories</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {finalizedBillings.map((billing) => (
              <article
                key={billing.id}
                className="border-[3px] border-black bg-[#7dff7a] p-4 shadow-[5px_5px_0_#111]"
              >
                <h3 className="text-xl font-black">{billing.category}</h3>
                <p className="font-bold">
                  {currencyFormatter.format(billing.totalAmount)}
                </p>
                <p className="mt-2 text-sm font-black uppercase">
                  {billing.details.length} participants billed
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">
          {finalizedDebts.length > 0 ? "Final invoice" : "Estimated summary"}
        </h2>
        {finalizedDebts.length === 0 ? (
          <p className="mt-3 font-bold">
            Finalize this invoice before marking participant payments as paid.
          </p>
        ) : null}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] border-[3px] border-black bg-white text-left font-bold">
            <thead className="bg-[#5dc9ff]">
              <tr>
                <th className="border-[3px] border-black p-3">Paid</th>
                <th className="border-[3px] border-black p-3">Participant</th>
                <th className="border-[3px] border-black p-3">Total</th>
                <th className="border-[3px] border-black p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {finalSummary.map((row) => (
                <tr key={row.username}>
                  <td className="border-[3px] border-black p-3">
                    <label className="flex w-fit items-center gap-2 font-black uppercase">
                      <input
                        type="checkbox"
                        checked={row.status === "PAID"}
                        disabled={isPending || finalizedDebts.length === 0}
                        className="h-5 w-5 accent-[#7dff7a] disabled:opacity-60"
                        aria-label={`Mark ${row.username} as paid`}
                        onChange={(event) =>
                          updatePaymentStatus(
                            row.username,
                            event.target.checked,
                          )
                        }
                      />
                      <span className="text-sm">Paid</span>
                    </label>
                  </td>
                  <td className="border-[3px] border-black p-3">
                    {row.username}
                  </td>
                  <td className="border-[3px] border-black p-3 font-black">
                    {currencyFormatter.format(row.totalDebt)}
                  </td>
                  <td className="border-[3px] border-black p-3">
                    <span
                      className={`inline-block border-[3px] border-black px-3 py-1 text-sm font-black uppercase shadow-[3px_3px_0_#111] ${
                        row.status === "PAID"
                          ? "bg-[#7dff7a]"
                          : "bg-[#ff9f1c]"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <button
            disabled={isPending || savedBillings.length === 0}
            className="brutal-button px-5 py-3 text-lg font-black disabled:opacity-60"
            onClick={finalizeInvoice}
          >
            {isPending ? "Finalizing invoice..." : "Finalize & Publish invoice"}
          </button>
          <button
            disabled={isExporting || !hasInvoiceSummary}
            className="brutal-button bg-[#5dc9ff] px-5 py-3 text-lg font-black disabled:opacity-60"
            onClick={copyInvoiceAsPng}
          >
            {isExporting ? "Copying PNG..." : "Copy invoice PNG"}
          </button>
        </div>
      </section>
    </section>
  );
}
