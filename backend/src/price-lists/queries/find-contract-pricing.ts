import { In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm'
import type { Deps } from '../../shared/boilerplate/deps'
import { ContractDeviceOrmEntity } from '../../contracts/infrastructure/database/contract-device.orm-entity'
import { AmbiguousContractPricingError } from '../domain/errors'
import { ContractPriceListOrmEntity } from '../infrastructure/database/contract-price-list.orm-entity'
import { PriceListOrmEntity } from '../infrastructure/database/price-list.orm-entity'

/**
 * The price list that prices work on a device on a date: through the device's active contract, then the contract's
 * link that covers the date. Null when no link applies. Two links that both apply are refused, never guessed.
 */
export async function findContractPricing(input: { deviceId: string; on: Date }, deps: Pick<Deps, 'db'>) {
  const devices = await deps.db.getRepository(ContractDeviceOrmEntity).find({
    where: { deviceId: input.deviceId, isTerminated: false, startDate: LessThanOrEqual(input.on), endDate: MoreThanOrEqual(input.on) },
    relations: { contract: true },
  })
  if (!devices.length) return null
  const links = await deps.db.getRepository(ContractPriceListOrmEntity).findBy({
    contractId: In(devices.map((device) => device.contractId)),
    validFrom: LessThanOrEqual(input.on),
    validTo: MoreThanOrEqual(input.on),
  })
  if (!links.length) return null
  if (links.length > 1) throw new AmbiguousContractPricingError(`Device ${input.deviceId} has ${links.length} price lists on ${input.on.toISOString()}`)

  const [link] = links
  const contract = devices.find((device) => device.contractId === link.contractId)!.contract!
  const priceList = await deps.db.getRepository(PriceListOrmEntity).findOneByOrFail({ id: link.priceListId })
  return { contractId: contract.id, contractNo: contract.contractNo, priceList }
}

export type ContractPricing = NonNullable<Awaited<ReturnType<typeof findContractPricing>>>
