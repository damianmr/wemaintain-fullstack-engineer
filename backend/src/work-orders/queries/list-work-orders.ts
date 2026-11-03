import { ILike, In, IsNull, Not, Raw } from 'typeorm'
import { PRICED_DEVICES } from '../../price-lists/queries/priced-devices'
import { QuoteStatus } from '../../quotes/domain/quote'
import { DRAFTED_WORK_ORDERS } from '../../quote-drafts/queries/drafted-work-orders'
import type { Deps } from '../../shared/boilerplate/deps'
import { WorkOrderState } from '../domain/work-order'
import { WorkOrderOrmEntity } from '../infrastructure/database/work-order.orm-entity'
import { toWorkOrderView, WorkOrderView } from './work-order-view'

/** Devices of the clients whose company name contains the search. */
const CLIENT_DEVICES = `SELECT d.id FROM devices.device d
  JOIN buildings.building b ON b.id = d."buildingId"
  JOIN users.customer c ON c.id = b."customerId"
  WHERE c."companyName" ILIKE :search`

/** A filter on the work order's device: it must be in every one of these sets. */
const deviceIn = (sets: string[], params: Record<string, unknown>) =>
  sets.length ? { deviceId: Raw((column) => sets.map((set) => `${column} IN (${set})`).join(' AND '), params) } : {}

export enum QuoteFilter {
  NO_QUOTE = 'NO_QUOTE',
  IN_QUOTE_DRAFT = 'IN_QUOTE_DRAFT',
  OLD_WAY_DRAFT = 'OLD_WAY_DRAFT',
  OLD_WAY_PAST_DRAFT = 'OLD_WAY_PAST_DRAFT',
}

const inDraft = Raw((column) => `${column} IN (${DRAFTED_WORK_ORDERS})`)
const notInDraft = Raw((column) => `${column} NOT IN (${DRAFTED_WORK_ORDERS})`)

/** Where the work order's quote stands: none yet, in a quote draft, or a Salesforce quote made the old way. */
const QUOTE_FILTERS = {
  [QuoteFilter.NO_QUOTE]: { sfQuoteId: IsNull(), id: notInDraft },
  [QuoteFilter.IN_QUOTE_DRAFT]: { id: inDraft },
  [QuoteFilter.OLD_WAY_DRAFT]: { quoteStatus: QuoteStatus.DRAFT, id: notInDraft },
  [QuoteFilter.OLD_WAY_PAST_DRAFT]: { quoteStatus: Not(QuoteStatus.DRAFT), id: notInDraft },
}

export async function listWorkOrders(
  input: { limit?: number; offset?: number; states?: WorkOrderState[]; sfQuoteId?: string; buildingId?: string; search?: string; withPriceList?: boolean; quote?: QuoteFilter },
  deps: Pick<Deps, 'db'>,
): Promise<{ items: WorkOrderView[]; totalCount: number }> {
  const search = input.search && `%${input.search}%`
  const params = { buildingId: input.buildingId, search }
  const deviceSets = [
    ...(input.buildingId ? [`SELECT id FROM devices.device WHERE "buildingId" = :buildingId`] : []),
    ...(input.withPriceList ? [PRICED_DEVICES] : []),
  ]
  const filters = {
    ...(input.states?.length && { state: In(input.states) }),
    ...(input.sfQuoteId && { sfQuoteId: input.sfQuoteId }),
    ...(input.quote && QUOTE_FILTERS[input.quote]),
  }
  const where = search
    ? [
        { ...filters, ...deviceIn(deviceSets, params), workOrderNumber: ILike(search) },
        { ...filters, ...deviceIn(deviceSets, params), title: ILike(search) },
        { ...filters, ...deviceIn([...deviceSets, CLIENT_DEVICES], params) },
      ]
    : { ...filters, ...deviceIn(deviceSets, params) }
  const [rows, totalCount] = await deps.db.getRepository(WorkOrderOrmEntity).findAndCount({
    where,
    order: { createdAt: 'DESC' },
    take: input.limit ?? 50,
    skip: input.offset ?? 0,
  })
  return { items: rows.map((row) => toWorkOrderView(row)), totalCount }
}
