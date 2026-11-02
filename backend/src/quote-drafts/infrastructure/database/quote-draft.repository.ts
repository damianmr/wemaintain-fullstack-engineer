import { DataSource, QueryFailedError } from 'typeorm'
import { QuoteDraftNotFoundError, WorkOrderNotEligibleError } from '../../domain/errors'
import { QuoteDraft } from '../../domain/quote-draft'
import { QuoteDraftLineOrmEntity } from './quote-draft-line.orm-entity'
import { QuoteDraftWorkOrderOrmEntity } from './quote-draft-work-order.orm-entity'
import { QuoteDraftOrmEntity } from './quote-draft.orm-entity'

export class QuoteDraftRepository {
  constructor(private readonly db: DataSource) {}

  async load(id: string): Promise<QuoteDraft> {
    const row = await this.db.getRepository(QuoteDraftOrmEntity).findOneBy({ id })
    if (!row) throw new QuoteDraftNotFoundError(`Cannot find quote draft ${id}`)
    return toDomain(row)
  }

  async findByWorkOrder(workOrderId: string): Promise<QuoteDraft | null> {
    const membership = await this.db.getRepository(QuoteDraftWorkOrderOrmEntity).findOneBy({ workOrderId })
    return membership ? this.load(membership.draftId) : null
  }

  async findBySalesforceQuote(sfQuoteId: string): Promise<QuoteDraft | null> {
    const row = await this.db.getRepository(QuoteDraftOrmEntity).findOneBy({ sfQuoteId })
    return row ? toDomain(row) : null
  }

  /** Saves the whole draft, replacing its work orders and lines. */
  async save(draft: QuoteDraft): Promise<QuoteDraft> {
    try {
      await this.db.transaction(async (em) => {
        await em.delete(QuoteDraftLineOrmEntity, { draftId: draft.id })
        await em.delete(QuoteDraftWorkOrderOrmEntity, { draftId: draft.id })
        await em.save(QuoteDraftOrmEntity, toRow(draft))
      })
    } catch (error) {
      if (error instanceof QueryFailedError && /quote_draft_work_order/.test(String((error as { detail?: string }).detail ?? error.message))) {
        throw new WorkOrderNotEligibleError('A work order of this draft is already in another draft')
      }
      throw error
    }
    return draft
  }
}

function toDomain(row: QuoteDraftOrmEntity): QuoteDraft {
  return new QuoteDraft({
    id: row.id,
    contractId: row.contractId,
    priceListId: row.priceListId,
    currency: row.currency,
    pricingDate: row.pricingDate,
    status: row.status,
    sfQuoteId: row.sfQuoteId ?? undefined,
    workOrderIds: [...row.workOrders].sort((a, b) => a.position - b.position).map((wo) => wo.workOrderId),
    lines: [...row.lines]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({
        id: line.id,
        kind: line.kind,
        rateId: line.rateId ?? undefined,
        ruleId: line.ruleId ?? undefined,
        reason: line.reason ?? undefined,
        note: line.note ?? undefined,
        code: line.code ?? undefined,
        customerText: line.customerText,
        bandLabel: line.bandLabel ?? undefined,
        unit: line.unit ?? undefined,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        total: line.total,
        coverage: line.coverage.map(({ workOrderId, itemId, quantity }) => ({ workOrderId, itemId, quantity })),
      })),
  })
}

function toRow(draft: QuoteDraft): QuoteDraftOrmEntity {
  return Object.assign(new QuoteDraftOrmEntity(), {
    id: draft.id,
    contractId: draft.contractId,
    priceListId: draft.priceListId,
    currency: draft.currency,
    pricingDate: draft.pricingDate,
    status: draft.status,
    sfQuoteId: draft.sfQuoteId ?? null,
    workOrders: draft.workOrderIds.map((workOrderId, position) => ({ workOrderId, draftId: draft.id, position })),
    lines: draft.lines.map((line, position) => ({
      id: line.id,
      draftId: draft.id,
      position,
      kind: line.kind,
      rateId: line.rateId ?? null,
      reason: line.reason ?? null,
      ruleId: line.ruleId ?? null,
      note: line.note ?? null,
      code: line.code ?? null,
      customerText: line.customerText,
      bandLabel: line.bandLabel ?? null,
      unit: line.unit ?? null,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      total: line.total,
      coverage: line.coverage.map((covered) => ({ ...covered, lineId: line.id })),
    })),
  })
}
