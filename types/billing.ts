export type BillingParticipant = {
  id: string
  username: string
}

export type SplitMode = 'BY_HOURS' | 'EQUAL'

export type BillingMemberDraft = {
  voterId: string
  username: string
  enabled: boolean
  hours: number
  amount: number
}

export type SavedBillingDraft = {
  id: string
  category: string
  totalAmount: number
  splitMode: SplitMode
  details: BillingMemberDraft[]
}


export type FinalizedBillingDetail = {
  username: string
  hours: number
  amount: number
}

export type FinalizedBillingSummary = {
  id: string
  category: string
  totalAmount: number
  details: FinalizedBillingDetail[]
}

export type InvoiceStatus = 'UNPAID' | 'PAID'

export type FinalSummaryRow = {
  username: string
  totalDebt: number
  status: InvoiceStatus
}
