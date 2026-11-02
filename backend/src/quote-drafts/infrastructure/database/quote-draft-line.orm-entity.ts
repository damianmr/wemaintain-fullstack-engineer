import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm'
import { LineKind, ManualReason } from '../../domain/quote-draft'
import type { QuoteDraftLineItemOrmEntity } from './quote-draft-line-item.orm-entity'
import type { QuoteDraftOrmEntity } from './quote-draft.orm-entity'

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) }

@Entity({ schema: 'workorders', name: 'quote_draft_line' })
export class QuoteDraftLineOrmEntity {
  @PrimaryColumn('uuid') id: string
  @Column('uuid') draftId: string
  @Column() position: number
  @Column('enum', { enum: LineKind }) kind: LineKind
  /** Contract lines: the rate that priced the line. */
  @Column('uuid', { nullable: true }) rateId: string | null
  /** Manual lines: the reason, and the contract rule followed, if any. */
  @Column('enum', { enum: ManualReason, nullable: true }) reason: ManualReason | null
  @Column('uuid', { nullable: true }) ruleId: string | null
  @Column('varchar', { nullable: true }) note: string | null
  @Column('varchar', { nullable: true }) code: string | null
  @Column() customerText: string
  @Column('varchar', { nullable: true }) bandLabel: string | null
  @Column('varchar', { nullable: true }) unit: string | null
  @Column('decimal', { precision: 12, scale: 2, transformer: decimal }) unitPrice: number
  @Column('int') quantity: number
  @Column('decimal', { precision: 12, scale: 2, transformer: decimal }) total: number
  @OneToMany('QuoteDraftLineItemOrmEntity', 'line', { cascade: true, eager: true }) coverage: QuoteDraftLineItemOrmEntity[]
  @ManyToOne('QuoteDraftOrmEntity', 'lines', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'draftId' })
  draft?: QuoteDraftOrmEntity
}
