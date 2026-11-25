import { NextResponse } from "next/server";

import { getGithubRepoSnapshot } from "@/lib/github/repo-snapshot";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET(): Promise<NextResponse> {
  const snapshot = await getGithubRepoSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
