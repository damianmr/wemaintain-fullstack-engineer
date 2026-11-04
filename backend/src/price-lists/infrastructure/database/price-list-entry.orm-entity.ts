import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm'
import type { PriceListRateOrmEntity } from './price-list-rate.orm-entity'

/** A priced operation of a list version, such as 0435AS or SOR item 65. */
@Entity({ schema: 'pricing', name: 'price_list_entry' })
@Unique(['priceListId', 'code'])
export class PriceListEntryOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column('uuid') priceListId: string
  @Column() code: string
  @Column() section: string
  @Column() wording: string
  @Column('varchar', { nullable: true }) unit: string | null
  @Column('varchar', { nullable: true }) notes: string | null
  @Column() position: number
  @OneToMany('PriceListRateOrmEntity', 'entry', { cascade: true, eager: true }) rates: PriceListRateOrmEntity[]
}
