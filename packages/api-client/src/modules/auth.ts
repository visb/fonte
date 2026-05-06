import type { AxiosInstance } from 'axios';
import type { LoginInput, LoginResponse, ChangePasswordInput } from '../types.js';

export function createAuthModule(http: AxiosInstance) {
  return {
    login: (data: LoginInput) =>
      http.post<LoginResponse>('/auth/login', data).then((r) => r.data),
    changePassword: (data: ChangePasswordInput) =>
      http.post<LoginResponse>('/auth/change-password', data).then((r) => r.data),
  };
}
