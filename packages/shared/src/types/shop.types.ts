export type ShopCurrency = 'gold' | 'diamond';

export type ShopSection = 'gold' | 'diamond' | 'daily';

export type RewardKind =
  | 'gold'
  | 'diamond'
  | 'forgeDust'
  | 'echoShards'
  | 'bossSeals'
  | 'enchantStones'
  | 'companion'
  | 'item';

export interface ShopRewardDto {
  kind: RewardKind;
  amount?: number;
  templateId?: string;
  label: string;
}

export interface ShopOfferDto {
  id: string;
  section: ShopSection;
  name: string;
  description: string;
  icon: string;
  currencyType: ShopCurrency;
  cost: number;
  rewards: ShopRewardDto[];
  dailyLimit: number | null;
  isFree: boolean;
}

export interface ShopCatalogDto {
  offers: ShopOfferDto[];
}

export interface OfferStateDto {
  offerId: string;
  purchasedToday: number;
  dailyLimit: number | null;
  canPurchase: boolean;
}

export interface ShopStateDto {
  periodKey: string;
  offerStates: OfferStateDto[];
  freePackClaimed: boolean;
}

export interface ShopPurchaseRequestDto {
  offerId: string;
}

export interface ShopPurchaseResponseDto {
  offerId: string;
  rewards: ShopRewardDto[];
  newGoldBalance: number;
  newDiamondBalance: number;
  offerState: OfferStateDto;
}

export interface ShopFreePackResponseDto {
  rewards: ShopRewardDto[];
  newGoldBalance: number;
  newDiamondBalance: number;
  freePackClaimed: boolean;
}
