import { apiClient } from './client';
import type {
  ApiSuccess,
  EquipResponseDto,
  InventoryItemDto,
  UnequipResponseDto,
} from '@riftborn/shared';

export const inventoryApi = {
  getInventory: async (): Promise<InventoryItemDto[]> => {
    const { data } = await apiClient.get<ApiSuccess<InventoryItemDto[]>>('/inventory');
    return data.data;
  },

  equip: async (itemId: string): Promise<EquipResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<EquipResponseDto>>(
      `/inventory/equip/${itemId}`,
    );
    return data.data;
  },

  unequip: async (itemId: string): Promise<UnequipResponseDto> => {
    const { data } = await apiClient.delete<ApiSuccess<UnequipResponseDto>>(
      `/inventory/equip/${itemId}`,
    );
    return data.data;
  },
};
