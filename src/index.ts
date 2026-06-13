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
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};
