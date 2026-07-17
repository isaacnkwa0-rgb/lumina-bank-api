import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Lumina Bank API',
      version: '1.0.0',
      description: 'Enterprise Banking REST API — Lumina Bank',
      contact: { name: 'Lumina Bank Developer Support', email: 'api@lumina.bank' },
    },
    servers: [{ url: `${env.APP_URL}/api/${env.API_VERSION}`, description: 'API Server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & 2FA' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Accounts', description: 'Bank accounts' },
      { name: 'Transactions', description: 'Transaction history' },
      { name: 'Transfers', description: 'Money transfers' },
      { name: 'Beneficiaries', description: 'Saved beneficiaries' },
      { name: 'Cards', description: 'Card management' },
      { name: 'Investments', description: 'Investment portfolio' },
      { name: 'Loans', description: 'Loans & mortgages' },
      { name: 'Goals', description: 'Savings goals' },
      { name: 'Analytics', description: 'Spending analytics' },
      { name: 'Rates', description: 'Exchange rates & FX' },
      { name: 'Notifications', description: 'Notifications' },
      { name: 'KYC', description: 'Identity verification' },
      { name: 'Admin', description: 'Admin operations' },
    ],
  },
  apis: ['./src/modules/**/*.router.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
