import type { Core } from '@strapi/strapi';

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
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
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
