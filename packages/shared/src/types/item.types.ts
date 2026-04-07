export enum ItemRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

export enum ItemSlot {
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  HELMET = 'HELMET',
  ACCESSORY = 'ACCESSORY',
}

export interface ItemTemplateDto {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  description: string;
  icon: string;
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  minZone: number;
}

export interface InventoryItemDto {
  id: string;
  templateId: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  itemLevel: number;
  isEquipped: boolean;
  atkBonus: number;
  defBonus: number;
  hpBonus: number;
  enhancementLevel: number;
  obtainedAt: string;
}

export interface EquipResponseDto {
  equipped: InventoryItemDto;
  unequipped: InventoryItemDto | null;
  newPowerScore: number;
}

export interface UnequipResponseDto {
  item: InventoryItemDto;
  newPowerScore: number;
}

export interface ItemDropDto {
  dropped: boolean;
  item: InventoryItemDto | null;
}

export interface EquipmentBonusDto {
  atkBonus: number;
  defBonus: number;
  hpBonus: number;
}
