import { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  // TODO: replace with the real production API URL once it's known. There is
  // no dev-server proxy in a production build, so this must be an absolute
  // URL the deployed frontend can actually reach (CORS-enabled on the API).
  apiBaseUrl: 'https://api.PLACEHOLDER-DOMAIN.com/api',
  features: {
    enableLogin: true,
    enableHistory: true
  },
  devCredentials: {
    username: '',
    password: ''
  }
};
