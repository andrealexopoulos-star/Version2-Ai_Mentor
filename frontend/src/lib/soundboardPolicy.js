import { resolveTier, TIER_RANK } from './tierResolver';
import { isPrivilegedUser } from './privilegedUser';

export const SOUNDBOARD_CONTRACT_VERSION = 'soundboard_v3';

export const SOUND_BOARD_MODES = [
  { id: 'auto', label: 'BIQc Auto', desc: 'Adaptive routing across BIQc cognition pathways', icon: '⚡', backend_mode: 'auto', minTier: 'free' },
  { id: 'normal', label: 'Normal', desc: 'Default paid conversation mode', icon: '◉', backend_mode: 'normal', minTier: 'starter' },
  { id: 'thinking', label: 'Deep Thinking', desc: 'High-depth strategic reasoning mode', icon: '🧠', backend_mode: 'thinking', minTier: 'starter' },
  { id: 'pro', label: 'Pro Analysis', desc: 'Expanded multi-domain executive analysis', icon: '✦', backend_mode: 'pro', minTier: 'starter' },
  { id: 'trinity', label: 'BIQc Trinity', desc: 'Consensus intelligence across BIQc model pathways', icon: '◈', backend_mode: 'trinity', minTier: 'starter' },
];

export function getSoundboardPolicy(user) {
  const tier = resolveTier(user);
  const privileged = isPrivilegedUser(user);
  const tierRank = TIER_RANK[tier] ?? 0;
  const canUseTrinity = privileged || tierRank >= (TIER_RANK.starter ?? 1);
  const availableModes = SOUND_BOARD_MODES.filter((mode) => {
    if (privileged) return true;
    if (mode.id === 'trinity') return canUseTrinity;
    return tierRank >= (TIER_RANK[mode.minTier] ?? 0);
  });
  return {
    contractVersion: SOUNDBOARD_CONTRACT_VERSION,
    tier,
    privileged,
    tierRank,
    isPaidUser: tierRank >= (TIER_RANK.starter ?? 1),
    canUseTrinity,
    availableModes,
  };
}

export function normalizeMessageContent(rawContent) {
  if (typeof rawContent === 'string') return rawContent;
  if (rawContent == null) return '';
  if (typeof rawContent === 'object') {
    if (typeof rawContent.content === 'string') return rawContent.content;
    if (typeof rawContent.text === 'string') return rawContent.text;
    try {
      return JSON.stringify(rawContent, null, 2);
    } catch {
      return String(rawContent);
    }
  }
  return String(rawContent);
}
