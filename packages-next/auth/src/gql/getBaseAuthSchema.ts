import { AuthGqlNames } from '../types';

import { attemptAuthentication } from '../lib/attemptAuthentication';
import { getPasswordAuthError } from '../lib/getErrorMessage';

export function getBaseAuthSchema({
  listKey,
  identityField,
  secretField,
  protectIdentities,
  gqlNames,
}: {
  listKey: string;
  identityField: string;
  secretField: string;
  protectIdentities: boolean;
  gqlNames: AuthGqlNames;
}) {
  return {
    typeDefs: `
      # Auth
      union AuthenticatedItem = ${listKey}
      type Query {
        authenticatedItem: AuthenticatedItem
      }
      # Password auth
      type Mutation {
        ${gqlNames.authenticateItemWithPassword}(${identityField}: String!, ${secretField}: String!): ${gqlNames.ItemAuthenticationWithPasswordResult}!
      }
      union ${gqlNames.ItemAuthenticationWithPasswordResult} = ${gqlNames.ItemAuthenticationWithPasswordSuccess} | ${gqlNames.ItemAuthenticationWithPasswordFailure}
      type ${gqlNames.ItemAuthenticationWithPasswordSuccess} {
        sessionToken: String!
        item: ${listKey}!
      }
      type ${gqlNames.ItemAuthenticationWithPasswordFailure} {
        message: String!
      }
    `,
    resolvers: {
      Mutation: {
        async [gqlNames.authenticateItemWithPassword](root: any, args: any, ctx: any) {
          const list = ctx.keystone.lists[listKey];
          const result = await attemptAuthentication(
            list,
            listKey,
            identityField,
            secretField,
            protectIdentities,
            args,
            ctx
          );

          if (!result.success) {
            const message = getPasswordAuthError({
              identityField,
              secretField,
              itemSingular: list.adminUILabels.singular,
              itemPlural: list.adminUILabels.plural,
              code: result.code,
            });
            // We log the failure mode to the console, but do not
            // expose this info via the graphQL interface.
            // FIXME: Need to consider how to do server logging in general.
            console.log({ code: result.code, message, identity: args[identityField] });
            return { message: 'Authentication failed.' };
          }

          const sessionToken = await ctx.startSession({ listKey, itemId: result.item.id });
          return { sessionToken, item: result.item };
        },
      },
      Query: {
        async authenticatedItem(root: any, args: any, { session, lists }: any) {
          if (typeof session?.itemId === 'string' && typeof session.listKey === 'string') {
            const item = await lists[session.listKey].findOne({ where: { id: session.itemId } });
            return item || null;
          }
          return null;
        },
      },
      AuthenticatedItem: {
        __resolveType(rootVal: any, { session }: any) {
          return session?.listKey;
        },
      },
      // TODO: Is this the preferred approach for this?
      [gqlNames.ItemAuthenticationWithPasswordResult]: {
        __resolveType(rootVal: any) {
          return rootVal.sessionToken
            ? gqlNames.ItemAuthenticationWithPasswordSuccess
            : gqlNames.ItemAuthenticationWithPasswordFailure;
        },
      },
    },
  };
}
