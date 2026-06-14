import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { triggerRevalidate, tagsForDocument } from './utils/revalidate';
import { queueRepublishParents, startRepublishWorker } from './utils/relations';

// Document Service actions that change what the storefront should see.
const REVALIDATING_ACTIONS = new Set(['create', 'update', 'delete', 'publish', 'unpublish']);

/**
 * Reject an invalid scheduling window (startAt must be strictly before endAt).
 * Both bounds optional; only validated when both are present. Throws a ValidationError
 * so the admin blocks Save/Publish with the message.
 */
const assertValidWindow = (startAt: unknown, endAt: unknown) => {
  if (typeof startAt === 'string' && typeof endAt === 'string') {
    if (Date.parse(startAt) >= Date.parse(endAt)) {
      throw new errors.ValidationError(
        'Thời gian bắt đầu (startAt) phải trước thời gian kết thúc (endAt).',
        { errors: [{ path: ['endAt'], message: 'endAt phải sau startAt', name: 'ValidationError' }] }
      );
    }
  }
};

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    // Register the "tiptap" global custom field (uid: global::tiptap).
    // The underlying storage type must match the admin registration in src/admin/app.tsx.
    strapi.customFields.register({
      name: 'tiptap',
      // Stores a per-device document: { desktop, tablet, mobile } as JSON.
      type: 'json',
    });

    // Revalidate the storefront on ANY content mutation — crucially including
    // `publish`/`unpublish`, which do NOT fire entity lifecycle hooks in Strapi 5.
    // A Document Service middleware is the reliable place to catch them all.
    strapi.documents.use(async (context, next) => {
      const pre = context as unknown as {
        uid: string;
        action: string;
        params?: { documentId?: string; data?: { startAt?: unknown; endAt?: unknown } };
      };
      // Validate the scheduling window BEFORE the write, for any scheduled content type.
      if (
        pre.uid.startsWith('api::') &&
        (pre.action === 'create' || pre.action === 'update') &&
        pre.params?.data
      ) {
        const ct = strapi.contentTypes[pre.uid as keyof typeof strapi.contentTypes] as any;
        const scheduled =
          ct?.attributes?.startAt?.type === 'datetime' && ct?.attributes?.endAt?.type === 'datetime';
        if (scheduled) {
          assertValidWindow(pre.params.data.startAt, pre.params.data.endAt);
        }
      }

      // Publishing a banner whose endAt has already passed is contradictory: the
      // reconcile cron would immediately unpublish it again (endAt < now → out of
      // window). Treat the manual publish as "show it now" by clearing the stale
      // endAt FIRST, so the published row is active and stays published.
      if (
        pre.uid.startsWith('api::') &&
        pre.action === 'publish' &&
        pre.params?.documentId
      ) {
        const ct = strapi.contentTypes[pre.uid as keyof typeof strapi.contentTypes] as any;
        if (ct?.attributes?.endAt?.type === 'datetime') {
          const draft = await strapi
            .documents(pre.uid as any)
            .findOne({ documentId: pre.params.documentId, status: 'draft', fields: ['endAt'] });
          const endAt = (draft as any)?.endAt;
          if (typeof endAt === 'string' && Date.parse(endAt) < Date.now()) {
            await strapi
              .documents(pre.uid as any)
              .update({ documentId: pre.params.documentId, data: { endAt: null } });
            strapi.log.info(
              `[schedule] cleared expired endAt on publish of ${pre.uid} ${pre.params.documentId}`
            );
          }
        }
      }

      const result = await next();
      const { uid, action, params } = context as unknown as {
        uid: string;
        action: string;
        params?: { documentId?: string };
      };
      if (uid.startsWith('api::') && REVALIDATING_ACTIONS.has(action)) {
        // fire-and-forget so admin saves/publishes aren't blocked on the webhook
        void triggerRevalidate(strapi, `${uid}.${action}`, tagsForDocument(uid, result));

        // Publishing an entry does not restore the severed relation in parents that
        // embed it (directly or via components/dynamic zones). We can't re-publish
        // here (still inside the publish transaction → "Transaction query already
        // complete"); enqueue instead and let the bootstrap worker re-publish the
        // affected parents — generically, for ANY content type — in a clean context.
        if (action === 'publish') {
          const docId = (result as any)?.documentId || params?.documentId;
          if (docId) queueRepublishParents(uid, docId);
        }
      }
      return result;
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Drains queued parent re-publishes outside any request transaction.
    startRepublishWorker(strapi);

    // Grant the storefront (Public role) read access to the CMS content types.
    // Idempotent: only missing permissions are created.
    const PUBLIC_READ: string[] = [
      'api::content-slot.content-slot',
      'api::landing-page.landing-page',
      'api::banner.banner',
      'api::global-seo-setting.global-seo-setting',
    ];

    const publicRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    if (!publicRole) return;

    for (const uid of PUBLIC_READ) {
      // Single types only expose `find`; collection types add `findOne`.
      const isSingleType =
        strapi.contentType(uid as Parameters<typeof strapi.contentType>[0])
          ?.kind === 'singleType';
      const actions = isSingleType ? ['find'] : ['find', 'findOne'];

      for (const act of actions) {
        const action = `${uid}.${act}`;
        const existing = await strapi.db
          .query('plugin::users-permissions.permission')
          .findOne({ where: { action, role: publicRole.id } });
        if (!existing) {
          await strapi.db
            .query('plugin::users-permissions.permission')
            .create({ data: { action, role: publicRole.id } });
        }
      }
    }

    // Backfill slugs for landing pages created before the `slug` field existed.
    const slugify = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'page';

    const pages = await strapi
      .documents('api::landing-page.landing-page')
      .findMany({ status: 'published', fields: ['title', 'slug'] });

    for (const page of pages as Array<{ documentId: string; title: string; slug?: string }>) {
      if (page.slug) continue;
      const slug = slugify(page.title);
      await strapi
        .documents('api::landing-page.landing-page')
        .update({ documentId: page.documentId, data: { slug } });
      await strapi
        .documents('api::landing-page.landing-page')
        .publish({ documentId: page.documentId });
    }
  },
};
