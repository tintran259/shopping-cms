import { triggerRevalidate } from '../src/utils/revalidate';

// Cron runs every minute; look back slightly more than the interval so a boundary is
// never missed between two runs.
const LOOKBACK_SEC = 70;

/**
 * Every minute, detect whether any scheduling boundary (`start_at` / `end_at`) was crossed
 * in the last interval — across every table that carries those columns (Banner entry +
 * scheduled components) — and, if so, ask the storefront to revalidate.
 *
 * This is what makes time-based start/end take effect on a cached storefront: editorial
 * changes are handled by the Banner lifecycle hooks, time boundaries are handled here.
 */
export default {
  revalidateOnScheduleBoundary: {
    task: async ({ strapi }: { strapi: any }) => {
      const knex = strapi.db.connection;

      // Tables that have BOTH start_at and end_at (i.e. opted into scheduling).
      const rows = await knex('information_schema.columns')
        .select('table_name')
        .whereIn('column_name', ['start_at', 'end_at'])
        .andWhereRaw('table_schema = current_schema()')
        .groupBy('table_name')
        .havingRaw('count(distinct column_name) = 2');

      const tables: string[] = rows.map((r: any) => r.table_name);

      // Strapi stores datetimes as UTC wall-clock in `timestamp without time zone`.
      // Compare against `now() at time zone 'UTC'` so the node process timezone never skews it.
      const boundary =
        `(start_at BETWEEN ((now() at time zone 'UTC') - (? * interval '1 second')) AND (now() at time zone 'UTC'))` +
        ` OR (end_at BETWEEN ((now() at time zone 'UTC') - (? * interval '1 second')) AND (now() at time zone 'UTC'))`;

      let crossed = false;
      for (const table of tables) {
        try {
          const hit = await knex(table).whereRaw(boundary, [LOOKBACK_SEC, LOOKBACK_SEC]).first();
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
        await triggerRevalidate(strapi, 'schedule boundary crossed');
      }
    },
    options: {
      // 5-field = every minute. For finer granularity use a 6-field rule, e.g. '*/30 * * * * *'.
      rule: '* * * * *',
    },
  },
};
