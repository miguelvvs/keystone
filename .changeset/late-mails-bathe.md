---
'@keystonejs/app-admin-ui': patch
---

Implemented a wrapper for apollo mutation as a workaround to show error in case of mutations errors, since an error in apollo client is preventing to show those messages with the original implementation. Wrapper is now used by CreateItemsModals, UpdateManyItemsModal and Item page.
