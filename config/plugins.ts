import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'legacy-support',
      jwt: {
        expiresIn: '30d',
      },
    },
  },
});

export default config;