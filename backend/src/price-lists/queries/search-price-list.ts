import { ILike } from 'typeorm'
import type { Deps } from '../../shared/boilerplate/deps'
import { isPickable } from '../domain/price-list'
import { PriceListBandOrmEntity } from '../infrastructure/database/price-list-band.orm-entity'
import { PriceListEntryOrmEntity } from '../infrastructure/database/price-list-entry.orm-entity'
import { PriceListRuleOrmEntity } from '../infrastructure/database/price-list-rule.orm-entity'

/** Entries and rules of a list version whose code, wording or section contains the search. */
export async function searchPriceList(input: { priceListId: string; search?: string; limit?: number }, deps: Pick<Deps, 'db'>) {
  const like = ILike(`%${(input.search ?? '').trim().replace(/[\\%_]/g, '\\$&')}%`)
  const { priceListId } = input
  const [entries, bands, rules] = await Promise.all([
    deps.db.getRepository(PriceListEntryOrmEntity).find({
      where: [
        { priceListId, code: like },
        { priceListId, wording: like },
        { priceListId, section: like },
      ],
      order: { position: 'ASC' },
      take: input.limit ?? 50,
    }),
    deps.db.getRepository(PriceListBandOrmEntity).find({ where: { priceListId }, order: { position: 'ASC' } }),
    deps.db.getRepository(PriceListRuleOrmEntity).find({ where: [{ priceListId, code: like }, { priceListId, description: like }] }),
  ])
  const band = (id: string | null) => bands.find((b) => b.id === id) ?? null
  return {
    entries: entries.map((entry) => ({
      ...entry,
      pickable: isPickable(entry),
      // In the band order the contract prints.
      rates: entry.rates.map((rate) => ({ ...rate, band: band(rate.bandId) })).sort((a, b) => (a.band?.position ?? 0) - (b.band?.position ?? 0)),
    })),
    rules,
  }
}
