import type { Deps } from '../../shared/boilerplate/deps'
import { ContractOrmEntity } from '../../contracts/infrastructure/database/contract.orm-entity'
import { PriceListNotFoundError } from '../domain/errors'
import { ContractPriceListOrmEntity } from '../infrastructure/database/contract-price-list.orm-entity'
import { PriceListOrmEntity } from '../infrastructure/database/price-list.orm-entity'

/** Links a contract to the latest version of a client's list, for the contract's own term. */
export async function linkContractToPriceList(input: { contractNo: string; client: string }, deps: Pick<Deps, 'db'>): Promise<ContractPriceListOrmEntity> {
  const contract = await deps.db.getRepository(ContractOrmEntity).findOneByOrFail({ contractNo: input.contractNo })
  const [list] = await deps.db.getRepository(PriceListOrmEntity).find({ where: { client: input.client }, order: { importedAt: 'DESC' }, take: 1 })
  if (!list) throw new PriceListNotFoundError(`No price list imported for ${input.client}`)
  return deps.db.getRepository(ContractPriceListOrmEntity).save({
    contractId: contract.id,
    priceListId: list.id,
    validFrom: contract.startDate,
    validTo: contract.endDate,
  })
}
