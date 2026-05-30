import type { AxiosInstance } from 'axios';
import type {
  StreetSale,
  StreetSaleType,
  StreetSalesReportResponse,
  CreateStreetSaleInput,
  UpdateStreetSaleInput,
  GetStreetSalesReportParams,
} from '../types.js';

export function createStreetSalesModule(http: AxiosInstance) {
  return {
    create: (data: CreateStreetSaleInput) =>
      http.post<StreetSale>('/street-sales', data).then((r) => r.data),

    list: (params?: { houseId?: string; type?: StreetSaleType }) =>
      http.get<StreetSale[]>('/street-sales', { params }).then((r) => r.data),

    report: (params: GetStreetSalesReportParams) =>
      http
        .get<StreetSalesReportResponse>('/street-sales/report', { params })
        .then((r) => r.data),

    findOne: (id: string) =>
      http.get<StreetSale>(`/street-sales/${id}`).then((r) => r.data),

    update: (id: string, data: UpdateStreetSaleInput) =>
      http.patch<StreetSale>(`/street-sales/${id}`, data).then((r) => r.data),

    remove: (id: string) =>
      http.delete(`/street-sales/${id}`).then((r) => r.data),
  };
}
