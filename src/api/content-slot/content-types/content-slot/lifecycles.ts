/**
 * Content-slot lifecycle — revalidate the storefront on editorial changes
 * (create/update/delete, incl. publish/unpublish which run as updates).
 * Time-based start/end boundaries are handled by the schedule cron.
 *
 * Tags: `slot:<position>` (targeted) + `cms` (catch-all) via triggerRevalidate.
 */
import { triggerRevalidate } from '../../../../utils/revalidate';

function tagsFor(result: any): string[] {
  const pos = result?.position;
  return pos ? [`slot:${pos}`] : ['cms'];
}

export default {
  async afterCreate({ result }: any) {
    await triggerRevalidate(strapi, 'content-slot.create', tagsFor(result));
  },
  async afterUpdate({ result }: any) {
    await triggerRevalidate(strapi, 'content-slot.update', tagsFor(result));
  },
  async afterDelete({ result }: any) {
    await triggerRevalidate(strapi, 'content-slot.delete', tagsFor(result));
  },
};
