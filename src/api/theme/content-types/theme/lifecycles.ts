/**
 * Theme lifecycle — enforce a single active theme.
 *
 * When a theme is saved/published with `isActive: true`, clear the flag on every
 * OTHER theme document. Matched by `documentId` (not `id`) so the current theme's
 * own draft+published rows both stay active; only other documents are cleared.
 */
const ensureSingleActive = async (event: any) => {
  const result = event?.result;
  if (!result?.isActive || !result?.documentId) return;

  await strapi.db.query('api::theme.theme').updateMany({
    where: { documentId: { $ne: result.documentId }, isActive: true },
    data: { isActive: false },
  });
};

export default {
  afterCreate: ensureSingleActive,
  afterUpdate: ensureSingleActive,
};
