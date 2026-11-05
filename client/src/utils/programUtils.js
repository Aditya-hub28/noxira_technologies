/**
 * Pure presentation helper for program description rendering.
 * Scoped specifically to the known legacy demo FS-DEV string.
 * Preserves all owner-authored text without broad substring suppression.
 */
export const LEGACY_FS_DEV_DEMO_DESC = 'Comprehensive 8-week intensive on modern scalable web architecture.';

export function resolveProgramDescription(prg) {
  if (!prg) return '';
  const desc = prg.description || '';
  if (prg.code === 'FS-DEV' && desc.trim() === LEGACY_FS_DEV_DEMO_DESC) {
    return 'Engineering track covering modern web architecture with structured evaluation and verified credential issuance.';
  }
  return desc || 'Curriculum and cohort details for this programme will be published by NOXIRA soon.';
}
