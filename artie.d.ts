interface Thresholds {
    warning?: number;
    critical?: number;
    levels?: string[];
}
interface MetricConfig extends Thresholds {
    enabled?: boolean;
}
interface ArtieConfig {
    includes?: string[];
    excludes?: string[];
    options: {
        defaultThresholds: Thresholds;
        metrics: Record<string, MetricConfig>;
    };
}

declare function readConfig(): ArtieConfig;
declare function getEnableMetrics(config: ArtieConfig): string[];
declare function initConfig(): void;
declare function getMetricConfig(metricName: string): MetricConfig;
declare function runLens(directory?: string): Promise<void>;
declare function showHelp(): void;

export { getEnableMetrics, getMetricConfig, initConfig, readConfig, runLens, showHelp };
