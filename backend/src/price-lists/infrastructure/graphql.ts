import type { Deps } from '../../shared/boilerplate/deps'
import { RuleKind, ruleText } from '../domain/price-list'
import { findContractPricing } from '../queries/find-contract-pricing'
import { searchPriceList } from '../queries/search-price-list'

export function priceListResolvers(deps: Deps) {
  return {
    Query: {
      priceListSearch: (_: unknown, args: { priceListId: string; search?: string }) => searchPriceList(args, deps),
    },
    PriceListRule: {
      lineText: (rule: { code: string | null; kind: RuleKind; value: number; description: string }) => ruleText(rule),
    },
    WorkOrderDetails: {
      contractPricing: (workOrder: { deviceId: string }) => findContractPricing({ deviceId: workOrder.deviceId, on: new Date() }, deps),
    },
  }
}
