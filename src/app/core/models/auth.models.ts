export interface LoginResponse {
  access_token: string;
  token_type: string;
}

/** Structured error surfaced by AuthApiService for the login flow. */
export interface AuthApiError {
  message: string;
  status: number;
}
