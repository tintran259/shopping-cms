/**
 * Time-window scheduling helpers.
 *
 * A node (entry or component) is "active" when:  startAt <= now <= endAt
 * with either bound optional (null = unbounded on that side).
 */

/** Strapi filter that keeps only entries whose start/end window contains `nowISO`. */
export const activeEntryFilters = (nowISO: string) => ({
  $and: [
    { $or: [{ startAt: { $null: true } }, { startAt: { $lte: nowISO } }] },
    { $or: [{ endAt: { $null: true } }, { endAt: { $gte: nowISO } }] },
  ],
});

/**
 * Is a node active "now"?  active ⇔ (startAt null OR startAt <= now) AND (endAt null OR endAt >= now).
 * Operates on ISO strings → timezone-safe (epoch comparison, independent of the process TZ).
 */
export const isActiveNow = (
  startAt?: string | null,
  endAt?: string | null,
  nowMs: number = Date.now()
): boolean => {
  const start = startAt ? Date.parse(startAt) : NaN;
  const end = endAt ? Date.parse(endAt) : NaN;
  if (!Number.isNaN(start) && nowMs < start) return false;
  if (!Number.isNaN(end) && nowMs > end) return false;
  return true;
};

type AnyObj = Record<string, unknown>;

const isObject = (v: unknown): v is AnyObj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** True if the object carries a scheduling window (has startAt/endAt keys). */
const hasSchedule = (v: unknown): v is AnyObj => isObject(v) && ('startAt' in v || 'endAt' in v);

/** Evaluate the window for a node that has startAt/endAt. */
const inWindow = (node: AnyObj, nowMs: number): boolean =>
  isActiveNow(
    typeof node.startAt === 'string' ? node.startAt : null,
    typeof node.endAt === 'string' ? node.endAt : null,
    nowMs
  );

/**
 * Recursively remove out-of-window components from an API response:
 *  - inactive items inside arrays (e.g. dynamic-zone blocks, repeatable components) are dropped
 *  - an inactive single-component object value is replaced with `null`
 * The root node's own window is NOT evaluated (entries are filtered at query time instead).
 */
export const stripInactive = <T>(value: T, nowMs: number = Date.now()): T => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(hasSchedule(item) && !inWindow(item, nowMs)))
      .map((item) => stripInactive(item, nowMs)) as unknown as T;
  }
  if (isObject(value)) {
    const out: AnyObj = {};
    for (const [key, child] of Object.entries(value)) {
      if (hasSchedule(child) && !inWindow(child, nowMs)) {
        out[key] = null;
      } else {
        out[key] = stripInactive(child, nowMs);
      }
    }
    return out as unknown as T;
  }
  return value;
};

/** True if the node's endAt has already passed (startAt is ignored). */
const isExpired = (node: AnyObj, nowMs: number): boolean => {
  const end = typeof node.endAt === 'string' ? Date.parse(node.endAt) : NaN;
  return !Number.isNaN(end) && nowMs > end;
};

/**
 * Like `stripInactive`, but only removes nodes whose `endAt` has already passed.
 * Upcoming nodes (startAt in the future) are KEPT — with their startAt/endAt —
 * so the storefront can reveal/hide them live on the client at the exact moment,
 * without a reload. Expired content is still dropped here for SEO/cleanliness.
 */
export const stripExpired = <T>(value: T, nowMs: number = Date.now()): T => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(hasSchedule(item) && isExpired(item, nowMs)))
      .map((item) => stripExpired(item, nowMs)) as unknown as T;
  }
  if (isObject(value)) {
    const out: AnyObj = {};
    for (const [key, child] of Object.entries(value)) {
      if (hasSchedule(child) && isExpired(child, nowMs)) {
        out[key] = null;
      } else {
        out[key] = stripExpired(child, nowMs);
      }
    }
    return out as unknown as T;
  }
  return value;
};
