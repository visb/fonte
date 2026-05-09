import axios from 'axios';
import { createAuthModule } from './modules/auth.js';
import { createResidentsModule } from './modules/residents.js';
import { createStaffModule } from './modules/staff.js';
import { createIncidentsModule } from './modules/incidents.js';
import { createStoreroomModule } from './modules/storeroom.js';
import { createHousesModule } from './modules/houses.js';
import { createMinistriesModule } from './modules/ministries.js';
import { createRelativesModule } from './modules/relatives.js';
import { createDocumentTemplatesModule } from './modules/document-templates.js';

export interface ApiClientConfig {
  baseURL: string;
  getToken: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
}

export function createApiClient(config: ApiClientConfig) {
  const http = axios.create({ baseURL: config.baseURL });

  http.interceptors.request.use(async (req) => {
    const token = await config.getToken();
    if (token) req.headers.Authorization = `Bearer ${token}`;
    return req;
  });

  if (config.onUnauthorized) {
    const handler = config.onUnauthorized;
    http.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) handler();
        return Promise.reject(err);
      },
    );
  }

  return {
    auth: createAuthModule(http),
    residents: createResidentsModule(http),
    staff: createStaffModule(http),
    incidents: createIncidentsModule(http),
    storeroom: createStoreroomModule(http),
    houses: createHousesModule(http),
    ministries: createMinistriesModule(http),
    relatives: createRelativesModule(http),
    documentTemplates: createDocumentTemplatesModule(http),
    photoUrl: (path: string | null | undefined): string | null => {
      if (!path) return null;
      if (path.startsWith('http://') || path.startsWith('https://')) return path;
      const origin = config.baseURL.replace(/\/api\/v\d+\/?$/, '');
      return `${origin}${path}`;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
