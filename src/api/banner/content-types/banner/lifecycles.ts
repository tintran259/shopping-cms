/**
 * Banner lifecycle hooks — revalidate the storefront whenever a banner is created,
 * updated (incl. publish/unpublish, which run as updates), or deleted. This covers
 * *editorial* changes; time-based start/end boundaries are covered by the cron task
 * in `config/cron-tasks.ts`.
 */

import { triggerRevalidate } from '../../../../utils/revalidate';

export default {
  async afterCreate() {
    await triggerRevalidate(strapi, 'banner.create');
  },
  async afterUpdate() {
    await triggerRevalidate(strapi, 'banner.update');
  },
  async afterDelete() {
    await triggerRevalidate(strapi, 'banner.delete');
  },
};
