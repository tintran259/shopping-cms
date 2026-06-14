/**
 * Banner lifecycle — revalidate the storefront on editorial changes.
 *
 * A banner can be embedded in many slots/landing pages, and we can't cheaply map
 * which ones, so we revalidate the catch-all `cms` tag (plus `banner:<docId>`).
 */
import { triggerRevalidate } from '../../../../utils/revalidate';

function tagsFor(result: any): string[] {
  return result?.documentId ? ['cms', `banner:${result.documentId}`] : ['cms'];
}

export default {
  async afterCreate({ result }: any) {
    await triggerRevalidate(strapi, 'banner.create', tagsFor(result));
  },
  async afterUpdate({ result }: any) {
    await triggerRevalidate(strapi, 'banner.update', tagsFor(result));
  },
  async afterDelete({ result }: any) {
    await triggerRevalidate(strapi, 'banner.delete', tagsFor(result));
  },
};
