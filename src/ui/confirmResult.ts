/**
 * Map ConfirmDialog result to a typed decision.
 * 'confirm' → confirmValue, 'cancel' → cancelValue, anything else → dismissValue.
 */
export type ConfirmResult = 'confirm' | 'cancel' | 'dismiss';

export function mapConfirmResult(
  result: ConfirmResult,
  confirmValue: string,
  cancelValue: string,
  dismissValue = cancelValue
): string {
  if (result === 'confirm') return confirmValue;
  if (result === 'cancel') return cancelValue;
  return dismissValue;
}
