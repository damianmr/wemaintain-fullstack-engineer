import type { Deps } from '../../shared/boilerplate/deps'
import { findContractPricing } from '../../price-lists/queries/find-contract-pricing'
import { WorkOrder, WorkOrderState } from '../../work-orders/domain/work-order'
import { ExternalPartItem, WorkOrderItemType } from '../../work-orders/domain/work-order-item'
import { DraftWorkOrder } from '../domain/quote-draft'

/** Reads work orders as a draft sees them: their contract on the pricing date, and whether supply is done. */
export async function loadDraftWorkOrders(ids: string[], on: Date, deps: Pick<Deps, 'db' | 'workOrders'>): Promise<DraftWorkOrder[]> {
  const workOrders = await deps.workOrders.find({ ids })
  return Promise.all(ids.map((id) => workOrders.find((wo) => wo.id === id)!).map((workOrder) => toDraftWorkOrder(workOrder, on, deps)))
}

export async function toDraftWorkOrder(workOrder: WorkOrder, on: Date, deps: Pick<Deps, 'db'>): Promise<DraftWorkOrder> {
  const pricing = await findContractPricing({ deviceId: workOrder.deviceId, on }, deps)
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    contractId: pricing?.contractId ?? null,
    isChargeable: workOrder.isChargeable,
    sfQuoteId: workOrder.sfQuoteId,
    waitingForParts:
      workOrder.state() === WorkOrderState.PART_TO_ESTIMATE || workOrder.items.some((item) => item instanceof ExternalPartItem && !item.partId),
    items: workOrder.items
      .filter((item) => item.type !== WorkOrderItemType.TECH_SUPPORT)
      .map((item) => ({ id: item.id, quantity: item.toProps().quantity ?? 1 })),
  }
}
