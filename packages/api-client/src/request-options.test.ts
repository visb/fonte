import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { requestConfig } from './request-options.js';
import { createActivitiesModule } from './modules/activities.js';
import { createCensusModule } from './modules/census.js';
import { createIncidentsModule } from './modules/incidents.js';
import { createResidentsModule } from './modules/residents.js';
import { createStoreroomModule } from './modules/storeroom.js';
import { createStreetSalesModule } from './modules/street-sales.js';
import { createSupplyRoomModule } from './modules/supply-room.js';

const KEY = '11111111-1111-1111-1111-111111111111';
const HEADERS = { headers: { 'Idempotency-Key': KEY } };

function createHttpMock() {
  return {
    get: vi.fn().mockResolvedValue({ data: undefined }),
    post: vi.fn().mockResolvedValue({ data: undefined }),
    patch: vi.fn().mockResolvedValue({ data: undefined }),
    put: vi.fn().mockResolvedValue({ data: undefined }),
    delete: vi.fn().mockResolvedValue({ data: undefined }),
  };
}

type HttpMock = ReturnType<typeof createHttpMock>;
const asHttp = (h: HttpMock) => h as unknown as AxiosInstance;

describe('requestConfig', () => {
  it('sem opções não gera argumento de config', () => {
    expect(requestConfig()).toEqual([]);
    expect(requestConfig({})).toEqual([]);
    expect(requestConfig({ idempotencyKey: '' })).toEqual([]);
  });

  it('com chave gera o header Idempotency-Key', () => {
    expect(requestConfig({ idempotencyKey: KEY })).toEqual([HEADERS]);
  });
});

/**
 * Story 172 — o header sai na requisição quando a option é passada e **não** sai
 * quando não é (o backend trata ausência do header como comportamento de hoje).
 */
describe('escritas do escopo de idempotência', () => {
  let http: HttpMock;
  beforeEach(() => {
    http = createHttpMock();
  });

  it('storeroom.createMovement', async () => {
    const m = createStoreroomModule(asHttp(http));
    const body = { itemId: 'it1' };

    await m.createMovement(body as never);
    expect(http.post).toHaveBeenLastCalledWith('/storerooms/movements', body);

    await m.createMovement(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/storerooms/movements', body, HEADERS);
  });

  it('storeroom.createItem', async () => {
    const m = createStoreroomModule(asHttp(http));
    const body = { name: 'Arroz' };

    await m.createItem(body as never);
    expect(http.post).toHaveBeenLastCalledWith('/storerooms/items', body);

    await m.createItem(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/storerooms/items', body, HEADERS);
  });

  it('supplyRoom.createItem e createMovement', async () => {
    const m = createSupplyRoomModule(asHttp(http));
    const body = { name: 'Sabão' };

    await m.createItem(body as never);
    expect(http.post).toHaveBeenLastCalledWith('/supply-room/items', body);

    await m.createItem(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/supply-room/items', body, HEADERS);

    await m.createMovement(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/supply-room/movements', body, HEADERS);
  });

  it('incidents.create', async () => {
    const m = createIncidentsModule(asHttp(http));
    const body = { description: 'x' };

    await m.create(body as never);
    expect(http.post).toHaveBeenLastCalledWith('/incidents', body);

    await m.create(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/incidents', body, HEADERS);
  });

  it('streetSales.create e update', async () => {
    const m = createStreetSalesModule(asHttp(http));
    const body = { quantity: 1 };

    await m.create(body as never);
    expect(http.post).toHaveBeenLastCalledWith('/street-sales', body);

    await m.create(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/street-sales', body, HEADERS);

    await m.update('ss1', body as never);
    expect(http.patch).toHaveBeenLastCalledWith('/street-sales/ss1', body);

    await m.update('ss1', body as never, { idempotencyKey: KEY });
    expect(http.patch).toHaveBeenLastCalledWith('/street-sales/ss1', body, HEADERS);
  });

  it('activities.create e addComment', async () => {
    const m = createActivitiesModule(asHttp(http));
    const body = { title: 'x' };

    await m.create(body as never);
    expect(http.post).toHaveBeenLastCalledWith('/activities', body);

    await m.create(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/activities', body, HEADERS);

    await m.addComment('a1', body as never);
    expect(http.post).toHaveBeenLastCalledWith('/activities/a1/comments', body);

    await m.addComment('a1', body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/activities/a1/comments', body, HEADERS);
  });

  it('census.addResident e conclude', async () => {
    const m = createCensusModule(asHttp(http));
    const body = { name: 'Fulano' };

    await m.addResident(body as never);
    expect(http.post).toHaveBeenLastCalledWith('/census/residents', body);

    await m.addResident(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/census/residents', body, HEADERS);

    await m.conclude(body as never);
    expect(http.post).toHaveBeenLastCalledWith('/census/conclude', body);

    await m.conclude(body as never, { idempotencyKey: KEY });
    expect(http.post).toHaveBeenLastCalledWith('/census/conclude', body, HEADERS);
  });

  it('residents.update (status/casa vindos do censo)', async () => {
    const m = createResidentsModule(asHttp(http));
    const body = { status: 'DISCHARGED' };

    await m.update('r1', body as never);
    expect(http.patch).toHaveBeenLastCalledWith('/residents/r1', body);

    await m.update('r1', body as never, { idempotencyKey: KEY });
    expect(http.patch).toHaveBeenLastCalledWith('/residents/r1', body, HEADERS);
  });
});
