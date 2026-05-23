"use client";

import { orpc, queryClient } from "@/utils/orpc";

export async function syncLocaleFromDB(): Promise<void> {
  try {
    const self = await queryClient.fetchQuery(orpc.users.getSelf.queryOptions());
    const locale = self?.locale ?? "en";
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  } catch {
    // non-critical — locale defaults to 'en'
  }
}
