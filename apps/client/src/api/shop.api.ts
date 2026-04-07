import axios from 'axios';
import type {
  ShopCatalogDto,
  ShopFreePackResponseDto,
  ShopPurchaseResponseDto,
  ShopStateDto,
} from '@riftborn/shared';

const BASE = '/api/v1/shop';

export const shopApi = {
  getCatalog: (): Promise<ShopCatalogDto> =>
    axios.get<ShopCatalogDto>(`${BASE}/catalog`).then((r) => r.data),

  getState: (): Promise<ShopStateDto> =>
    axios.get<ShopStateDto>(`${BASE}/state`).then((r) => r.data),

  purchase: (offerId: string): Promise<ShopPurchaseResponseDto> =>
    axios
      .post<ShopPurchaseResponseDto>(`${BASE}/purchase`, { offerId })
      .then((r) => r.data),

  claimFreePack: (): Promise<ShopFreePackResponseDto> =>
    axios
      .post<ShopFreePackResponseDto>(`${BASE}/claim-daily-free`)
      .then((r) => r.data),
};
