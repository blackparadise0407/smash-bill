'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import BillingRow from '@/components/BillingRow'
import type { BillingMemberDraft, BillingParticipant, FinalSummaryRow, SavedBillingDraft, SplitMode } from '@/types/billing'

type EventInfo = {
  id: string
  name: string
  description: string | null
  status: string
}

type Props = {
  eventId: string
}

const DEFAULT_HOURS = 2
const DEFAULT_CATEGORIES = ['Sân cầu lông', 'Ăn uống', 'Tiền nước', 'Khác']

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

function roundMoney(value: number) {
  return Math.round(value)
}

function buildInitialGroup(participants: BillingParticipant[]): BillingMemberDraft[] {
  return participants.map((participant) => ({
    voterId: participant.id,
    username: participant.username,
    enabled: true,
    hours: DEFAULT_HOURS,
    amount: 0,
  }))
}

function recalculateGroup(group: BillingMemberDraft[], totalAmount: number, splitMode: SplitMode) {
  const enabledRows = group.filter((row) => row.enabled)

  if (enabledRows.length === 0 || totalAmount <= 0) {
    return group.map((row) => ({ ...row, amount: 0 }))
  }

  if (splitMode === 'EQUAL') {
    const amountPerMember = roundMoney(totalAmount / enabledRows.length)

    return group.map((row) => ({
      ...row,
      amount: row.enabled ? amountPerMember : 0,
    }))
  }

  const totalHours = enabledRows.reduce((sum, row) => sum + row.hours, 0)

  if (totalHours <= 0) {
    return group.map((row) => ({ ...row, amount: 0 }))
  }

  return group.map((row) => ({
    ...row,
    amount: row.enabled ? roundMoney((totalAmount / totalHours) * row.hours) : 0,
  }))
}

export default function BillingClient({ eventId }: Props) {
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [participants, setParticipants] = useState<BillingParticipant[]>([])
  const [savedBillings, setSavedBillings] = useState<SavedBillingDraft[]>([])
  const [currentCategory, setCurrentCategory] = useState(DEFAULT_CATEGORIES[0])
  const [currentAmount, setCurrentAmount] = useState(0)
  const [splitMode, setSplitMode] = useState<SplitMode>('BY_HOURS')
  const [currentGroup, setCurrentGroup] = useState<BillingMemberDraft[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const loadInvoiceSeed = useCallback(async () => {
    setIsLoading(true)
    const response = await fetch(`/api/event/${eventId}/invoice`, { cache: 'no-store' })
    const data = await response.json()

    if (!response.ok) {
      setMessage(data.message ?? 'Không thể tải dữ liệu billing.')
      setIsLoading(false)
      return
    }

    setEvent(data.event)
    setParticipants(data.participants ?? [])
    setCurrentGroup(buildInitialGroup(data.participants ?? []))
    setIsLoading(false)
  }, [eventId])

  useEffect(() => {
    loadInvoiceSeed()
  }, [loadInvoiceSeed])

  // useMemo giúp bảng row và preview chỉ tính lại khi amount/group/split mode thay đổi.
  const calculatedCurrentGroup = useMemo(
    () => recalculateGroup(currentGroup, currentAmount, splitMode),
    [currentAmount, currentGroup, splitMode],
  )

  const currentTotalHours = useMemo(
    () => calculatedCurrentGroup.filter((row) => row.enabled).reduce((sum, row) => sum + row.hours, 0),
    [calculatedCurrentGroup],
  )

  const finalSummary: FinalSummaryRow[] = useMemo(() => {
    const summaryByUsername = new Map<string, number>()

    participants.forEach((participant) => {
      summaryByUsername.set(participant.username, 0)
    })

    savedBillings.forEach((billing) => {
      billing.details.forEach((detail) => {
        summaryByUsername.set(detail.username, (summaryByUsername.get(detail.username) ?? 0) + detail.amount)
      })
    })

    return Array.from(summaryByUsername.entries()).map(([username, totalDebt]) => ({
      username,
      totalDebt,
    }))
  }, [participants, savedBillings])

  function updateEnabled(voterId: string, enabled: boolean) {
    setCurrentGroup((group) => group.map((row) => (row.voterId === voterId ? { ...row, enabled } : row)))
  }

  function updateHours(voterId: string, hours: number) {
    setCurrentGroup((group) =>
      group.map((row) => (row.voterId === voterId ? { ...row, hours: Math.max(0, hours) } : row)),
    )
  }

  function resetCurrentCategoryForm() {
    setCurrentAmount(0)
    setCurrentCategory(DEFAULT_CATEGORIES[0])
    setSplitMode('BY_HOURS')
    setCurrentGroup(buildInitialGroup(participants))
  }

  function handleSaveCategory() {
    if (!currentCategory.trim()) {
      setMessage('Vui lòng nhập hạng mục.')
      return
    }

    if (currentAmount <= 0) {
      setMessage('Tổng số tiền phải lớn hơn 0.')
      return
    }

    if (!calculatedCurrentGroup.some((row) => row.enabled)) {
      setMessage('Cần chọn ít nhất một người cho hạng mục này.')
      return
    }

    if (splitMode === 'BY_HOURS' && currentTotalHours <= 0) {
      setMessage('Tổng số giờ phải lớn hơn 0 nếu chia theo giờ.')
      return
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
    ])
    setMessage('Đã lưu nháp hạng mục. Bạn có thể nhập tiếp hạng mục khác.')
    resetCurrentCategoryForm()
  }

  function removeSavedBilling(id: string) {
    setSavedBillings((billings) => billings.filter((billing) => billing.id !== id))
  }

  function finalizeInvoice() {
    if (savedBillings.length === 0) {
      setMessage('Cần có ít nhất một hạng mục nháp trước khi chốt hóa đơn.')
      return
    }

    startTransition(async () => {
      const response = await fetch(`/api/event/${eventId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      })
      const data = await response.json()

      setMessage(data.message ?? (response.ok ? 'Đã chốt hóa đơn.' : 'Không thể chốt hóa đơn.'))

      if (response.ok) {
        await loadInvoiceSeed()
      }
    })
  }

  if (isLoading) {
    return (
      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Đang tải dữ liệu billing...</h2>
      </section>
    )
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
          Billing · {event?.status ?? 'OPEN'}
        </p>
        <h1 className="text-4xl font-black md:text-6xl">{event?.name ?? 'Event billing'}</h1>
        {event?.description ? <p className="mt-4 text-lg font-bold">{event.description}</p> : null}
      </header>

      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Hạng mục đã lưu nháp</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {savedBillings.length === 0 ? (
            <p className="font-bold">Chưa có hạng mục nháp nào.</p>
          ) : (
            savedBillings.map((billing) => (
              <article key={billing.id} className="border-[3px] border-black bg-[#7dff7a] p-4 shadow-[5px_5px_0_#111]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black">{billing.category}</h3>
                    <p className="font-bold">{currencyFormatter.format(billing.totalAmount)}</p>
                    <p className="text-sm font-black uppercase">{billing.splitMode === 'BY_HOURS' ? 'Chia theo giờ' : 'Chia đều'}</p>
                  </div>
                  <button className="border-[3px] border-black bg-[#ff5fb7] px-3 py-1 font-black" onClick={() => removeSavedBilling(billing.id)}>
                    Xóa
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Tạo nháp hạng mục</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block font-black uppercase">Hạng mục</span>
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
            <span className="mb-2 block font-black uppercase">Tổng số tiền</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={currentAmount}
              onChange={(event) => setCurrentAmount(Number(event.target.value || 0))}
              className="brutal-input w-full px-4 py-3 font-bold"
            />
          </label>

          <label className="block">
            <span className="mb-2 block font-black uppercase">Cách chia</span>
            <select
              value={splitMode}
              onChange={(event) => setSplitMode(event.target.value as SplitMode)}
              className="brutal-input w-full px-4 py-3 font-bold"
            >
              <option value="BY_HOURS">Chia theo giờ</option>
              <option value="EQUAL">Chia đều người được tick</option>
            </select>
          </label>
        </div>

        <div className="mt-6 space-y-3">
          {calculatedCurrentGroup.length === 0 ? (
            <p className="border-[3px] border-black bg-[#ff9f1c] p-4 font-black shadow-[4px_4px_0_#111]">
              Event này chưa có voter “Tham gia”, nên chưa thể tạo billing.
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

        <button className="brutal-button mt-6 px-5 py-3 text-lg font-black" onClick={handleSaveCategory}>
          Lưu hạng mục
        </button>
      </section>

      <section className="brutal-card bg-[#fff7e6] p-6">
        <h2 className="text-3xl font-black">Tổng kết dự kiến</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] border-[3px] border-black bg-white text-left font-bold">
            <thead className="bg-[#5dc9ff]">
              <tr>
                <th className="border-[3px] border-black p-3">Người chơi</th>
                <th className="border-[3px] border-black p-3">Tổng tiền</th>
                <th className="border-[3px] border-black p-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {finalSummary.map((row) => (
                <tr key={row.username}>
                  <td className="border-[3px] border-black p-3">{row.username}</td>
                  <td className="border-[3px] border-black p-3 font-black">{currencyFormatter.format(row.totalDebt)}</td>
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
          {isPending ? 'Đang chốt hóa đơn...' : 'Chốt & Xuất hóa đơn'}
        </button>
      </section>
    </section>
  )
}
