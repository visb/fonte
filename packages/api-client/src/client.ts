import axios from 'axios';
import { createAuthModule } from './modules/auth.js';
import { createResidentsModule } from './modules/residents.js';
import { createResidentSessionsModule } from './modules/resident-sessions.js';
import { createStaffModule } from './modules/staff.js';
import { createIncidentsModule } from './modules/incidents.js';
import { createStoreroomModule } from './modules/storeroom.js';
import { createHousesModule } from './modules/houses.js';
import { createMinistriesModule } from './modules/ministries.js';
import { createMessagesModule } from './modules/messages.js';
import { createRelativesModule } from './modules/relatives.js';
import { createDocumentTemplatesModule } from './modules/document-templates.js';
import { createSupportGroupsModule } from './modules/support-groups.js';
import { createWishlistModule } from './modules/wishlist.js';
import { createAppSettingsModule } from './modules/app-settings.js';
import { createStreetSalesModule } from './modules/street-sales.js';
import { createSupplyRoomModule } from './modules/supply-room.js';
import { createBibleCourseModule } from './modules/bible-course.js';
import { createNotificationsModule } from './modules/notifications.js';
import { createCensusModule } from './modules/census.js';

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
    residentSessions: createResidentSessionsModule(http),
    staff: createStaffModule(http),
    incidents: createIncidentsModule(http),
    storeroom: createStoreroomModule(http),
    houses: createHousesModule(http),
    ministries: createMinistriesModule(http),
    messages: createMessagesModule(http),
    relatives: createRelativesModule(http),
    documentTemplates: createDocumentTemplatesModule(http),
    supportGroups: createSupportGroupsModule(http),
    wishlist: createWishlistModule(http),
    appSettings: createAppSettingsModule(http),
    streetSales: createStreetSalesModule(http),
    supplyRoom: createSupplyRoomModule(http),
    bibleCourse: createBibleCourseModule(http),
    notifications: createNotificationsModule(http),
    census: createCensusModule(http),
    photoUrl: (path: string | null | undefined): string | null => {
      if (!path) return null;
      if (path.startsWith('http://') || path.startsWith('https://')) return path;
      const origin = config.baseURL.replace(/\/api\/v\d+\/?$/, '');
      return `${origin}${path}`;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
