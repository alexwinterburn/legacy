import { TOKENS, displayDecimalsFor, formatAmount } from "@legacy/core";
import { adapterFor } from "@legacy/blockchain";
import { DEVICE_COMPATIBILITY } from "@legacy/bitcoin";
import { ActionButton, ActionForm, SelectField, TextField } from "@/components/form";
import {
  Badge,
  Dot,
  Eyebrow,
  Panel,
  Rule,
  SectionHeading,
  VerificationBadge,
  formatDate,
  formatUsd,
} from "@/components/ui";
import {
  addAssetAction,
  addWalletAction,
  proofOfLifeAction,
  proveOwnershipAction,
  removeAssetAction,
  removeWalletAction,
} from "@/lib/actions";
import { demoAssets, demoWallets, getBitcoinPolicy, getProofOfLife } from "@/lib/demo";

export default function AssetsPage() {
  const wallets = demoWallets();
  const assets = demoAssets();
  const policy = getBitcoinPolicy();
  const proofOfLife = getProofOfLife();

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Assets"
        title="What's covered, and how well we actually know it."
        lead="We distinguish three states, because they mean genuinely different things. Seeing a balance on-chain does not prove you control the address."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Declared", "You told us about it. We haven't checked.", "neutral"],
          ["Observed", "We can see the balance on-chain. Ownership unproven.", "caution"],
          ["Proven", "You signed a challenge with this address's key.", "verified"],
        ].map(([title, body, tone]) => (
          <Panel key={title} className="p-5">
            <span className="inline-flex items-center gap-2 text-sm text-bone-100">
              <Dot tone={tone as "neutral" | "caution" | "verified"} />
              {title}
            </span>
            <p className="mt-2 text-xs leading-relaxed text-bone-500">{body}</p>
          </Panel>
        ))}
      </div>

      {/* Wallets */}
      <Panel className="overflow-hidden">
        <div className="px-7 py-5">
          <Eyebrow>Registered wallets</Eyebrow>
        </div>
        <div className="border-t hairline">
          {wallets.length === 0 ? (
            <p className="px-7 py-8 text-sm text-bone-500">
              No wallets registered yet. Add one below — we only ever need a public address.
            </p>
          ) : null}

          {wallets.map((w) => {
            const adapter = adapterFor(w.chain);
            const validation = adapter.validateAddress(w.address);
            const walletAssets = assets.filter((a) => a.walletId === w.id);
            return (
              <div key={w.id} className="border-b hairline p-7 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base text-bone-50">{w.label}</h3>
                      <Badge tone="neutral" className="capitalize">{w.chain}</Badge>
                      <VerificationBadge state={w.verificationState} />
                    </div>
                    <p className="mt-3 break-all font-mono text-xs text-bone-500">{w.address}</p>
                    <p className="mt-2 text-xs text-bone-600">
                      {validation.valid ? (
                        <>Address format valid — {validation.kind}</>
                      ) : (
                        <span className="text-alert">Invalid: {validation.reason}</span>
                      )}
                      {" · "}Added {formatDate(w.addedAt)}
                      {" · "}Proof scheme: {adapter.capabilities.ownershipProofScheme}
                    </p>

                    {walletAssets.length > 0 ? (
                      <ul className="mt-4 space-y-2">
                        {walletAssets.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="tnum text-bone-200">
                              {formatAmount({ value: a.amount, decimals: a.decimals, symbol: a.symbol }, displayDecimalsFor(a.symbol))}
                            </span>
                            <span className="text-bone-500">{a.symbol}</span>
                            <span className="tnum text-xs text-bone-600">
                              ≈ {formatUsd((Number(a.amount) / 10 ** a.decimals) * a.indicativeUnitPriceUsd)}
                            </span>
                            <ActionButton
                              action={removeAssetAction}
                              label="Remove"
                              variant="ghost"
                              hidden={{ assetId: a.id }}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-xs text-bone-600">No holdings recorded on this wallet yet.</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {w.verificationState !== "PROVEN" ? (
                      <ActionButton
                        action={proveOwnershipAction}
                        label="Prove ownership"
                        hidden={{ walletId: w.id }}
                      />
                    ) : null}
                    <ActionButton
                      action={removeWalletAction}
                      label="Remove wallet"
                      variant="ghost"
                      confirm={`Remove ${w.label} and any holdings recorded against it?`}
                      hidden={{ walletId: w.id }}
                    />
                  </div>
                </div>

                {w.descriptor ? (
                  <div className="panel-inset mt-5 p-4">
                    <p className="eyebrow mb-2">Output descriptor</p>
                    <p className="break-all font-mono text-xs leading-relaxed text-bone-500">{w.descriptor}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Add wallet + asset */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-7">
          <Eyebrow className="mb-5">Register a wallet</Eyebrow>
          <ActionForm action={addWalletAction} submitLabel="Register wallet" resetOnSuccess>
            <div className="space-y-5">
              <SelectField
                name="chain"
                label="Chain"
                options={[
                  { value: "bitcoin", label: "Bitcoin" },
                  { value: "ethereum", label: "Ethereum" },
                  { value: "solana", label: "Solana" },
                ]}
              />
              <TextField
                name="address"
                label="Public address"
                placeholder="bc1q… / 0x… / base58"
                required
                hint="Validated against the chain's real address format. We never ask for a private key."
              />
              <TextField name="label" label="Label" placeholder="Cold storage" />
            </div>
          </ActionForm>
        </Panel>

        <Panel className="p-7">
          <Eyebrow className="mb-5">Record a holding</Eyebrow>
          {wallets.length === 0 ? (
            <p className="text-sm text-bone-500">Register a wallet first.</p>
          ) : (
            <ActionForm action={addAssetAction} submitLabel="Add holding" resetOnSuccess>
              <div className="space-y-5">
                <SelectField
                  name="walletId"
                  label="Wallet"
                  options={wallets.map((w) => ({ value: w.id, label: `${w.label} (${w.chain})` }))}
                />
                <SelectField
                  name="symbol"
                  label="Asset"
                  options={TOKENS.map((t) => ({ value: t.symbol, label: `${t.symbol} — ${t.name}` }))}
                  hint="USDT, USDC and DAI are supported alongside BTC, ETH and SOL."
                />
                <TextField name="amount" label="Amount" placeholder="1.84" required hint="Decimal amount, e.g. 1.84 or 183000" />
              </div>
            </ActionForm>
          )}
        </Panel>
      </div>

      {/* Bitcoin policy */}
      <Panel className="p-7">
        <Eyebrow className="mb-5">Your Bitcoin spending policy</Eyebrow>
        <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
          A Taproot output with your key on the key path — so day-to-day spending looks like any
          other Taproot transaction and reveals nothing about your succession plan — plus script
          paths for inheritance.
        </p>

        <div className="panel-inset mt-6 overflow-x-auto p-5">
          <p className="eyebrow mb-3">Miniscript policy</p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-bone-400">
            {policy.policy}
          </pre>
        </div>

        <div className="mt-6 space-y-3">
          {policy.spendingPaths.map((p) => (
            <div key={p.name} className="panel-inset p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-bone-100">{p.name}</span>
                <div className="flex gap-2">
                  {p.delayDays > 0 ? (
                    <Badge tone="caution">After {Math.round(p.delayDays)} days</Badge>
                  ) : (
                    <Badge tone="verified">No delay</Badge>
                  )}
                  {!p.requiresPlatform ? <Badge tone="verified">Works without us</Badge> : null}
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-bone-500">{p.description}</p>
            </div>
          ))}
        </div>

        {policy.warnings.length > 0 ? (
          <div className="mt-6 rounded-lg border-l-2 border-caution/40 bg-caution/[0.04] px-5 py-4">
            <p className="eyebrow mb-2">Worth knowing</p>
            <ul className="space-y-2">
              {policy.warnings.map((w) => (
                <li key={w} className="text-sm leading-relaxed text-bone-400">{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      {/* Proof of life */}
      <Panel className="p-7">
        <Eyebrow className="mb-4">Proof of life — re-anchoring</Eyebrow>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm leading-relaxed text-bone-400">{proofOfLife.message}</p>
            <p className="mt-3 text-xs leading-relaxed text-bone-600">
              Relative timelocks run per coin, each with its own clock. We show the earliest — the
              point at which any part of your balance becomes spendable by your heir — because an
              average would understate it. Currently that&apos;s{" "}
              <span className="font-mono text-bone-500">{proofOfLife.earliestUnlockTxid}</span>.
            </p>
          </div>
          <ActionButton action={proofOfLifeAction} label="Record proof of life" />
        </div>
      </Panel>

      {/* Device compatibility */}
      <Panel className="overflow-hidden">
        <div className="px-7 py-5">
          <Eyebrow>Hardware wallet compatibility</Eyebrow>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone-500">
            Miniscript support is genuinely uneven across devices. Assuming it works everywhere is
            a good way to strand someone mid-setup, so here&apos;s the honest matrix.
          </p>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Device", "Taproot multisig", "Miniscript", "Note"].map((h) => (
                  <th key={h} className="eyebrow px-7 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEVICE_COMPATIBILITY.map((d) => (
                <tr key={d.device} className="border-b hairline last:border-0">
                  <td className="px-7 py-3.5 text-bone-100">{d.device}</td>
                  <td className="px-7 py-3.5">{d.taprootMultisig ? <Dot tone="verified" /> : <Dot tone="alert" />}</td>
                  <td className="px-7 py-3.5">{d.miniscript ? <Dot tone="verified" /> : <Dot tone="caution" />}</td>
                  <td className="px-7 py-3.5 text-xs text-bone-500">{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-7">
        <Eyebrow className="mb-3">A note on balances</Eyebrow>
        <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
          This prototype runs with no RPC configured, so balances come from what you record here
          rather than a live chain query. The adapters return{" "}
          <code className="font-mono text-xs text-bone-500">null</code> rather than inventing a
          number — a balance we haven&apos;t actually observed shouldn&apos;t look like one we have.
        </p>
        <Rule className="my-5" />
        <p className="text-xs text-bone-600">
          No private keys, seed phrases or signing capability exist anywhere in this system.
        </p>
      </Panel>
    </div>
  );
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";
