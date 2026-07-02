import { green, red, yellow } from 'colorette'

const COLOR_BY_LABEL: Record<string, (value: string) => string> = {
  OK: green,
  WARNING: yellow,
  CRITICAL: red,
}

export const printMetric = (value: string, label: string): void => {
  const color = COLOR_BY_LABEL[label]
  console.log(color(value))
}
