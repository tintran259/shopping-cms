import { triggerRevalidate } from '../src/utils/revalidate';
import { activeEntryFilters } from '../src/utils/schedule';

// Cron runs every minute; look back slightly more than the interval so a boundary
// is never missed between two runs.
const LOOKBACK_SEC = 70;

// The pg driver reads/writes `timestamp without time zone` columns using the Node
// process timezone, so stored start_at/end_at are wall-clock in PROCESS_TZ (here
// Asia/Ho_Chi_Minh). Boundary checks must compare against now() in that same zone.
const PROCESS_TZ = process.env.TZ || 'UTC';

export default {
  /**
   * TIME boundaries (startAt/endAt) — every minute, detect whether any scheduling
   * boundary was crossed in the last interval across every table that carries
   * start_at/end_at (Banner entry + scheduled blocks). If so, revalidate the
   * storefront's catch-all `cms` tag so the next request reflects the change.
   *
   * Editorial changes are handled separately by the content-type lifecycle hooks.
   */
  revalidateOnScheduleBoundary: {
    task: async ({ strapi }: { strapi: any }) => {
      const knex = strapi.db.connection;

      // Tables that have BOTH start_at and end_at (opted into scheduling).
      const rows = await knex('information_schema.columns')
        .select('table_name')
        .whereIn('column_name', ['start_at', 'end_at'])
        .andWhereRaw('table_schema = current_schema()')
        .groupBy('table_name')
        .havingRaw('count(distinct column_name) = 2');
      const tables: string[] = rows.map((r: any) => r.table_name);

      // Compare against now() in PROCESS_TZ (columns hold wall-clock in that zone).
      // Bindings order: [tz, lookback, tz, tz, lookback, tz].
      const boundary =
        `(start_at BETWEEN ((now() at time zone ?) - (? * interval '1 second')) AND (now() at time zone ?))` +
        ` OR (end_at BETWEEN ((now() at time zone ?) - (? * interval '1 second')) AND (now() at time zone ?))`;
      const bindings = [PROCESS_TZ, LOOKBACK_SEC, PROCESS_TZ, PROCESS_TZ, LOOKBACK_SEC, PROCESS_TZ];

      let crossed = false;
      for (const table of tables) {
        try {
          const hit = await knex(table).whereRaw(boundary, bindings).first();
          if (hit) {
            crossed = true;
            break;
          }
        } catch (err) {
          strapi.log.warn(`[cron] schedule check failed for ${table}: ${(err as Error).message}`);
        }
      }

      if (crossed) {
        strapi.log.info('[cron] schedule boundary crossed → revalidating storefront');
        await triggerRevalidate(strapi, 'schedule boundary crossed', ['cms']);
      }
    },
    options: {
      // 5-field = every minute. For finer granularity use a 6-field rule, e.g. '*/30 * * * * *'.
      rule: '* * * * *',
    },
  },

  /**
   * Every minute, reconcile Draft/Publish state to the scheduling window — generically,
   * for EVERY content type that opts in (draftAndPublish + a startAt or endAt datetime).
   * Not hardcoded to banner.
   *
   * Rule (matches the agreed truth table): an entry is **active** when
   * `(startAt null OR startAt <= now) AND (endAt null OR endAt >= now)`.
   *   - Published but NOT active (start in the future OR end passed) → unpublish.
   *   - Draft, HAS a schedule, and IS active → publish (so it comes back when startAt arrives).
   *
   * A draft with no schedule (both null) is never auto-published — manual content is left
   * alone. Comparisons go through the Document Service on ISO strings → timezone-safe.
   * Unpublish keeps the data (re-publishable). The Document Service middleware
   * (src/index.ts) revalidates the storefront on each publish/unpublish.
   */
  reconcileScheduledPublish: {
    task: async ({ strapi }: { strapi: any }) => {
      const nowISO = new Date().toISOString();
      // Out-of-window = start still in the future OR end already passed.
      const outOfWindow = { $or: [{ startAt: { $gt: nowISO } }, { endAt: { $lt: nowISO } }] };

      const scheduledTypes = Object.keys(strapi.contentTypes).filter((uid) => {
        if (!uid.startsWith('api::')) return false;
        const ct = strapi.contentTypes[uid];
        if (!ct?.options?.draftAndPublish) return false;
        return ct?.attributes?.startAt?.type === 'datetime' || ct?.attributes?.endAt?.type === 'datetime';
      });

      for (const uid of scheduledTypes) {
        try {
          const docs = strapi.documents(uid);

          // 1) Published but out of window → unpublish.
          const expired = await docs.findMany({
            status: 'published',
            filters: outOfWindow,
            fields: ['documentId'],
            limit: 1000,
          });
          for (const doc of expired) {
            await docs.unpublish({ documentId: doc.documentId });
            strapi.log.info(`[cron] unpublish ${uid} ${doc.documentId} (out of window)`);
          }

          // 2) Draft, scheduled, and in window → publish. Skip docs that already have a
          //    published version (their draft twin also matches the query).
          const publishedIds = new Set<string>(
            (await docs.findMany({ status: 'published', fields: ['documentId'], limit: 1000 })).map(
              (d: any) => d.documentId
            )
          );
          const dueToPublish = await docs.findMany({
            status: 'draft',
            filters: {
              $and: [
                activeEntryFilters(nowISO),
                { $or: [{ startAt: { $notNull: true } }, { endAt: { $notNull: true } }] },
              ],
            },
            fields: ['documentId'],
            limit: 1000,
          });
          for (const doc of dueToPublish) {
            if (publishedIds.has(doc.documentId)) continue;
            await docs.publish({ documentId: doc.documentId });
            strapi.log.info(`[cron] publish ${uid} ${doc.documentId} (entered window)`);
          }
        } catch (err) {
          strapi.log.warn(`[cron] reconcile failed for ${uid}: ${(err as Error).message}`);
        }
      }
    },
    options: {
      rule: '* * * * *',
    },
  },
};
