import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Says which list version prices a contract, and from when to when. This link is also the switch: a contract with a
 * link quotes through quote drafts, a contract without one keeps the old flow. A contract may have several links.
 */
@Entity({ schema: 'pricing', name: 'contract_price_list' })
export class ContractPriceListOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column('uuid') @Index() contractId: string
  @Column('uuid') priceListId: string
  @Column('timestamptz') validFrom: Date
  @Column('timestamptz') validTo: Date
}
