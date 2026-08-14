/**
 * Map ConfirmDialog result to a typed decision.
 */
export function mapConfirmResult(
  result: 'confirm' | 'cancel',
  confirmValue: string,
  cancelValue: string
): string {
  return result === 'confirm' ? confirmValue : cancelValue;
}
