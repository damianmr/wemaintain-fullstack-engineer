import { In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm'
import type { Deps } from '../../shared/boilerplate/deps'
import { ContractDeviceOrmEntity } from '../../contracts/infrastructure/database/contract-device.orm-entity'
import { DeviceOrmEntity } from '../../contracts/infrastructure/database/device.orm-entity'
import { WorkOrderState } from '../../work-orders/domain/work-order'
import { WorkOrderOrmEntity } from '../../work-orders/infrastructure/database/work-order.orm-entity'
import { QuoteDraftWorkOrderOrmEntity } from '../infrastructure/database/quote-draft-work-order.orm-entity'

/** Work orders that can join a draft: on its contract, in any building, chargeable, open, with no quote and no draft. */
export async function findDraftCandidates(input: { draftId: string }, deps: Pick<Deps, 'db' | 'quoteDrafts'>) {
  const draft = await deps.quoteDrafts.load(input.draftId)
  const covered = await deps.db.getRepository(ContractDeviceOrmEntity).find({
    where: { contractId: draft.contractId, isTerminated: false, startDate: LessThanOrEqual(draft.pricingDate), endDate: MoreThanOrEqual(draft.pricingDate) },
  })
  const drafted = await deps.db.getRepository(QuoteDraftWorkOrderOrmEntity).find()
  const rows = await deps.db.getRepository(WorkOrderOrmEntity).find({
    where: {
      deviceId: In(covered.map((link) => link.deviceId)),
      id: Not(In(drafted.map((member) => member.workOrderId))),
      chargeable: true,
      sfQuoteId: IsNull(),
      state: In([WorkOrderState.QUOTE_TO_SEND, WorkOrderState.PART_TO_ESTIMATE]),
    },
    order: { createdAt: 'DESC' },
    take: 50,
  })
  const devices = await deps.db.getRepository(DeviceOrmEntity).find({ where: { id: In(rows.map((row) => row.deviceId)) }, relations: { building: true } })
  return rows.map((row) => {
    const device = devices.find((d) => d.id === row.deviceId)
    return {
      id: row.id,
      workOrderNumber: row.workOrderNumber,
      title: row.title ?? row.description,
      state: row.state,
      deviceNo: device?.deviceNo ?? '',
      buildingName: device?.building?.name ?? '',
    }
  })
}
