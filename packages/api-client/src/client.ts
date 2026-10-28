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
import { createAssociatesModule } from './modules/associates.js';
import { createPayablesModule } from './modules/payables.js';
import { createActivitiesModule } from './modules/activities.js';
import { createEventsModule } from './modules/events.js';
import { createSupplyRoomModule } from './modules/supply-room.js';
import { createBibleCourseModule } from './modules/bible-course.js';
import { createNotificationsModule } from './modules/notifications.js';
import { createCensusModule } from './modules/census.js';
import { createBackupModule } from './modules/backup.js';
import { createConsentsModule } from './modules/consents.js';
import { createAuditModule } from './modules/audit.js';
import { createPreferencesModule } from './modules/preferences.js';
import { createOfflineSyncModule } from './modules/offline-sync.js';
import { createObservabilityModule } from './modules/observability.js';
import { createDailyModule } from './modules/daily.js';

/** Contexto do 401 entregue ao `onUnauthorized` (opcional: handlers sem parâmetro continuam válidos). */
export interface UnauthorizedContext {
  /** URL da requisição que recebeu 401, como configurada no axios (ex.: `/residents`). */
  url?: string;
  /** Método HTTP da requisição que recebeu 401. */
  method?: string;
}

export interface ApiClientConfig {
  baseURL: string;
  getToken: () => string | null | Promise<string | null>;
  onUnauthorized?: (context: UnauthorizedContext) => void;
}

/**
 * Rotas em que 401 significa "credencial inválida", não "sessão expirada".
 * Dispará-las no handler global transformaria "senha incorreta" em logout/limpeza
 * de estado à toa (decisão travada da story 165).
 */
const AUTH_ROUTES = ['/auth/login', '/auth/change-password'];

function isAuthRoute(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].replace(/\/+$/, '');
  return AUTH_ROUTES.some((route) => path.endsWith(route));
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
        const url: string | undefined = err.config?.url;
        if (err.response?.status === 401 && !isAuthRoute(url)) {
          handler({ url, method: err.config?.method });
        }
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
    associates: createAssociatesModule(http),
    payables: createPayablesModule(http),
    activities: createActivitiesModule(http),
    events: createEventsModule(http),
    supplyRoom: createSupplyRoomModule(http),
    bibleCourse: createBibleCourseModule(http),
    notifications: createNotificationsModule(http),
    census: createCensusModule(http),
    backup: createBackupModule(http),
    consents: createConsentsModule(http),
    audit: createAuditModule(http),
    preferences: createPreferencesModule(http),
    offlineSync: createOfflineSyncModule(http),
    observability: createObservabilityModule(http),
    daily: createDailyModule(http),
    photoUrl: (path: string | null | undefined): string | null => {
      if (!path) return null;
      if (path.startsWith('http://') || path.startsWith('https://')) return path;
      const origin = config.baseURL.replace(/\/api\/v\d+\/?$/, '');
      return `${origin}${path}`;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
