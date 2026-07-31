import { NextResponse } from "next/server";

/**
 * RFC 7807 problem details.
 *
 * `remediation` is required rather than optional: a beneficiary hitting an error on the worst day
 * of their life should not be reading an error code. See API.md §13.
 */
export function problem(
  status: number,
  type: string,
  title: string,
  remediation: string,
): NextResponse {
  return NextResponse.json(
    {
      type: `https://legacy.example/problems/${type}`,
      title,
      status,
      remediation,
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}
