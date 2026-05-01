import { createWorld, defineComponent, Types } from 'bitecs'

export const world = createWorld()

export const Position   = defineComponent({ x: Types.f32, y: Types.f32 })
export const Health     = defineComponent({ current: Types.i16, max: Types.i16 })
export const StatusComp = defineComponent({ value: Types.ui8 })
