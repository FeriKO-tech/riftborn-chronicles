import type { CompanionBonusDto, CompanionTemplateDto } from '@riftborn/shared';

export const COMPANION_TEMPLATES: ReadonlyMap<string, CompanionTemplateDto> = new Map([
  [
    'void_sprite',
    {
      id: 'void_sprite',
      name: 'Void Sprite',
      title: 'Void Whisper',
      icon: '🌑',
      rarity: 'COMMON',
      description: 'A curious spirit drawn from the first Fracture. Given to all Riftborn.',
      bonus: { atkPct: 2, defPct: 2, hpPct: 0 },
    },
  ],
  [
    'lyra',
    {
      id: 'lyra',
      name: 'Lyra',
      title: 'Spirit Guide',
      icon: '🦋',
      rarity: 'RARE',
      description: 'A mystical spirit who amplifies attack energy through resonance.',
      bonus: { atkPct: 8, defPct: 0, hpPct: 0 },
    },
  ],
  [
    'talon',
    {
      id: 'talon',
      name: 'Talon',
      title: 'Beast Guardian',
      icon: '🦅',
      rarity: 'RARE',
      description: 'A fierce protector whose presence hardens your defenses.',
      bonus: { atkPct: 0, defPct: 10, hpPct: 5 },
    },
  ],
  [
    'ember',
    {
      id: 'ember',
      name: 'Ember',
      title: 'Flame Spirit',
      icon: '🔥',
      rarity: 'EPIC',
      description: 'Born in the Fracture Core. Burns with void flame to boost all stats.',
      bonus: { atkPct: 5, defPct: 3, hpPct: 8 },
    },
  ],
]);

export const STARTER_COMPANION_ID = 'void_sprite';
export const COMPANION_TEMPLATE_LIST = [...COMPANION_TEMPLATES.values()];

/** Pure helper — returns zero bonus if no companion or template not found */
export function getCompanionBonus(templateId: string | null | undefined): CompanionBonusDto {
  if (!templateId) return { atkPct: 0, defPct: 0, hpPct: 0 };
  return COMPANION_TEMPLATES.get(templateId)?.bonus ?? { atkPct: 0, defPct: 0, hpPct: 0 };
}
