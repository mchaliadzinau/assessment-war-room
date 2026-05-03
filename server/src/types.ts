export const STATUS = {
  IDLE: 0,
  MOVING: 1,
  ATTACKING: 2,
  DEAD: 3,
} as const
export type UnitStatus = typeof STATUS[keyof typeof STATUS]

export const TEAM = { A: 0, B: 1 } as const
export type Team = typeof TEAM[keyof typeof TEAM]

export type UnitSnapshot = {
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
  | { type: 'attack';    attacker: number; target: number }
  | { type: 'destroyed'; unit: number; team: Team }
  | { type: 'capture';   zone: number; team: Team }
  | { type: 'heal';      unit: number; amount: number }

export type TickPayload = {
  seq: number
  ts: number
  deltas: UnitDelta[]
  events: GameEvent[]
}

export type SnapshotPayload = {
  type: 'snapshot'
  units: UnitSnapshot[]
  zones: ZoneState[]
}

export type ZoneDefinition = {
  id: number
  cx: number
  cy: number
  r: number
  label: string
}

export type ZoneState = {
  id: number
  team: Team | null
  progress: number
}
