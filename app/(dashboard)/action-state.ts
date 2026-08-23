/**
 * The shape a dashboard server action returns (§13).
 *
 * Kept out of `actions.ts` because a `"use server"` module may only export
 * async functions — the initial state and its type would be rejected there —
 * and the client controls need both.
 */
export interface ActionState {
  error: string | null;
}

export const IDLE: ActionState = { error: null };
