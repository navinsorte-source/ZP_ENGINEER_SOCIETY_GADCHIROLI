# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Path ID Hardening**: Every single-document target (`get`, `create`, `update`, `delete`) must validate its path variable ID using `isValidId(id)` (`<= 128` chars, `^[a-zA-Z0-9_\-]+$`).
2. **Schema & Key Strictness**: All writes (`create` and `update`) must pass `isValid[Entity](incoming())`, which strictly enforces `keys().hasAll(...)`, `keys().hasOnly(...)`, exact field types, and `.size()` limits on every string field.
3. **Update Affected Keys**: All updates must explicitly allowlist modified fields via `incoming().diff(existing()).affectedKeys().hasOnly(...)` and preserve immutable fields (`ownerId`).
4. **Relational Integrity**:
   - `monthly_contributions` and `loans` must reference an existing `/members/{memberDocId}` document via `exists()`.
   - `loan_emis` must reference an existing `/loans/{loanDocId}` document via `exists()`.
5. **Query Enforcer**: Every `allow list` rule evaluates `resource.data.ownerId == 'zp-society-gadchiroli'` so unauthorized or unscoped queries are rejected.

## 2. The "Dirty Dozen" Payloads
1. **Ghost Field Injection**: Creating a `Member` with `{ ..., "isAdmin": true }` -> Rejected by `hasOnly()`.
2. **Oversized ID Poisoning**: Creating `/members/` with a 200-char ID -> Rejected by `isValidId()`.
3. **Oversized String DoW**: Setting `member.name` to a 5,000-character string -> Rejected by `data.name.size() <= 120`.
4. **Invalid Enum State**: Setting `member.status` to `"Pending"` -> Rejected by `data.status in ['Active', 'Inactive']`.
5. **Orphaned Monthly Contribution**: Creating a contribution where `memberDocId` does not exist in `/members` -> Rejected by `exists()`.
6. **Orphaned Loan**: Creating a loan where `memberDocId` does not exist in `/members` -> Rejected by `exists()`.
7. **Orphaned Loan EMI**: Creating an EMI where `loanDocId` does not exist in `/loans` -> Rejected by `exists()`.
8. **OwnerId Mutation**: Updating a member's `ownerId` to a different value -> Rejected by `incoming().ownerId == existing().ownerId`.
9. **Type Confusion on Share Capital**: Setting `member.share` to `"5000"` (string instead of number) -> Rejected by `data.share is number`.
10. **Negative Loan Principal**: Setting `loan.principal` to `-1000` -> Rejected by `data.principal >= 0`.
11. **Shadow Update on Loan Closure**: Updating `principal` during a loan closure action -> Rejected by `affectedKeys().hasOnly(...)` and terminal state check.
12. **Unscoped List Query**: Listing documents without matching `ownerId == 'zp-society-gadchiroli'` -> Rejected by `resource.data.ownerId == 'zp-society-gadchiroli'`.
