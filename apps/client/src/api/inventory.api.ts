import { apiClient } from './client';
import type {
  ApiSuccess,
  EquipResponseDto,
  InventoryItemDto,
  UnequipResponseDto,
  SalvageResponseDto,
  EnchantItemResponseDto,
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

  salvage: async (itemId: string): Promise<SalvageResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<SalvageResponseDto>>(
      `/inventory/salvage/${itemId}`,
    );
    return data.data;
  },

  toggleLock: async (itemId: string): Promise<InventoryItemDto> => {
    const { data } = await apiClient.post<ApiSuccess<InventoryItemDto>>(
      `/inventory/lock/${itemId}`,
    );
    return data.data;
  },

  enchant: async (itemId: string): Promise<EnchantItemResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<EnchantItemResponseDto>>(
      `/inventory/enchant/${itemId}`,
    );
    return data.data;
  },
};
