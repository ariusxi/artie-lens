import { MetricResult } from '../types/config.interface'

// A declaration name is not unique across a project. Include its normalized path so baselines
// created on Windows can also be consumed on POSIX runners (and vice versa).
export const metricResultKey = (item: MetricResult): string =>
  JSON.stringify([(item.file ?? '').replace(/\\/g, '/'), item.value])
