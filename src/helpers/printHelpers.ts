import { green, red, yellow } from 'colorette'

export function printMetric(value: string, label: string): void {
  const colorFn = {
    'OK': green,
    'WARNING': yellow,
    'CRITICAL': red
  }

  const color = colorFn[label]

  console.log(color(value))
}