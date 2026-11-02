import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import type { PriceListEntryOrmEntity } from './price-list-entry.orm-entity'

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) }

/** The agreed price of an entry, in one band, or with no band when the list has none. */
@Entity({ schema: 'pricing', name: 'price_list_rate' })
@Unique(['entryId', 'bandId'])
export class PriceListRateOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column('uuid') entryId: string
  @Column('uuid', { nullable: true }) bandId: string | null
  @Column('decimal', { precision: 12, scale: 2, transformer: decimal }) amount: number
  @ManyToOne('PriceListEntryOrmEntity', 'rates', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry?: PriceListEntryOrmEntity
}
