import { createWorld, defineComponent, Types } from 'bitecs'

export const world = createWorld()

export const Position   = defineComponent({ x: Types.f32, y: Types.f32 })
export const Health     = defineComponent({ current: Types.i16, max: Types.i16 })
export const TeamComp   = defineComponent({ id: Types.ui8 })
export const StatusComp = defineComponent({ value: Types.ui8 })
export const UnitMeta   = defineComponent({ nameIndex: Types.ui16 })

const PREFIXES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo',
                  'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet']

const UNITS_TOTAL = Math.min(20_000, Math.max(1, parseInt(process.env.UNITS_TOTAL ?? '20000', 10)))

export const UNIT_NAMES: string[] = Array.from({ length: UNITS_TOTAL }, (_, i) => {
  const prefix = PREFIXES[i % PREFIXES.length]
  return `${prefix}-${String(i).padStart(4, '0')}`
})
