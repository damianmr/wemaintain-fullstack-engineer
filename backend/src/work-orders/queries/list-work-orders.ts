import { ILike, In, Raw } from 'typeorm'
import { PRICED_DEVICES } from '../../price-lists/queries/priced-devices'
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

export async function listWorkOrders(
  input: { limit?: number; offset?: number; states?: WorkOrderState[]; sfQuoteId?: string; buildingId?: string; search?: string; withPriceList?: boolean },
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
