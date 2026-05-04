export const STATUS = { IDLE: 0, MOVING: 1, ATTACKING: 2, DEAD: 3 } as const
export type UnitStatus = typeof STATUS[keyof typeof STATUS]

export const TEAM = { A: 0, B: 1 } as const
export type Team = typeof TEAM[keyof typeof TEAM]

export type Unit = {
  id: number
  x: number
  y: number
  hp: number
  maxHp: number
  status: UnitStatus
  team: Team
  name: string
}

export type UnitDelta = {
  id: number
  x?: number
  y?: number
  hp?: number
  status?: UnitStatus
}

export type GameEvent =
  | { type: 'attack';     attacker: number; target: number; ts: number }
  | { type: 'destroyed';  unit: number; team: Team; ts: number }
  | { type: 'capture';    zone: number; team: Team; ts: number }
  | { type: 'capturing';  zone: number; team: Team; progress: number; required: number; ts: number }
  | { type: 'contesting'; zone: number; progress: number; ts: number }
  | { type: 'heal';       unit: number; amount: number; ts: number }

export type ZoneState = {
  id: number
  label: string
  cx: number
  cy: number
  r: number
  team: Team | null
  progress: number
}

export type FilterState = {
  team: Team | 'all'
  status: UnitStatus | 'all'
  hpMin: number
  hpMax: number
  search: string
}
