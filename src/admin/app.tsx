import type { StrapiApp } from '@strapi/strapi/admin';
import TiptapIcon from './components/TiptapIcon';
import SchedulePanel from './components/SchedulePanel';

export default {
  config: {
    locales: [],
  },
  register(app: StrapiApp) {
    app.customFields.register({
      name: 'tiptap',
      // No `pluginId` → this is a global custom field, registered as `global::tiptap`.
      type: 'json', // stores { desktop, tablet, mobile }. Must match the server registration.
      intlLabel: {
        id: 'tiptap.label',
        defaultMessage: 'Rich text (TipTap)',
      },
      intlDescription: {
        id: 'tiptap.description',
        defaultMessage: 'A free, self-built TipTap rich text editor',
      },
      icon: TiptapIcon,
      components: {
        Input: async () => import('./components/TiptapInput'),
      },
    });
  },
  bootstrap(app: StrapiApp) {
    // Add a "Scheduling" side panel to the edit-view right column (next to Publish).
    // It renders only for content types that declare startAt/endAt (see SchedulePanel).
    (app.getPlugin('content-manager') as any).apis.addEditViewSidePanel([SchedulePanel]);
  },
};
