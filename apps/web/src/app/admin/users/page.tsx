import Link from "next/link";
import { tier } from "@legacy/core";
import { formatMoney, isDelinquent, money, mrrMinor } from "@legacy/billing";
import { Badge, Dot, Eyebrow, Panel, SectionHeading, formatDate, inputClass } from "@/components/ui";
import { getWorld } from "@/lib/store";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string; tier?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const world = getWorld();
  const q = (params.q ?? "").toLowerCase().trim();

  const rows = world.users
    .map((u) => {
      const sub = world.subscriptions.find((s) => s.userId === u.id);
      return { user: u, sub };
    })
    .filter(({ user, sub }) => {
      if (q && !`${user.fullName} ${user.email} ${user.countryName} ${user.id}`.toLowerCase().includes(q)) {
        return false;
      }
      if (params.status && params.status !== "all") {
        if (params.status === "delinquent") return sub ? isDelinquent(sub) : false;
        if (params.status !== user.status) return false;
      }
      if (params.tier && params.tier !== "all" && sub?.tierId !== params.tier) return false;
      return true;
    })
    .sort((a, b) => Number(mrrMinor(b.sub!) ?? 0n) - Number(mrrMinor(a.sub!) ?? 0n));

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Users"
        title="Customer base"
        lead="Search, filter and open any account. Ordering is by recurring revenue, never by portfolio value — a ranked list of wealthy customers is a targeting list, so we don't build one."
      />

      {/* Filters — plain GET form so the state lives in the URL and is shareable */}
      <Panel className="p-6">
        <form className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="eyebrow mb-2 block">Search</span>
            <input name="q" defaultValue={params.q ?? ""} placeholder="Name, email, country or id" className={inputClass} />
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block">Account status</span>
            <select name="status" defaultValue={params.status ?? "all"} className={inputClass}>
              <option value="all" className="bg-ink-900">All</option>
              <option value="ACTIVE" className="bg-ink-900">Active</option>
              <option value="INVESTIGATING" className="bg-ink-900">Investigating</option>
              <option value="SUSPENDED" className="bg-ink-900">Suspended</option>
              <option value="delinquent" className="bg-ink-900">Delinquent billing</option>
            </select>
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block">Tier</span>
            <select name="tier" defaultValue={params.tier ?? "all"} className={inputClass}>
              <option value="all" className="bg-ink-900">All</option>
              {["free", "guardian", "legacy", "private_wealth"].map((t) => (
                <option key={t} value={t} className="bg-ink-900">{tier(t as never).name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-brass-400 px-5 py-2.5 text-sm font-medium text-ink-950 transition-colors hover:bg-brass-300">
            Apply
          </button>
        </form>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <Eyebrow>{rows.length} of {world.users.length} users</Eyebrow>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Customer", "Country", "Tier", "Subscription", "MRR", "Account", "Joined"].map((h) => (
                  <th key={h} className="eyebrow px-6 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user, sub }) => (
                <tr key={user.id} className="border-b hairline transition-colors last:border-0 hover:bg-ink-800/40">
                  <td className="px-6 py-4">
                    <Link href={`/admin/users/${user.id}`} className="text-bone-50 hover:text-brass-300">
                      {user.fullName}
                    </Link>
                    <p className="text-xs text-bone-600">{user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-bone-400">{user.countryName}</td>
                  <td className="px-6 py-4">
                    <Badge tone={sub?.tierId === "private_wealth" ? "brass" : "neutral"}>
                      {sub ? tier(sub.tierId).name : "—"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {sub ? <SubscriptionBadge status={sub.status} /> : <span className="text-bone-600">None</span>}
                  </td>
                  <td className="tnum px-6 py-4 text-bone-300">
                    {sub ? formatMoney(money(mrrMinor(sub), sub.currency)) : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone={user.status === "ACTIVE" ? "verified" : user.status === "SUSPENDED" ? "alert" : "caution"}>
                      {user.status.toLowerCase()}
                    </Badge>
                  </td>
                  <td className="tnum px-6 py-4 text-xs text-bone-500">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-bone-500">
                    No users match those filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function SubscriptionBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE" ? "verified"
    : status === "TRIALING" ? "brass"
    : status === "PAST_DUE" || status === "GRACE" ? "alert"
    : "neutral";
  return (
    <Badge tone={tone as "verified" | "brass" | "alert" | "neutral"}>
      <Dot tone={tone as "verified" | "brass" | "alert" | "neutral"} />
      {status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}
