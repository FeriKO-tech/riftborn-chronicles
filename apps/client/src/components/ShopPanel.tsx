import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OfferStateDto, ShopOfferDto, ShopSection } from '@riftborn/shared';
import { usePlayerStore } from '../store/player.store';
import { notify } from '../store/notification.store';
import { shopApi } from '../api/shop.api';

// ── Styles ──────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(6px)',
  zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const panel: React.CSSProperties = {
  width: '780px', maxWidth: '96vw',
  maxHeight: '88vh',
  background: 'linear-gradient(180deg,#12083a 0%,#0d0821 100%)',
  border: '1px solid rgba(167,139,250,0.2)',
  borderRadius: '16px',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid rgba(167,139,250,0.12)',
  flexShrink: 0,
};

const closeBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: 'none', color: '#9ca3af',
  width: '32px', height: '32px',
  borderRadius: '8px', cursor: 'pointer',
  fontSize: '16px',
};

const tabsBar: React.CSSProperties = {
  display: 'flex', gap: '4px',
  padding: '10px 20px 0',
  borderBottom: '1px solid rgba(167,139,250,0.10)',
  flexShrink: 0,
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: '8px 8px 0 0',
  border: 'none',
  fontSize: '12px', fontWeight: 600,
  cursor: 'pointer',
  background: active ? 'rgba(124,58,237,0.25)' : 'transparent',
  color: active ? '#a78bfa' : '#6b7280',
  borderBottom: active ? '2px solid #7c3aed' : '2px solid transparent',
  transition: 'all 0.15s',
});

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
  gap: '12px',
  padding: '16px 20px',
  overflowY: 'auto',
  flex: 1,
};

const card = (soldOut: boolean): React.CSSProperties => ({
  background: soldOut ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.06)',
  border: `1px solid ${soldOut ? 'rgba(255,255,255,0.06)' : 'rgba(167,139,250,0.18)'}`,
  borderRadius: '12px',
  padding: '14px',
  display: 'flex', flexDirection: 'column', gap: '8px',
  opacity: soldOut ? 0.55 : 1,
  transition: 'border-color 0.15s',
});

const buyBtn = (disabled: boolean, free: boolean, gold: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '9px',
  borderRadius: '8px',
  border: 'none',
  fontWeight: 700, fontSize: '12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled
    ? 'rgba(255,255,255,0.06)'
    : free
    ? 'linear-gradient(135deg,#4ade80,#22c55e)'
    : gold
    ? 'linear-gradient(135deg,#f59e0b,#d97706)'
    : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
  color: disabled ? '#6b7280' : '#fff',
  transition: 'opacity 0.15s',
});

// ── Types ────────────────────────────────────────────────────────────────────

const TABS: { id: ShopSection | 'free'; label: string; icon: string }[] = [
  { id: 'gold', label: 'Gold Shop', icon: '🪙' },
  { id: 'diamond', label: 'Diamond Shop', icon: '💎' },
  { id: 'daily', label: 'Daily Deals', icon: '🔄' },
  { id: 'free', label: 'Free Pack', icon: '🎁' },
];

function formatCost(cost: number, currency: 'gold' | 'diamond'): string {
  if (currency === 'gold') {
    return cost >= 1000 ? `${(cost / 1000).toFixed(cost % 1000 === 0 ? 0 : 1)}k` : String(cost);
  }
  return String(cost);
}

// ── OfferCard ────────────────────────────────────────────────────────────────

function OfferCard({
  offer,
  state,
  onBuy,
  isBuying,
}: {
  offer: ShopOfferDto;
  state: OfferStateDto | undefined;
  onBuy: (id: string) => void;
  isBuying: boolean;
}) {
  const soldOut = state ? !state.canPurchase : false;
  const claimed = offer.isFree && soldOut;

  const limitLabel =
    offer.dailyLimit !== null && !offer.isFree
      ? `${state?.purchasedToday ?? 0}/${offer.dailyLimit} today`
      : null;

  return (
    <div style={card(soldOut)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '28px' }}>{offer.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#e8e0ff', margin: 0, lineHeight: 1.2 }}>
            {offer.name}
          </p>
          {limitLabel && (
            <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>
              {limitLabel}
            </p>
          )}
        </div>
      </div>

      <p style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.4, margin: 0 }}>
        {offer.description}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {offer.rewards.map((r, i) => (
          <span key={i} style={{
            fontSize: '10px', color: '#a78bfa',
            background: 'rgba(124,58,237,0.15)',
            borderRadius: '4px', padding: '2px 6px',
          }}>
            {r.label}
          </span>
        ))}
      </div>

      <button
        style={buyBtn(soldOut || isBuying, offer.isFree, offer.currencyType === 'gold')}
        onClick={() => !soldOut && !isBuying && onBuy(offer.id)}
        disabled={soldOut || isBuying}
      >
        {claimed
          ? '✓ Claimed'
          : soldOut
          ? '✗ Sold Out'
          : offer.isFree
          ? '🎁 Claim Free'
          : offer.currencyType === 'gold'
          ? `🪙 ${formatCost(offer.cost, 'gold')} Gold`
          : `💎 ${offer.cost} Diamonds`}
      </button>
    </div>
  );
}

// ── ShopPanel ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function ShopPanel({ onClose }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ShopSection | 'free'>('gold');
  const currencies = usePlayerStore((s) => s.playerState?.currencies);

  const { data: catalog } = useQuery({
    queryKey: ['shop', 'catalog'],
    queryFn: shopApi.getCatalog,
    staleTime: 5 * 60_000,
  });

  const { data: shopState, refetch: refetchState } = useQuery({
    queryKey: ['shop', 'state'],
    queryFn: shopApi.getState,
    staleTime: 0,
  });

  const stateMap = new Map<string, OfferStateDto>(
    shopState?.offerStates.map((s) => [s.offerId, s]),
  );

  const [buyingId, setBuyingId] = useState<string | null>(null);

  const purchase = useMutation({
    mutationFn: shopApi.purchase,
    onSuccess: (data) => {
      notify.loot(`✓ Bought! ${data.rewards.map((r) => r.label).join(' · ')}`);
      void refetchState();
      void qc.invalidateQueries({ queryKey: ['player', 'state'] });
    },
    onError: (err: Error) => {
      notify.error(err.message ?? 'Purchase failed');
    },
    onSettled: () => setBuyingId(null),
  });

  const claimFree = useMutation({
    mutationFn: shopApi.claimFreePack,
    onSuccess: (data) => {
      notify.success(`🎁 Daily pack claimed! ${data.rewards.map((r) => r.label).join(' · ')}`);
      void refetchState();
      void qc.invalidateQueries({ queryKey: ['player', 'state'] });
    },
    onError: (err: Error) => {
      notify.error(err.message ?? 'Already claimed today');
    },
    onSettled: () => setBuyingId(null),
  });

  const handleBuy = (offerId: string) => {
    const offer = catalog?.offers.find((o) => o.id === offerId);
    if (!offer) return;
    setBuyingId(offerId);
    if (offer.isFree) {
      claimFree.mutate();
    } else {
      purchase.mutate(offerId);
    }
  };

  const filteredOffers = (catalog?.offers ?? []).filter((o) => {
    if (activeTab === 'free') return o.isFree;
    if (activeTab === 'daily') return o.section === 'daily' && !o.isFree;
    return o.section === activeTab;
  });

  const freePackClaimed = shopState?.freePackClaimed ?? false;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#e8e0ff' }}>
              🏪 Void Market
            </h2>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
              <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600 }}>
                🪙 {currencies?.goldShards?.toLocaleString() ?? '—'} Gold
              </span>
              <span style={{ fontSize: '13px', color: '#a78bfa', fontWeight: 600 }}>
                💎 {currencies?.voidCrystals ?? '—'} Diamonds
              </span>
            </div>
          </div>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={tabsBar}>
          {TABS.map((t) => (
            <button
              key={t.id}
              style={tabBtn(activeTab === t.id)}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
              {t.id === 'free' && !freePackClaimed && (
                <span style={{
                  marginLeft: '6px',
                  display: 'inline-block',
                  width: '7px', height: '7px',
                  borderRadius: '50%',
                  background: '#4ade80',
                  verticalAlign: 'middle',
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={grid}>
          {filteredOffers.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '13px', gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
              No offers in this category.
            </p>
          ) : (
            filteredOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                state={stateMap.get(offer.id)}
                onBuy={handleBuy}
                isBuying={buyingId === offer.id}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid rgba(167,139,250,0.10)',
          fontSize: '11px', color: '#4b5563',
          flexShrink: 0,
        }}>
          Daily offers reset at midnight UTC. Purchases are instant and server-validated.
        </div>
      </div>
    </div>
  );
}
