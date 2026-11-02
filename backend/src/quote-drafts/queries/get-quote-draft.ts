import { In } from 'typeorm'
import type { Deps } from '../../shared/boilerplate/deps'
import { ContractOrmEntity } from '../../contracts/infrastructure/database/contract.orm-entity'
import { DeviceOrmEntity } from '../../contracts/infrastructure/database/device.orm-entity'
import { PriceListOrmEntity } from '../../price-lists/infrastructure/database/price-list.orm-entity'
import { WorkOrderOrmEntity } from '../../work-orders/infrastructure/database/work-order.orm-entity'
import { toWorkOrderView } from '../../work-orders/queries/work-order-view'
import { LineKind } from '../domain/quote-draft'
import { draftQuoteStatus } from '../infrastructure/draft-quote-status'
import { loadDraftWorkOrders } from '../infrastructure/draft-work-orders'

/** The draft a work order belongs to, as the card shows it. Null when the work order is in no draft. */
export async function getQuoteDraftForWorkOrder(input: { workOrderId: string }, deps: Pick<Deps, 'db' | 'parts' | 'workOrders' | 'quoteDrafts' | 'quotes'>) {
  const draft = await deps.quoteDrafts.findByWorkOrder(input.workOrderId)
  if (!draft) return null

  const rows = await deps.db.getRepository(WorkOrderOrmEntity).findBy({ id: In(draft.workOrderIds) })
  const devices = await deps.db.getRepository(DeviceOrmEntity).find({ where: { id: In(rows.map((row) => row.deviceId)) }, relations: { building: true } })
  const parts = await deps.parts.findBy({ id: In(rows.flatMap((row) => row.items.flatMap((item) => (item.partId ? [item.partId] : [])))) })
  const [contract, priceList, quoteStatus, draftWorkOrders, [quote]] = await Promise.all([
    deps.db.getRepository(ContractOrmEntity).findOneByOrFail({ id: draft.contractId }),
    deps.db.getRepository(PriceListOrmEntity).findOneByOrFail({ id: draft.priceListId }),
    draftQuoteStatus(draft, deps),
    loadDraftWorkOrders(draft.workOrderIds, draft.pricingDate, deps),
    // Read live from Salesforce, like the work order's own quote.
    deps.quotes.findLive(draft.sfQuoteId ? [draft.sfQuoteId] : []),
  ])
  const numberOf = (workOrderId: string) => rows.find((row) => row.id === workOrderId)?.workOrderNumber ?? ''

  return {
    id: draft.id,
    contractNo: contract.contractNo,
    priceListId: priceList.id,
    priceListName: priceList.name,
    currency: draft.currency,
    status: draft.status,
    editable: draft.isEditable(quoteStatus),
    sendBlockers: draft.sendBlockers(draftWorkOrders),
    sfQuoteId: draft.sfQuoteId ?? null,
    quoteNumber: quote?.number ?? null,
    workOrders: draft.workOrderIds.map((id) => {
      const row = rows.find((r) => r.id === id)!
      const device = devices.find((d) => d.id === row.deviceId)
      const view = toWorkOrderView(row, parts)
      return {
        id,
        workOrderNumber: row.workOrderNumber,
        state: row.state,
        deviceNo: device?.deviceNo ?? '',
        buildingName: device?.building?.name ?? '',
        items: view.items.filter((item) => item.type !== 'TECH_SUPPORT'),
      }
    }),
    lines: draft.lines.map((line) => ({
      ...line,
      code: line.kind === LineKind.CONTRACT ? (line.code ?? null) : null,
      ruleCode: line.kind === LineKind.MANUAL ? (line.code ?? null) : null,
      coverage: line.coverage.map((covered) => ({ ...covered, workOrderNumber: numberOf(covered.workOrderId) })),
    })),
    total: draft.total,
  }
}
