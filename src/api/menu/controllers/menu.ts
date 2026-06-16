/**
 * menu controller
 *
 * Strips expired (out-of-window) menu items server-side at every nesting level, so
 * the storefront only receives currently-active links. Entry-level startAt/endAt is
 * handled by Draft/Publish state (the reconcile cron); `stripExpired` recurses through
 * the nested nav components (menu-item → submenu-item → link).
 */

import { factories } from '@strapi/strapi';
import { stripExpired } from '../../../utils/schedule';

export default factories.createCoreController('api::menu.menu', () => ({
  async find(ctx) {
    const response = await super.find(ctx);
    return { ...response, data: stripExpired(response.data) };
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    return { ...response, data: stripExpired(response.data) };
  },
}));
