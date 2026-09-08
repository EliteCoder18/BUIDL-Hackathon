# Public frontend recovery checkpoint

Restored the previous session's recorded patches into a persistent sibling worktree after `/private/tmp/trustfutures-public-wallet` disappeared. The original main checkout was not changed.

Verified on September 8:
- 41 frontend tests pass, including cryptographic portable quote validation.
- Next.js production build succeeds.
- Production preview runs on localhost:3010.
- Existing Firefox profile reconnects its injected wallet and renders CC3 capital balances.
- Public CC3 RPC reports wallet mUSDC balance 9940750000 raw units. No replacement mint submitted during recovery.

Corrections:
- Imported quotes now validate signature against the deployed CC3 policy domain before approval, plus expiry, bounds, and 20% junior allocation.
- Removed invented public SHAP values and probability; public agent page reports only manifest evidence and discloses unavailable live analytics.

Still incomplete (not production-ready):
- Public hosting and integration into main.
- Full fresh-job policy/proof/settlement routes; existing dynamic routes still depend on local APIs.
- Account-change and duplicate-submission guards across multi-transaction sequences, transaction simulation, receipt persistence, and better quote review.
- Public status label must not imply live synchronization without health checks.
- Further wallet end-to-end and mobile QA.

Dependency symlinks are local setup only and must never be committed. Keep future work outside temporary directories and checkpoint in Git.
