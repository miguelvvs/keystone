import { useMutation as useMutationApollo } from '@apollo/client';
// As a workaround for  https://github.com/apollographql/apollo-client/issues/5708
export const useMutation = function () {
  const mutationArray = useMutationApollo(...arguments);
  const onErrorFn = arguments[1] && arguments[1].onError;
  const responseFn = async data => {
    const originalResponse = await mutationArray[0](data);
    if (originalResponse && originalResponse.errors && originalResponse.errors.length > 0) {
      if (onErrorFn) {
        onErrorFn({ graphQLErrors: originalResponse.errors });
      }
      throw { graphQLErrors: originalResponse.errors };
    }
    return originalResponse;
  };
  return [responseFn, ...mutationArray.slice(1, mutationArray.length)];
};
