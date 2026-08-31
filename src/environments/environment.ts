import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  // Dev requests go through proxy.conf.json, so this stays relative.
  apiBaseUrl: '/api',
  features: {
    enableLogin: true,
    enableHistory: true
  },
  devCredentials: {
    username: 'Admin',
    // Left blank on purpose — set this locally, don't commit a real password.
    password: 'Admin@123'
  }
};