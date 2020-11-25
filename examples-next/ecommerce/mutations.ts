// @ts-ignore
import { graphQLSchemaExtension } from '@keystone-next/keystone/schema';
import addToCart from './mutations/addToCart';
import checkout from './mutations/checkout';
import resetPassword from './mutations/resetPassword';
import requestReset from './mutations/requestReset';

// This is a "Fake graphql" hack so we get highlighting of strings in vs code
const graphql = String.raw;

export const extendGraphqlSchema = graphQLSchemaExtension({
  typeDefs: graphql`
    type Message {
      message: String
    }
    type Mutation {
      addToCart(productId: ID): CartItem
      checkout(token: String!): Order
      resetPassword(resetToken: String!, password: String!, confirmPassword: String!): Message
      requestReset(email: String!): Message
    }
  `,
  resolvers: {
    Mutation: {
      checkout: checkout,
      addtoCart: addToCart,
      resetPassword: resetPassword,
      requestReset: requestReset,
    },
  },
});
