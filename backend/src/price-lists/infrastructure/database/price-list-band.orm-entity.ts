import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm'

/** A time band of a list version, such as Meridian's "After office hours". Stored once, so renaming it is one change. */
@Entity({ schema: 'pricing', name: 'price_list_band' })
@Unique(['priceListId', 'code'])
export class PriceListBandOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column('uuid') priceListId: string
  @Column() code: string
  @Column() label: string
  @Column() timeWindow: string
  @Column() position: number
}
