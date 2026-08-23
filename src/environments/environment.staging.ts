import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  // TODO: replace with the real staging API URL once it's known. There is no
  // dev-server proxy for this build configuration, so this must be an
  // absolute URL the deployed frontend can actually reach (CORS-enabled on
  // the API).
  apiBaseUrl: 'https://api.staging.PLACEHOLDER-DOMAIN.com/api',
  features: {
    enableLogin: true,
    enableHistory: true
  },
  devCredentials: {
    username: '',
    password: ''
  }
};
