/* eslint-disable max-statements */
// Composables
import { makeElevationProps } from '@/composables/elevation'
import { makeRoundedProps } from '@/composables/rounded'
import { useRtl } from '@/composables/locale'

// Utilities
import { clamp, createRange, getDecimals, propsFactory } from '@/util'
import { computed, provide, ref, toRef } from 'vue'

// Types
import type { ExtractPropTypes, InjectionKey, PropType, Ref } from 'vue'
import type { VSliderTrack } from './VSliderTrack'

type Tick = {
  value: number
  position: number
  label?: string
}

type SliderProvide = {
  activeThumbRef: Ref<HTMLElement | undefined>
  color: Ref<string | undefined>
  decimals: Ref<number>
  direction: Ref<'vertical' | 'horizontal'>
  disabled: Ref<boolean | undefined>
  elevation: Ref<number | string | undefined>
  min: Ref<number>
  max: Ref<number>
  mousePressed: Ref<boolean>
  numTicks: Ref<number>
  onSliderMousedown: (e: MouseEvent) => void
  onSliderTouchstart: (e: TouchEvent) => void
  parseMouseMove: (e: MouseEvent | TouchEvent) => number
  position: (val: number) => number
  readonly: Ref<boolean | undefined>
  rounded: Ref<boolean | number | string | undefined>
  roundValue: (value: number) => number
  thumbLabel: Ref<boolean | string | undefined>
  showTicks: Ref<boolean | 'always'>
  startOffset: Ref<number>
  step: Ref<number>
  thumbSize: Ref<number>
  thumbColor: Ref<string | undefined>
  trackColor: Ref<string | undefined>
  trackFillColor: Ref<string | undefined>
  trackSize: Ref<number>
  ticks: Ref<number[] | Record<string, string> | undefined>
  tickSize: Ref<number>
  trackContainerRef: Ref<VSliderTrack | undefined>
  vertical: Ref<boolean>
  parsedTicks: Ref<Tick[]>
  hasLabels: Ref<boolean>
  isReversed: Ref<boolean>
  horizontalDirection: Ref<'ltr' | 'rtl'>
}

export const VSliderSymbol: InjectionKey<SliderProvide> = Symbol.for('vuetify:v-slider')

export function getOffset (e: MouseEvent | TouchEvent, el: HTMLElement, direction: string) {
  const vertical = direction === 'vertical'
  const rect = el.getBoundingClientRect()
  const touch = 'touches' in e ? e.touches[0] : e
  return vertical
    ? touch.clientY - (rect.top + rect.height / 2)
    : touch.clientX - (rect.left + rect.width / 2)
}

function getPosition (e: MouseEvent | TouchEvent, position: 'clientX' | 'clientY'): number {
  if ('touches' in e && e.touches.length) return e.touches[0][position]
  else if ('changedTouches' in e && e.changedTouches.length) return e.changedTouches[0][position]
  else return (e as MouseEvent)[position]
}

export const makeSliderProps = propsFactory({
  disabled: Boolean,
  error: Boolean,
  readonly: Boolean,
  max: {
    type: [Number, String],
    default: 100,
  },
  min: {
    type: [Number, String],
    default: 0,
  },
  step: {
    type: [Number, String],
    default: 0,
  },
  thumbColor: String,
  thumbLabel: {
    type: [Boolean, String] as PropType<boolean | 'always' | undefined>,
    default: undefined,
    validator: (v: any) => typeof v === 'boolean' || v === 'always',
  },
  thumbSize: {
    type: [Number, String],
    default: 20,
  },
  showTicks: {
    type: [Boolean, String] as PropType<boolean | 'always'>,
    default: false,
    validator: (v: any) => typeof v === 'boolean' || v === 'always',
  },
  ticks: {
    type: [Array, Object] as PropType<number[] | Record<number, string>>,
  },
  tickSize: {
    type: [Number, String],
    default: 2,
  },
  color: String,
  trackColor: String,
  trackFillColor: String,
  trackSize: {
    type: [Number, String],
    default: 4,
  },
  direction: {
    type: String as PropType<'horizontal' | 'vertical'>,
    default: 'horizontal',
    validator: (v: any) => ['vertical', 'horizontal'].includes(v),
  },
  reverse: Boolean,

  ...makeRoundedProps(),
  ...makeElevationProps({
    elevation: 2,
  }),
}, 'slider')

type SliderProps = ExtractPropTypes<ReturnType<typeof makeSliderProps>>

export const useSlider = ({
  props,
  handleSliderMouseUp,
  handleMouseMove,
  getActiveThumb,
}: {
  props: SliderProps
  handleSliderMouseUp: (v: number) => void
  handleMouseMove: (v: number) => void
  getActiveThumb: (e: MouseEvent | TouchEvent) => HTMLElement
}) => {
  const { isRtl } = useRtl()
  const isReversed = toRef(props, 'reverse')
  const horizontalDirection = computed(() => {
    let hd: 'ltr' | 'rtl' = isRtl.value ? 'rtl' : 'ltr'

    if (props.reverse) {
      hd = hd === 'rtl' ? 'ltr' : 'rtl'
    }

    return hd
  })
  const min = computed(() => parseFloat(props.min))
  const max = computed(() => parseFloat(props.max))
  const step = computed(() => +props.step > 0 ? parseFloat(props.step) : 0)
  const decimals = computed(() => Math.max(getDecimals(step.value), getDecimals(min.value)))

  const thumbSize = computed(() => parseInt(props.thumbSize, 10))
  const tickSize = computed(() => parseInt(props.tickSize, 10))
  const trackSize = computed(() => parseInt(props.trackSize, 10))
  const numTicks = computed(() => (max.value - min.value) / step.value)
  const disabled = toRef(props, 'disabled')
  const vertical = computed(() => props.direction === 'vertical')

  const thumbColor = computed(() => props.error || props.disabled ? undefined : props.thumbColor ?? props.color)
  const trackColor = computed(() => props.error || props.disabled ? undefined : props.trackColor ?? props.color)
  const trackFillColor = computed(() => props.error || props.disabled ? undefined : props.trackFillColor ?? props.color)

  const mousePressed = ref(false)

  const startOffset = ref(0)
  const trackContainerRef = ref<VSliderTrack | undefined>()
  const activeThumbRef = ref<HTMLElement | undefined>()

  function roundValue (value: number) {
    if (step.value <= 0) return value

    const clamped = clamp(value, min.value, max.value)
    const offset = min.value % step.value
    const newValue = Math.round((clamped - offset) / step.value) * step.value + offset

    return parseFloat(Math.min(newValue, max.value).toFixed(decimals.value))
  }

  function parseMouseMove (e: MouseEvent | TouchEvent): number {
    const vertical = props.direction === 'vertical'
    const start = vertical ? 'top' : 'left'
    const length = vertical ? 'height' : 'width'
    const position = vertical ? 'clientY' : 'clientX'

    const {
      [start]: trackStart,
      [length]: trackLength,
    } = trackContainerRef.value?.$el.getBoundingClientRect()
    const clickOffset = getPosition(e, position)

    // It is possible for left to be NaN, force to number
    let clickPos = Math.min(Math.max((clickOffset - trackStart - startOffset.value) / trackLength, 0), 1) || 0

    if (vertical || horizontalDirection.value === 'rtl') clickPos = 1 - clickPos

    return roundValue(min.value + clickPos * (max.value - min.value))
  }

  let thumbMoved = false

  const handleStop = (e: MouseEvent | TouchEvent) => {
    if (!thumbMoved) {
      startOffset.value = 0
      handleSliderMouseUp(parseMouseMove(e))
    }

    mousePressed.value = false
    thumbMoved = false
    startOffset.value = 0
  }

  const handleStart = (e: MouseEvent | TouchEvent) => {
    activeThumbRef.value = getActiveThumb(e)

    if (!activeThumbRef.value) return

    activeThumbRef.value.focus()
    mousePressed.value = true

    if (activeThumbRef.value.contains(e.target as Node)) {
      thumbMoved = true
      startOffset.value = getOffset(e, activeThumbRef.value, props.direction)
    } else {
      startOffset.value = 0
      handleMouseMove(parseMouseMove(e))
    }
  }

  const moveListenerOptions = { passive: true, capture: true }

  function onMouseMove (e: MouseEvent | TouchEvent) {
    thumbMoved = true
    handleMouseMove(parseMouseMove(e))
  }

  function onSliderMouseUp (e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()

    handleStop(e)

    window.removeEventListener('mousemove', onMouseMove, moveListenerOptions)
    window.removeEventListener('mouseup', onSliderMouseUp)
  }

  function onSliderTouchend (e: TouchEvent) {
    handleStop(e)

    window.removeEventListener('touchmove', onMouseMove, moveListenerOptions)
    e.target?.removeEventListener('touchend', onSliderTouchend as EventListener)
  }

  function onSliderTouchstart (e: TouchEvent) {
    handleStart(e)

    window.addEventListener('touchmove', onMouseMove, moveListenerOptions)
    e.target?.addEventListener('touchend', onSliderTouchend as EventListener, { passive: false })
  }

  function onSliderMousedown (e: MouseEvent) {
    e.preventDefault()

    handleStart(e)

    window.addEventListener('mousemove', onMouseMove, moveListenerOptions)
    window.addEventListener('mouseup', onSliderMouseUp, { passive: false })
  }

  const position = (val: number) => {
    const percentage = (val - min.value) / (max.value - min.value) * 100
    return clamp(isNaN(percentage) ? 0 : percentage, 0, 100)
  }

  const showTicks = toRef(props, 'showTicks')
  const parsedTicks = computed<Tick[]>(() => {
    if (!showTicks.value) return []

    if (!props.ticks) {
      return numTicks.value !== Infinity ? createRange(numTicks.value + 1).map(t => {
        const value = min.value + (t * step.value)
        return {
          value,
          position: position(value),
        }
      }) : []
    }
    if (Array.isArray(props.ticks)) return props.ticks.map(t => ({ value: t, position: position(t), label: t.toString() }))
    return Object.keys(props.ticks).map(key => ({
      value: parseFloat(key),
      position: position(parseFloat(key)),
      label: (props.ticks as Record<string, string>)[key],
    }))
  })

  const hasLabels = computed(() => parsedTicks.value.some(({ label }) => !!label))

  const data: SliderProvide = {
    activeThumbRef,
    color: toRef(props, 'color'),
    decimals,
    disabled,
    direction: toRef(props, 'direction'),
    elevation: toRef(props, 'elevation'),
    hasLabels,
    horizontalDirection,
    isReversed,
    min,
    max,
    mousePressed,
    numTicks,
    onSliderMousedown,
    onSliderTouchstart,
    parsedTicks,
    parseMouseMove,
    position,
    readonly: toRef(props, 'readonly'),
    rounded: toRef(props, 'rounded'),
    roundValue,
    showTicks,
    startOffset,
    step,
    thumbSize,
    thumbColor,
    thumbLabel: toRef(props, 'thumbLabel'),
    ticks: toRef(props, 'ticks'),
    tickSize,
    trackColor,
    trackContainerRef,
    trackFillColor,
    trackSize,
    vertical,
  }

  provide(VSliderSymbol, data)

  return data
}
