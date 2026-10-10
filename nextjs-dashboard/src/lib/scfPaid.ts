// How a recorded SCF payment compares with its award.
//
// SCF pays in XLM, and each payout's USD value is fixed on the payment date, so the USD paid can
// land slightly above the USD award. Gaps up to PAID_TOLERANCE are exchange-rate noise, not errors.
// Legacy awards (SCF #2-#9) often have no award amount recorded, so any payment would look like an
// overpayment; those are reported as a missing award amount instead.
export const PAID_TOLERANCE = 0.025;

export type PaidStatus = 'ok' | 'award_missing' | 'over';

export function paidStatus(awarded: number | string | null | undefined, paid: number | string | null | undefined): PaidStatus {
  const a = Number(awarded) || 0;
  const p = Number(paid) || 0;
  if (p <= 0) return 'ok';
  if (a <= 0) return 'award_missing';
  return p > a * (1 + PAID_TOLERANCE) ? 'over' : 'ok';
}
