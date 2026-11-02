import type { Deps } from '../../shared/boilerplate/deps'
import { checkPriceList, PriceListContent } from '../domain/price-list'
import { PriceListBandOrmEntity } from '../infrastructure/database/price-list-band.orm-entity'
import { PriceListEntryOrmEntity } from '../infrastructure/database/price-list-entry.orm-entity'
import { PriceListRuleOrmEntity } from '../infrastructure/database/price-list-rule.orm-entity'
import { PriceListOrmEntity } from '../infrastructure/database/price-list.orm-entity'

/** Saves a list as a new version. Importing the same version again changes nothing. */
export async function importPriceList(input: { content: PriceListContent; version: string }, deps: Pick<Deps, 'db'>): Promise<PriceListOrmEntity> {
  const { content, version } = input
  checkPriceList(content)
  const existing = await deps.db.getRepository(PriceListOrmEntity).findOneBy({ client: content.client, version })
  if (existing) return existing

  return deps.db.transaction(async (em) => {
    const { client, name, currency, sourceFile } = content
    const list = await em.save(PriceListOrmEntity, em.create(PriceListOrmEntity, { client, name, currency, sourceFile, version }))
    const bands = await em.save(
      PriceListBandOrmEntity,
      content.bands.map((band, position) => em.create(PriceListBandOrmEntity, { ...band, priceListId: list.id, position })),
    )
    const bandId = new Map(bands.map((band) => [band.code, band.id]))
    await em.save(
      PriceListEntryOrmEntity,
      content.entries.map((entry, position) =>
        em.create(PriceListEntryOrmEntity, {
          priceListId: list.id,
          code: entry.code,
          section: entry.section,
          wording: entry.wording,
          unit: entry.unit ?? null,
          notes: entry.notes ?? null,
          position,
          rates: entry.rates.map((rate) => ({ amount: rate.amount, bandId: rate.bandCode ? bandId.get(rate.bandCode)! : null })),
        }),
      ),
    )
    await em.save(
      PriceListRuleOrmEntity,
      content.rules.map((rule) =>
        em.create(PriceListRuleOrmEntity, {
          ...rule,
          priceListId: list.id,
          code: rule.code ?? null,
          minQuantity: rule.minQuantity ?? null,
          maxQuantity: rule.maxQuantity ?? null,
        }),
      ),
    )
    return list
  })
}
