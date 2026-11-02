import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { RuleKind } from '../../domain/price-list'

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) }

/** A rule of a list version, kept apart from the prices so nothing reads it as money. */
@Entity({ schema: 'pricing', name: 'price_list_rule' })
export class PriceListRuleOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column('uuid') priceListId: string
  @Column('varchar', { nullable: true }) code: string | null
  @Column('enum', { enum: RuleKind }) kind: RuleKind
  @Column('decimal', { precision: 8, scale: 4, transformer: decimal }) value: number
  @Column() description: string
  @Column() appliesTo: string
  @Column('int', { nullable: true }) minQuantity: number | null
  @Column('int', { nullable: true }) maxQuantity: number | null
  @Column() source: string
}
