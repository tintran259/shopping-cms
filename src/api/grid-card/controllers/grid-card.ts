/**
 * grid-card controller
 *
 * A Grid card carries a dynamic zone of blocks. Out-of-window (expired) blocks are
 * stripped server-side, mirroring the content-slot controller. Entry-level
 * startAt/endAt is handled by Draft/Publish state (the reconcile cron), and when a
 * card is populated as a relation inside a content-slot/banner the parent's
 * controller already strips expired blocks recursively.
 */

import { factories } from '@strapi/strapi';
import { stripExpired } from '../../../utils/schedule';

export default factories.createCoreController('api::grid-card.grid-card', () => ({
  async find(ctx) {
    const response = await super.find(ctx);
    return { ...response, data: stripExpired(response.data) };
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    return { ...response, data: stripExpired(response.data) };
  },
}));
