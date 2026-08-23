export interface FeatureFlags {
  enableLogin: boolean;
  enableHistory: boolean;
}

/** Local-dev convenience only — prefills the stub login form. Never populate password in a committed file. */
export interface DevCredentials {
  username: string;
  password: string;
}

export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  features: FeatureFlags;
  devCredentials: DevCredentials;
}
