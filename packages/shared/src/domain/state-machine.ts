/**
 * Who is performing a transition, resolved server-side from the verified
 * token and stored records — never from the request body.
 */
export type Actor = 'owner' | 'requester' | 'volunteer' | 'system';

export interface TransitionRule<S extends string> {
  from: S;
  to: S;
  actors: readonly Actor[];
}

export class DomainError extends Error {
  constructor(
    readonly code: 'INVALID_TRANSITION' | 'FORBIDDEN' | 'INSUFFICIENT_STOCK' | 'SELF_REQUEST' | 'CONFLICT' | 'BAD_REQUEST',
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export interface StateMachine<S extends string> {
  readonly name: string;
  readonly rules: readonly TransitionRule<S>[];
  readonly terminal: readonly S[];
}

export function findRule<S extends string>(m: StateMachine<S>, from: S, to: S) {
  return m.rules.find((r) => r.from === from && r.to === to);
}

export function canTransition<S extends string>(m: StateMachine<S>, from: S, to: S, actor: Actor): boolean {
  return findRule(m, from, to)?.actors.includes(actor) ?? false;
}

/** Throws INVALID_TRANSITION for impossible moves, FORBIDDEN for the wrong actor. */
export function assertTransition<S extends string>(m: StateMachine<S>, from: S, to: S, actor: Actor): void {
  const rule = findRule(m, from, to);
  if (!rule) throw new DomainError('INVALID_TRANSITION', `${m.name}: cannot move from ${from} to ${to}`);
  if (!rule.actors.includes(actor)) {
    throw new DomainError('FORBIDDEN', `${m.name}: ${actor} may not move from ${from} to ${to}`);
  }
}

export function allowedTargets<S extends string>(m: StateMachine<S>, from: S, actor: Actor): S[] {
  return m.rules.filter((r) => r.from === from && r.actors.includes(actor)).map((r) => r.to);
}
