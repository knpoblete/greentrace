# XRPL Transaction Reference

Every transaction GreenTrace submits, what it implements, and where it lives. All are real on
XRPL Testnet (`xrpl.js v4`); a deterministic simulated record is substituted only if a submission
can't land. Transaction names below are the **actual** protocol names (the source spec had a few
that don't exist — corrected here).

## MPTokens — XLS-33 (`xrpl/mpt.js`)

| Tx | Purpose |
|---|---|
| `MPTokenIssuanceCreate` | Issue a bond as an MPT. `Flags = tfMPTRequireAuth (4) \| tfMPTCanTransfer (2)`, `AssetScale`, `MaximumAmount`, and XLS-89-shaped `MPTokenMetadata` (hex JSON) carrying the green metadata under `additional_info`. |
| `MPTokenAuthorize` | Holder opt-in (no `Holder` field) and issuer authorization of a holder (with `Holder`). Required because the issuance is auth-gated. |
| `Payment` (MPT amount) | Transfer bond units: `Amount = { mpt_issuance_id, value }`. Fails `tecNO_AUTH` for an unauthorized holder — the basis of the Wallet B rejection. |

The `MPTokenIssuanceID` is read from `meta.mpt_issuance_id` (fallback: created node / synthetic).

## TokenEscrow — XLS-85 (`xrpl/escrow.js`)

| Tx | Purpose |
|---|---|
| `EscrowCreate` | Lock RLUSD proceeds. `Amount` is an IOU object `{currency, issuer, value}`; `FinishAfter` is a near-future ripple-time so a milestone release can finish it. Owner = investor, Destination = issuer. |
| `EscrowFinish` | Release proceeds for a completed milestone. `Owner` + `OfferSequence` (the create tx's sequence). Milestone is validated against agent state before submitting. |

Prerequisite: the IOU issuer sets **`asfAllowTrustLineLocking` (SetFlag 17)** so its tokens may be escrowed (`xrpl/iou.js`).

## Credentials — XLS-70 (`xrpl/credentials.js`)

| Tx | Purpose |
|---|---|
| `CredentialCreate` | Verifier ("KPMG") attests a subject. `CredentialType` is hex; `URI` is a compact hex JSON (≤128 bytes) — full fields (`Bond_Status`, `Standard`, `Verified_By: KPMG`, `EU_Taxonomy: Pass`, `ICMA: Pass`) are kept in SQLite. |
| `CredentialAccept` | Subject accepts the credential (issuer + type). |
| `CredentialDelete` | Revoke. The agent submits this automatically when a bond breaches. |

A credential is uniquely keyed on-chain by `(Issuer, Subject, CredentialType)`, so per-bond green
credentials use a per-bond on-chain type (`GreenBondVerified.{bondId}`) to avoid `tecDUPLICATE`; the
DB stores the base type for app queries.

## Permissioned Domains — XLS-80 (`xrpl/domain.js`)

| Tx | Purpose |
|---|---|
| `PermissionedDomainSet` | Create/update the compliance domain. `AcceptedCredentials` lists the credentials that admit an account: `GreenBondVerified` and `InvestorKYC` (both verifier-issued). |

Domain membership = holding an accepted credential. Wallet A holds `InvestorKYC` (member); Wallet B
holds none, so it is not authorized and its bond transfer is rejected on-chain (`tecNO_AUTH`).

## RLUSD (`xrpl/rlusd.js`, `xrpl/iou.js`)

| Tx | Purpose |
|---|---|
| `TrustSet` | Establish trustlines to the **Testnet RLUSD issuer** `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV` (and to the self-issued IOU). |
| `Payment` | Pay bond proceeds in RLUSD (investor → issuer). Falls back to the self-issued RLUSD IOU if the wallet holds no canonical RLUSD (top up at tryrlusd.com). |
| `AccountSet` | Issuer enables `DefaultRipple (8)` and `AllowTrustLineLocking (17)` for the self-issued IOU. |

## Submission semantics (`xrpl/safeSubmit.js`)
- Success (`tesSUCCESS`) → real `{hash, simulated:false}`.
- Transient (`ter*`, `tefPAST_SEQ`, fee/load) → one retry.
- Amendment disabled / hard `tec`/`tem` → deterministic simulated hash (`simulated:true`)…
- …unless `allowFail` is set, then the real failure code is returned (e.g. `tecNO_AUTH`).
