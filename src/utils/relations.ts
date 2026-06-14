/**
 * Generic "restore severed parent relations on re-publish".
 *
 * Strapi 5 draft&publish severs a published parent's relation when the related
 * entry is unpublished, and does NOT restore it when that entry is re-published.
 * So ANY parent that embeds a relation to entry X — directly, or nested inside a
 * component / dynamic zone (any depth) — shows X = null after X is
 * unpublished+republished, until the PARENT is re-published.
 *
 * This module makes that automatic for EVERY content type (not just banner):
 *   1. A reverse-reference index is built from the schema at bootstrap: for each
 *      publishable target type T, every publishable parent type P that can reach a
 *      relation to T, plus the exact `populate` path(s) to that relation.
 *   2. The Document Service middleware enqueues `{uid, documentId}` on every publish.
 *   3. A bootstrap worker drains the queue OUTSIDE the publish transaction (doing it
 *      inline throws "Transaction query already complete") and re-publishes each live
 *      parent whose DRAFT references the target but whose PUBLISHED version lost it.
 *
 * Re-publishing a parent is itself a publish → it re-enqueues the parent, so nested
 * embeds (A ⊃ B ⊃ C) cascade up automatically. The "only if the published version is
 * actually missing the reference" guard makes it idempotent and cycle-safe.
 */

type Populate = Record<string, any>;
type ParentRef = { parentUid: string; populate: Populate };

/* -------------------------------------------------------------------------- */
/* Detached queue                                                             */
/* -------------------------------------------------------------------------- */
const pending = new Set<string>(); // "uid|documentId"
let draining = false;
let reverseIndex: Map<string, ParentRef[]> = new Map();

/** Enqueue a just-published entry so its parents can be restored. */
export function queueRepublishParents(targetUid: string, targetDocumentId: string): void {
  pending.add(`${targetUid}|${targetDocumentId}`);
}

/* -------------------------------------------------------------------------- */
/* Schema introspection → reverse-reference index                             */
/* -------------------------------------------------------------------------- */
const isPublishableApiType = (strapi: any, uid: string): boolean =>
  uid.startsWith('api::') && Boolean(strapi.contentTypes[uid]?.options?.draftAndPublish);

/**
 * Recursively build a `populate` fragment covering every path from `attributes`
 * down to a relation whose target is `targetUid`. Descends into components and
 * dynamic zones. Returns null when no such path exists. `seen` guards component cycles.
 */
function buildPopulate(
  strapi: any,
  attributes: Record<string, any> | undefined,
  targetUid: string,
  seen: Set<string>
): Populate | null {
  const populate: Populate = {};
  let found = false;

  for (const [key, attr] of Object.entries(attributes || {})) {
    if (attr.type === 'relation' && attr.target === targetUid) {
      populate[key] = true;
      found = true;
    } else if (attr.type === 'component' && attr.component && !seen.has(attr.component)) {
      const comp = strapi.components[attr.component];
      const sub = buildPopulate(strapi, comp?.attributes, targetUid, new Set(seen).add(attr.component));
      if (sub) {
        populate[key] = { populate: sub };
        found = true;
      }
    } else if (attr.type === 'dynamiczone' && Array.isArray(attr.components)) {
      const on: Record<string, any> = {};
      for (const compName of attr.components) {
        if (seen.has(compName)) continue;
        const comp = strapi.components[compName];
        const sub = buildPopulate(strapi, comp?.attributes, targetUid, new Set(seen).add(compName));
        if (sub) on[compName] = { populate: sub };
      }
      if (Object.keys(on).length) {
        populate[key] = { on };
        found = true;
      }
    }
  }

  return found ? populate : null;
}

/** Build, for every publishable target type, the parent types + populate paths that reach it. */
function buildReverseIndex(strapi: any): Map<string, ParentRef[]> {
  const types = Object.keys(strapi.contentTypes).filter((uid) => isPublishableApiType(strapi, uid));
  const index = new Map<string, ParentRef[]>();

  for (const targetUid of types) {
    const refs: ParentRef[] = [];
    for (const parentUid of types) {
      const populate = buildPopulate(strapi, strapi.contentTypes[parentUid].attributes, targetUid, new Set());
      if (populate) refs.push({ parentUid, populate });
    }
    if (refs.length) index.set(targetUid, refs);
  }
  return index;
}

/* -------------------------------------------------------------------------- */
/* Reference detection + restore                                              */
/* -------------------------------------------------------------------------- */
/** Deep scan: does the populated value contain a relation to `targetDocId`? */
function referencesDoc(value: any, targetDocId: string): boolean {
  if (Array.isArray(value)) return value.some((v) => referencesDoc(v, targetDocId));
  if (value && typeof value === 'object') {
    if (value.documentId === targetDocId) return true;
    return Object.values(value).some((v) => referencesDoc(v, targetDocId));
  }
  return false;
}

async function restoreParents(strapi: any, targetUid: string, targetDocId: string): Promise<void> {
  const refs = reverseIndex.get(targetUid);
  if (!refs?.length) return;

  for (const { parentUid, populate } of refs) {
    let drafts: any[] = [];
    try {
      drafts = await strapi.documents(parentUid).findMany({ status: 'draft', populate });
    } catch (err) {
      strapi.log?.warn(`[relations] scan failed for ${parentUid}: ${(err as Error).message}`);
      continue;
    }

    for (const draft of drafts) {
      if (!referencesDoc(draft, targetDocId)) continue;

      // Only restore a parent that is LIVE but whose published version lost the
      // reference. Skips draft-only parents (nothing to restore) and already-intact
      // ones (idempotent + breaks reference cycles).
      let published: any = null;
      try {
        published = await strapi
          .documents(parentUid)
          .findOne({ documentId: draft.documentId, status: 'published', populate });
      } catch {
        /* treat as not published */
      }
      if (!published || referencesDoc(published, targetDocId)) continue;

      try {
        await strapi.documents(parentUid).publish({ documentId: draft.documentId });
        strapi.log?.info(
          `[relations] re-published ${parentUid} ${draft.documentId} to restore ${targetUid} ${targetDocId}`
        );
      } catch (err) {
        strapi.log?.warn(
          `[relations] re-publish failed for ${parentUid} ${draft.documentId}: ${(err as Error).message}`
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Worker                                                                     */
/* -------------------------------------------------------------------------- */
/** Build the index and start the drain loop ONCE, from bootstrap (no request transaction). */
export function startRepublishWorker(strapi: any, intervalMs = 1000): void {
  reverseIndex = buildReverseIndex(strapi);
  const summary = [...reverseIndex.entries()]
    .map(([t, refs]) => `${t} ← [${refs.map((r) => r.parentUid).join(', ')}]`)
    .join('  |  ');
  strapi.log?.info(`[relations] reverse-reference index: ${summary || '(no embedded relations)'}`);

  const timer = setInterval(async () => {
    if (draining || pending.size === 0) return;
    draining = true;
    const keys = [...pending];
    pending.clear();
    try {
      for (const key of keys) {
        const sep = key.indexOf('|');
        await restoreParents(strapi, key.slice(0, sep), key.slice(sep + 1));
      }
    } finally {
      draining = false;
    }
  }, intervalMs);
  // don't keep the process alive just for this
  if (typeof timer.unref === 'function') timer.unref();
}
