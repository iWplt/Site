import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

/**
 * OpenNext Cloudflare cache — R2 incremental cache + DO queue + D1 tag cache.
 * Used only for Next.js ISR / data cache / revalidatePath.
 * Application uploads (admin + student) remain on Supabase Storage.
 * @see https://opennext.js.org/cloudflare/caching
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived"
  }),
  queue: doQueue,
  tagCache: d1NextTagCache
});
