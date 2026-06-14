/**
 * Landing-page lifecycle — revalidate the storefront on editorial changes.
 * Tags: `landing:<slug>` (targeted) + `cms` (catch-all).
 */
import { triggerRevalidate } from '../../../../utils/revalidate';

function tagsFor(result: any): string[] {
  return result?.slug ? [`landing:${result.slug}`] : ['cms'];
}

export default {
  async afterCreate({ result }: any) {
    await triggerRevalidate(strapi, 'landing-page.create', tagsFor(result));
  },
  async afterUpdate({ result }: any) {
    await triggerRevalidate(strapi, 'landing-page.update', tagsFor(result));
  },
  async afterDelete({ result }: any) {
    await triggerRevalidate(strapi, 'landing-page.delete', tagsFor(result));
  },
};
