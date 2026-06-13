/**
 * banner controller
 *
 * Applies time-window scheduling server-side so the storefront only ever receives
 * content that is active "now":
 *  - entry level:     out-of-window Banner entries are excluded from `find`
 *  - component level: out-of-window blocks inside the dynamic zone (and the single
 *                     `image` component) are stripped from the response
 */

import { factories } from '@strapi/strapi';
import { activeEntryFilters, stripInactive } from '../../../utils/schedule';

export default factories.createCoreController('api::banner.banner', () => ({
  async find(ctx) {
    const nowISO = new Date().toISOString();
    const existing = ctx.query?.filters;

    ctx.query = {
      ...ctx.query,
      filters: existing ? { $and: [existing, activeEntryFilters(nowISO)] } : activeEntryFilters(nowISO),
    };

    const response = await super.find(ctx);
    return { ...response, data: stripInactive(response.data) };
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    return { ...response, data: stripInactive(response.data) };
  },
}));
