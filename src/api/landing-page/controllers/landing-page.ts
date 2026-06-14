/**
 * landing-page controller
 *
 * Strips out-of-window dynamic-zone blocks (`startAt`/`endAt`) server-side so
 * the storefront only renders active content. The landing-page entry has no
 * scheduling window itself, so only component-level stripping is applied.
 */

import { factories } from '@strapi/strapi';
import { stripExpired } from '../../../utils/schedule';

// Only EXPIRED blocks are dropped server-side; active + upcoming blocks are sent
// (with startAt/endAt) so the storefront can reveal/hide them live on the client.
export default factories.createCoreController('api::landing-page.landing-page', () => ({
  async find(ctx) {
    const response = await super.find(ctx);
    return { ...response, data: stripExpired(response.data) };
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    return { ...response, data: stripExpired(response.data) };
  },
}));
