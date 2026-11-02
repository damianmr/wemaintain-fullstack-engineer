import { randomUUID } from 'node:crypto'
import { QuoteStatus } from '../../quotes/domain/quote'
import { customerText } from '../../price-lists/domain/price-list'
import { DraftNotEditableError, InvalidDraftLineError, WorkOrderNotEligibleError } from './errors'

export enum DraftStatus {
  // Being prepared; nothing in Salesforce yet.
  OPEN = 'OPEN',
  // Sent to Salesforce at least once. Still editable while the Salesforce quote is Draft.
  SENT = 'SENT',
}

export enum LineKind {
  // Priced by the server from the contract list; the CSM cannot change its price.
  CONTRACT = 'CONTRACT',
  // Typed by the CSM, with a reason: any price that does not come from the list.
  MANUAL = 'MANUAL',
}

export enum ManualReason {
  PART_NOT_ON_LIST = 'PART_NOT_ON_LIST',
  SUBCONTRACTED_WORK = 'SUBCONTRACTED_WORK',
  NEGOTIATED_PRICE = 'NEGOTIATED_PRICE',
  // Set when a draft adopts an existing Salesforce quote; a CSM does not pick it.
  IMPORTED = 'IMPORTED',
  OTHER = 'OTHER',
}

/** What a draft needs to know about a work order. */
export interface DraftWorkOrder {
  id: string
  workOrderNumber: string
  contractId: string | null
  isChargeable: boolean
  sfQuoteId?: string
  /** In PART_TO_ESTIMATE, or with an external part the supply team has not identified. */
  waitingForParts: boolean
  items: { id: string; quantity: number }[]
}

/** A repair item a line covers. These links are what C2 will learn matching from. */
export interface CoveredItem {
  workOrderId: string
  itemId: string
  quantity: number
}

export interface DraftLine {
  id: string
  kind: LineKind
  rateId?: string
  ruleId?: string
  reason?: ManualReason
  note?: string
  /** Copied when the line is added, so the line never changes if the list does. */
  code?: string
  customerText: string
  bandLabel?: string
  unit?: string
  unitPrice: number
  quantity: number
  total: number
  coverage: CoveredItem[]
}

export interface ContractRate {
  rateId: string
  amount: number
  entry: { code: string; wording: string; unit?: string | null }
  band?: { label: string } | null
}

export interface QuoteDraftProps {
  id: string
  contractId: string
  priceListId: string
  currency: string
  pricingDate: Date
  status: DraftStatus
  sfQuoteId?: string
  workOrderIds: string[]
  lines: DraftLine[]
}

/** One quote being prepared for one contract: every work order on the quote and every line the customer will read. */
export class QuoteDraft {
  readonly id: string
  readonly contractId: string
  readonly priceListId: string
  readonly currency: string
  readonly pricingDate: Date
  status: DraftStatus
  sfQuoteId?: string
  workOrderIds: string[]
  lines: DraftLine[]

  constructor(props: QuoteDraftProps) {
    Object.assign(this, props)
  }

  static start(
    input: { contractId: string; priceListId: string; currency: string; workOrder: DraftWorkOrder; pricingDate?: Date },
    id: string = randomUUID(),
  ): QuoteDraft {
    assertCanJoin(input.workOrder, input.contractId)
    return new QuoteDraft({
      id,
      contractId: input.contractId,
      priceListId: input.priceListId,
      currency: input.currency,
      pricingDate: input.pricingDate ?? new Date(),
      status: DraftStatus.OPEN,
      workOrderIds: [input.workOrder.id],
      lines: [],
    })
  }

  /** Takes over a Draft quote made the old way: its work orders come in, and its lines become manual lines to review. */
  static adopt(
    input: {
      contractId: string
      priceListId: string
      currency: string
      sfQuoteId: string
      workOrders: DraftWorkOrder[]
      lines: { customerText: string; quantity: number; unitPrice: number; note?: string }[]
    },
    id: string = randomUUID(),
  ): QuoteDraft {
    for (const workOrder of input.workOrders) {
      if (workOrder.contractId !== input.contractId) {
        throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber} is on another contract than the quote's first work order`)
      }
    }
    const draft = new QuoteDraft({
      id,
      contractId: input.contractId,
      priceListId: input.priceListId,
      currency: input.currency,
      pricingDate: new Date(),
      status: DraftStatus.SENT,
      sfQuoteId: input.sfQuoteId,
      workOrderIds: input.workOrders.map((workOrder) => workOrder.id),
      lines: [],
    })
    for (const line of input.lines) draft.addManualLine({ ...line, reason: ManualReason.IMPORTED, note: line.note ?? 'Imported from the existing Salesforce quote' }, true)
    return draft
  }

  /** Open drafts are editable; sent ones only while their Salesforce quote is still Draft. */
  isEditable(quoteStatus?: QuoteStatus | null): boolean {
    return this.status === DraftStatus.OPEN || quoteStatus === QuoteStatus.DRAFT
  }

  assertEditable(quoteStatus?: QuoteStatus | null): void {
    if (!this.isEditable(quoteStatus)) throw new DraftNotEditableError(`The quote has left Draft (${quoteStatus}): the draft can no longer change`)
  }

  addWorkOrder(workOrder: DraftWorkOrder): void {
    if (this.workOrderIds.includes(workOrder.id)) throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber} is already in the draft`)
    assertCanJoin(workOrder, this.contractId)
    this.workOrderIds.push(workOrder.id)
  }

  /** Only before the first send: after that, Salesforce links the work order to the quote. */
  removeWorkOrder(workOrderId: string): void {
    if (this.sfQuoteId) throw new DraftNotEditableError('Work orders cannot leave a draft once it has been sent to Salesforce')
    if (!this.workOrderIds.includes(workOrderId)) throw new WorkOrderNotEligibleError(`Work order ${workOrderId} is not in the draft`)
    if (this.workOrderIds.length === 1) throw new WorkOrderNotEligibleError('A draft keeps at least one work order')
    this.workOrderIds = this.workOrderIds.filter((id) => id !== workOrderId)
    for (const line of this.lines) line.coverage = line.coverage.filter((covered) => covered.workOrderId !== workOrderId)
  }

  addContractLine(input: { rate: ContractRate; quantity: number; coverage: { itemId: string; quantity: number }[] }, workOrders: DraftWorkOrder[]): DraftLine {
    const { rate, quantity } = input
    if (!rate.entry.unit) throw new InvalidDraftLineError(`${rate.entry.code} has no unit in the list: confirm it before quoting it`)
    assertWholeQuantity(quantity)
    return this.push({
      kind: LineKind.CONTRACT,
      rateId: rate.rateId,
      code: rate.entry.code,
      customerText: customerText(rate.entry, rate.band),
      bandLabel: rate.band?.label,
      unit: rate.entry.unit,
      unitPrice: rate.amount,
      quantity,
      coverage: this.coverage(input.coverage, workOrders),
    })
  }

  addManualLine(
    input: { customerText: string; quantity: number; unitPrice: number; reason: ManualReason; note?: string; rule?: { id: string; code?: string | null } },
    imported = false,
  ): DraftLine {
    if (!input.customerText.trim()) throw new InvalidDraftLineError('A manual line needs the text the customer will read')
    if (input.reason === ManualReason.IMPORTED && !imported) throw new InvalidDraftLineError('Only an adopted quote brings imported lines')
    if (!Number.isFinite(input.unitPrice)) throw new InvalidDraftLineError('A manual line needs a unit price')
    assertWholeQuantity(input.quantity)
    return this.push({
      kind: LineKind.MANUAL,
      reason: input.reason,
      note: input.note?.trim() || undefined,
      ruleId: input.rule?.id,
      code: input.rule?.code ?? undefined,
      customerText: input.customerText.trim(),
      unitPrice: input.unitPrice,
      quantity: input.quantity,
      coverage: [],
    })
  }

  removeLine(lineId: string): void {
    if (!this.lines.some((line) => line.id === lineId)) throw new InvalidDraftLineError(`Line ${lineId} is not in the draft`)
    this.lines = this.lines.filter((line) => line.id !== lineId)
  }

  /** Why the draft cannot go to Salesforce yet. Empty when it can. */
  sendBlockers(workOrders: DraftWorkOrder[]): string[] {
    return [
      ...(this.lines.length ? [] : ['Add at least one line.']),
      ...workOrders.filter((wo) => wo.waitingForParts).map((wo) => `${wo.workOrderNumber} is waiting for the supply team to identify its parts.`),
    ]
  }

  markSent(sfQuoteId: string): void {
    this.status = DraftStatus.SENT
    this.sfQuoteId = sfQuoteId
  }

  get total(): number {
    return round(this.lines.reduce((sum, line) => sum + line.total, 0))
  }

  private push(line: Omit<DraftLine, 'id' | 'total'>): DraftLine {
    const added = { ...line, id: randomUUID(), total: round(line.unitPrice * line.quantity) }
    this.lines.push(added)
    return added
  }

  /** A line may cover any repair item of the draft's work orders, up to the item's own quantity. */
  private coverage(requested: { itemId: string; quantity: number }[], workOrders: DraftWorkOrder[]): CoveredItem[] {
    return requested.map(({ itemId, quantity }) => {
      const workOrder = workOrders.find((wo) => this.workOrderIds.includes(wo.id) && wo.items.some((item) => item.id === itemId))
      if (!workOrder) throw new InvalidDraftLineError(`Repair item ${itemId} is not on a work order of the draft`)
      const item = workOrder.items.find((i) => i.id === itemId)!
      assertWholeQuantity(quantity)
      if (quantity > item.quantity) throw new InvalidDraftLineError(`${workOrder.workOrderNumber} has only ${item.quantity} of that item`)
      return { workOrderId: workOrder.id, itemId, quantity }
    })
  }
}

function assertCanJoin(workOrder: DraftWorkOrder, contractId: string): void {
  if (workOrder.contractId !== contractId) throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber} is not on the draft's contract`)
  if (!workOrder.isChargeable) throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber} is not chargeable`)
  if (workOrder.sfQuoteId) throw new WorkOrderNotEligibleError(`${workOrder.workOrderNumber} already has a Salesforce quote`)
}

// Almost no past quote line has a decimal quantity, so C1 takes whole numbers only.
function assertWholeQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) throw new InvalidDraftLineError(`Quantities are whole numbers from 1: got ${quantity}`)
}

const round = (amount: number) => Math.round(amount * 100) / 100
