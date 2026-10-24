# FreezeScope / engine

FreezeScope is an open-source CAP-77 quarantine review desk. It compares an observed frozen-ledger-key snapshot with a local proposal and explains the exact accesses behind each modeled result. It cannot freeze ledger entries, submit validator upgrades, sign transactions or authorize recovery actions.

The product is a proposal-review workflow, not a contention graph, price oracle, parity runner or storage-lifetime dashboard. Its core output is a before/after decision with key evidence and an explicit boundary between validation checks and unresolved apply-time behavior.

## This repository

Pure comparison functions, strict canonical LedgerKey decoding, CAP-77 key eligibility, local delta application and exact outer content-hash checks.

## Run the connected project

Use Node.js 24 or later. Clone all five repositories as siblings:

```sh
for part in engine backend frontend contracts scenarios; do
  git clone "https://github.com/freezescope-labs/freezescope-$part.git"
done
(cd freezescope-engine && npm ci)
(cd freezescope-backend && npm ci)
node freezescope-backend/server.mjs
# In another terminal:
node freezescope-frontend/server.mjs
```

Open http://127.0.0.1:4500. Choose **Open teaching case** for deterministic examples, **Read testnet settings** for the observed testnet configuration, or **Load live specimen calls** for independent unsigned simulations. Toggle a candidate key in the local proposal and inspect each before/after card. An exact transaction content hash can be added to the local bypass proposal. Exported bundles can be imported again.

Only the engine and backend require npm dependencies. The frontend and scenarios use Node built-ins. For tests, run `node --test freezescope-*/test.mjs` from the common parent; use `cargo test --locked --manifest-path freezescope-contracts/Cargo.toml` for the four contract host tests.

## Interpreting results

| Result | Meaning |
| --- | --- |
| VALIDATION_BLOCKED | At least one modeled access hits a frozen key and its exact outer content hash is not bypass-listed. |
| BYPASS_LISTED | A modeled frozen-key hit has its exact content hash listed. This is not a signature, full validity check or apply-time exemption. |
| INCOMPLETE | An opaque or unsupported operation needs further analysis; source-account checks alone do not establish safety. |
| NO_MODELED_HIT | No hit was found in the supported access model. This is never transaction approval. |

Supported accesses: transaction, operation and fee-bump source accounts; native/credit payment balances; create-account and merge destinations; read-only and read-write Soroban footprints. Claimable-balance claims and liquidity-pool operations are flagged as unresolved apply-time cases. Other operation types have source-account checks only and remain incomplete. DEX matching and sponsorship counter effects are not simulated. Signatures, sequence, fees, balances, contract execution validity and all other transaction rules are outside this model.

Snapshots are point-in-time observations, not an assurance of the latest validator state. Imported snapshots and XDR are untrusted inputs; XDR consistency is not independent authentication of a historical RPC response. Only testnet is supported. Proposals are local counterfactuals; no configuration upgrade is built or submitted. For review clarity, adding and removing the same key/hash in one proposal is rejected as ambiguous, although protocol delta processing handles additions and removals sequentially. Duplicate additions and removal of absent keys are otherwise ignored.

## Evidence

The initial pilot has three confirmed sequential testnet transactions (upload, deploy, initialize), two independent unsigned simulations, and a live CAP-77 settings snapshot. Both simulated calls have the expected local frozen-key hit when the persistent specimen value is proposed for quarantine. This is **not a real testnet freeze**. Contract: `CA4BH362U546SAZ243OPMFDYSMG65WL5NYHO5UYZXTQKJDEB76GZLIKX`.

Public evidence and reproduction instructions: [backend](https://github.com/freezescope-labs/freezescope-backend), `testnet-evidence.json` and `TESTNET.md`.

## Protocol sources

- [CAP-0077, final, protocol 26](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0077.md)
- [Protocol 26 upgrade guide](https://stellar.org/blog/foundation-news/stellar-yardstick-protocol-26-upgrade-guide)

MIT licensed. See CONTRIBUTING.md and SECURITY.md.
