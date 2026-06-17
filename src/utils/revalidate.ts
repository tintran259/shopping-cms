/**
 * Fire an on-demand revalidation request at the storefront's `/api/revalidate`
 * webhook (which calls Next.js `revalidateTag`).
 *
 * Configure via env:
 *   STOREFRONT_REVALIDATE_URL  POST endpoint on the storefront
 *   REVALIDATE_SECRET          shared secret (sent as `x-revalidate-secret`)
 *
 * No-ops (with a warning) when the URL is not configured, so it is safe to leave
 * unconfigured in dev.
 *
 * `tags` map to the storefront's data-cache tags:
 *   - `cms`            → everything (catch-all)
 *   - `slot:<position>`→ a single content slot (e.g. `slot:home-top`)
 *   - `landing:<slug>` → a landing page
 *   - `banner:<docId>` → a banner
 */
/**
 * Map a content type + the affected document to the storefront cache tags to
 * revalidate. Banners are embedded across many slots/pages, so they (and the
 * single-type / unknown cases) use the catch-all `cms` tag.
 */
export function tagsForDocument(uid: string, result: any): string[] {
  const doc = Array.isArray(result) ? result[0] : (result?.entries?.[0] ?? result);
  switch (uid) {
    case 'api::content-slot.content-slot':
      return doc?.position ? ['cms', `slot:${doc.position}`] : ['cms'];
    case 'api::landing-page.landing-page':
      return doc?.slug ? ['cms', `landing:${doc.slug}`] : ['cms'];
    case 'api::banner.banner':
      return doc?.documentId ? ['cms', `banner:${doc.documentId}`] : ['cms'];
    case 'api::theme.theme':
      return ['cms', 'theme'];
    case 'api::footer.footer':
      return ['cms', 'footer'];
    default:
      return ['cms'];
  }
}

export const triggerRevalidate = async (
  strapi: any,
  reason: string,
  tags: string[] = ['cms'],
): Promise<void> => {
  const url = process.env.STOREFRONT_REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET || '';

  if (!url) {
    strapi?.log?.warn(`[revalidate] skipped (${reason}) — STOREFRONT_REVALIDATE_URL not set`);
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ tags, reason }),
    });
    strapi?.log?.info(`[revalidate] ${reason} -> ${res.status} (tags: ${tags.join(', ')})`);
  } catch (err) {
    strapi?.log?.error(`[revalidate] failed (${reason}): ${(err as Error).message}`);
  }
};
