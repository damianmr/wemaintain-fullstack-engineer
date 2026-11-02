import type { Deps } from '../../shared/boilerplate/deps'
import { findContractPricing } from '../queries/find-contract-pricing'
import { searchPriceList } from '../queries/search-price-list'

export function priceListResolvers(deps: Deps) {
  return {
    Query: {
      priceListSearch: (_: unknown, args: { priceListId: string; search?: string }) => searchPriceList(args, deps),
    },
    WorkOrderDetails: {
      contractPricing: (workOrder: { deviceId: string }) => findContractPricing({ deviceId: workOrder.deviceId, on: new Date() }, deps),
    },
  }
}
