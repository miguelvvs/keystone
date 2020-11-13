import { AuthGqlNames, AuthTokenTypeConfig } from '../types';
import { updateAuthToken } from '../lib/updateAuthToken';
import { redeemAuthToken } from '../lib/redeemAuthToken';
import { validateAuthToken } from '../lib/validateAuthToken';
import { getAuthTokenErrorMessage } from '../lib/getErrorMessage';

export function getPasswordResetSchema({
  listKey,
  identityField,
  secretField,
  protectIdentities,
  gqlNames,
  passwordResetLink,
}: {
  listKey: string;
  identityField: string;
  secretField: string;
  protectIdentities: boolean;
  gqlNames: AuthGqlNames;
  passwordResetLink: AuthTokenTypeConfig;
}) {
  return {
    typeDefs: `
      # Reset password
      type Mutation {
        ${gqlNames.sendItemPasswordResetLink}(${identityField}: String!): ${gqlNames.SendItemPasswordResetLinkResult}
      }
      type ${gqlNames.SendItemPasswordResetLinkResult} {
        code: PasswordResetRequestErrorCode!
        message: String!
      }
      enum PasswordResetRequestErrorCode {
        IDENTITY_NOT_FOUND
        MULTIPLE_IDENTITY_MATCHES
      }
      type Query {
        ${gqlNames.validateItemPasswordResetToken}(${identityField}: String!, token: String!): ${gqlNames.ValidateItemPasswordResetTokenResult}
      }
      type ${gqlNames.ValidateItemPasswordResetTokenResult} {
        code: PasswordResetRedemptionErrorCode!
        message: String!
      }
      type Mutation {
        ${gqlNames.redeemItemPasswordResetToken}(${identityField}: String!, token: String!, ${secretField}: String!): ${gqlNames.RedeemItemPasswordResetTokenResult}
      }
      type ${gqlNames.RedeemItemPasswordResetTokenResult} {
        code: PasswordResetRedemptionErrorCode!
        message: String!
      }
      enum PasswordResetRedemptionErrorCode {
        FAILURE
        IDENTITY_NOT_FOUND
        MULTIPLE_IDENTITY_MATCHES
        TOKEN_NOT_SET
        TOKEN_MISMATCH
        TOKEN_EXPIRED
        TOKEN_REDEEMED
      }
    `,
    resolvers: {
      Mutation: {
        async [gqlNames.sendItemPasswordResetLink](root: any, args: any, ctx: any) {
          const list = ctx.keystone.lists[listKey];
          const identity = args[identityField];
          const { success, code, token, itemId } = await updateAuthToken(
            'passwordReset',
            listKey,
            identityField,
            protectIdentities,
            identity,
            ctx
          );

          // Note: `success` can be false with no code
          if (!success && code) {
            return {
              code,
              message: getAuthTokenErrorMessage({
                identityField,
                itemSingular: list.adminUILabels.singular,
                itemPlural: list.adminUILabels.plural,
                code,
              }),
            };
          }
          if (success) {
            await passwordResetLink.sendToken({ itemId, identity, token });
          }
          return {};
        },
        async [gqlNames.redeemItemPasswordResetToken](root: any, args: any, ctx: any) {
          const list = ctx.keystone.lists[listKey];
          const { code, success, item } = await redeemAuthToken(
            'passwordReset',
            list,
            listKey,
            identityField,
            protectIdentities,
            passwordResetLink.tokensValidForMins,
            args,
            ctx
          );

          if (!success) {
            return {
              code,
              message: getAuthTokenErrorMessage({
                identityField,
                itemSingular: list.adminUILabels.singular,
                itemPlural: list.adminUILabels.plural,
                code,
              }),
            };
          }

          // TODO: The underlying Password field will still hard error on validation failures; these should be surfaced better
          await updateItem({
            context: ctx,
            listKey,
            item: { id: item.id, data: { [secretField]: args[secretField] } },
          });
          return null;
        },
      },
      Query: {
        async [gqlNames.validateItemPasswordResetToken](root: any, args: any, ctx: any) {
          const list = ctx.keystone.lists[listKey];
          const { code, success } = await validateAuthToken(
            'passwordReset',
            list,
            listKey,
            identityField,
            protectIdentities,
            passwordResetLink.tokensValidForMins,
            args,
            ctx,
          );

          if (!success && code) {
            return {
              code,
              message: getAuthTokenErrorMessage({
                identityField,
                itemSingular: list.adminUILabels.singular,
                itemPlural: list.adminUILabels.plural,
                code,
              }),
            };
          }
          return null;
        },
      },
    },
  };
}
