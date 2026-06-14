import { triggerRevalidate } from '../src/utils/revalidate';

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
   * Every minute, auto-UNPUBLISH any entry whose `endAt` has passed — generically,
   * for EVERY content type that opts into entry-level scheduling (has an `endAt`
   * datetime + draftAndPublish). Not hardcoded to banner.
   *
   * Unpublish (not delete) is intentional: the entry leaves the storefront but its
   * data is kept and can be re-published. Component-level scheduling (blocks inside
   * dynamic zones) is handled by `stripExpired` in the controllers + client gating.
   */
  unpublishExpiredEntries: {
    task: async ({ strapi }: { strapi: any }) => {
      const nowISO = new Date().toISOString();

      const scheduledTypes = Object.keys(strapi.contentTypes).filter((uid) => {
        if (!uid.startsWith('api::')) return false;
        const ct = strapi.contentTypes[uid];
        return Boolean(ct?.options?.draftAndPublish) && ct?.attributes?.endAt?.type === 'datetime';
      });

      let unpublishedAny = false;
      for (const uid of scheduledTypes) {
        try {
          const expired = await strapi.documents(uid).findMany({
            status: 'published',
            filters: { endAt: { $lt: nowISO } },
            fields: ['documentId'],
            limit: 1000,
          });
          for (const doc of expired) {
            await strapi.documents(uid).unpublish({ documentId: doc.documentId });
            unpublishedAny = true;
            strapi.log.info(`[cron] unpublished expired ${uid} ${doc.documentId} (endAt < ${nowISO})`);
          }
        } catch (err) {
          strapi.log.warn(`[cron] unpublish-expired failed for ${uid}: ${(err as Error).message}`);
        }
      }

      if (unpublishedAny) {
        await triggerRevalidate(strapi, 'expired entries unpublished', ['cms']);
      }
    },
    options: {
      rule: '* * * * *',
    },
  },
};
