import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GraphQLScalarType } from 'graphql'
import { createSchema, createYoga } from 'graphql-yoga'
import { contractResolvers } from '../../contracts/infrastructure/graphql'
import { partResolvers } from '../../parts/infrastructure/graphql'
import { priceListResolvers } from '../../price-lists/infrastructure/graphql'
import { workOrderResolvers } from '../../work-orders/infrastructure/graphql'
import type { Deps } from './deps'

const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value) => (value instanceof Date ? value.toISOString() : String(value)),
})

export function createGraphqlServer(deps: Deps) {
  const resolvers: Record<string, object> = { DateTime }
  for (const moduleResolvers of [workOrderResolvers, contractResolvers, partResolvers, priceListResolvers]) {
    for (const [type, fields] of Object.entries(moduleResolvers(deps))) {
      resolvers[type] = { ...resolvers[type], ...fields }
    }
  }
  const typeDefs = readFileSync(join(__dirname, '..', '..', 'schema.graphql'), 'utf8')
  return createYoga({ schema: createSchema({ typeDefs, resolvers }), maskedErrors: false })
}
