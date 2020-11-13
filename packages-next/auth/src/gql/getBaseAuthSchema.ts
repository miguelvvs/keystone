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
        code: PasswordAuthErrorCode!
        message: String!
      }
      enum PasswordAuthErrorCode {
        FAILURE
        IDENTITY_NOT_FOUND
        SECRET_NOT_SET
        MULTIPLE_IDENTITY_MATCHES
        SECRET_MISMATCH
      }
    `,
    resolvers: {
      Mutation: {
        async [gqlNames.authenticateItemWithPassword](root: any, args: any, ctx: any) {
          const list = ctx.keystone.lists[listKey];
          const { success, code, item } = await attemptAuthentication(
            list,
            listKey,
            identityField,
            secretField,
            protectIdentities,
            args,
            ctx
          );

          if (!success) {
            return {
              code,
              message: getPasswordAuthError({
                identityField,
                secretField,
                itemSingular: list.adminUILabels.singular,
                itemPlural: list.adminUILabels.plural,
                code,
              }),
            };
          }

          return { item, sessionToken: await ctx.startSession({ listKey, itemId: item.id }) };
        },
      },
      Query: {
        async authenticatedItem(root: any, args: any, { lists, session }: any) {
          if (typeof session?.itemId === 'string' && typeof session.listKey === 'string') {
            return (
              (await lists[session.listKey].findOne({ where: { id: session.itemId } })) || null
            );
          }
          return null;
        },
      },
      // FIXME: Do we need to create this type at all?
      AuthenticatedItem: {
        __resolveType(rootVal: any, { session }: any) {
          return session?.listKey;
        },
      },
      // TODO: Is this the preferred approach for this?
      [gqlNames.ItemAuthenticationWithPasswordResult]: {
        __resolveType(root: any) {
          return root.sessionToken
            ? gqlNames.ItemAuthenticationWithPasswordSuccess
            : gqlNames.ItemAuthenticationWithPasswordFailure;
        },
      },
    },
  };
}
