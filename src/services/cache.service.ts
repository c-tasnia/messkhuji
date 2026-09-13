import { cacheGet, cacheSet, cacheDelByPrefix, CACHE_TTL_SECONDS } from '../config/redis';

export function listingDetailKey(id: string) {
  return `listing:detail:${id}`;
}

export function listingSearchKey(queryString: string) {
  return `listing:search:${queryString}`;
}

export async function getCachedListingDetail<T>(id: string): Promise<T | null> {
  return cacheGet<T>(listingDetailKey(id));
}

export async function setCachedListingDetail(id: string, data: unknown) {
  await cacheSet(listingDetailKey(id), data, CACHE_TTL_SECONDS.listingDetail);
}

export async function getCachedListingSearch<T>(queryString: string): Promise<T | null> {
  return cacheGet<T>(listingSearchKey(queryString));
}

export async function setCachedListingSearch(queryString: string, data: unknown) {
  await cacheSet(listingSearchKey(queryString), data, CACHE_TTL_SECONDS.listingSearch);
}

/** Invalidate all listing caches — call on any create/update/delete of a listing. */
export async function invalidateListingCaches() {
  await cacheDelByPrefix('listing:');
}
