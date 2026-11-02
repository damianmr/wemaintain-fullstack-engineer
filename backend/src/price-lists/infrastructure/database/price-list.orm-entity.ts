import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm'

/** One imported version of a client's list. */
@Entity({ schema: 'pricing', name: 'price_list' })
@Unique(['client', 'version'])
export class PriceListOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() client: string
  @Column() name: string
  @Column() currency: string
  @Column() sourceFile: string
  /** A hash of the source file: importing the same file twice gives the same version. */
  @Column() version: string
  @CreateDateColumn({ type: 'timestamptz' }) importedAt: Date
}
