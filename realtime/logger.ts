import { setInterval, clearInterval } from "timers";

export type LogLevel = "info" | "warn" | "error" | "debug";

export type LogContext = {
  scope?: string;
};

export type StructuredLogger = {
  info: (event: string, meta?: Record<string, unknown>) => void;
  warn: (event: string, meta?: Record<string, unknown>) => void;
  error: (
    event: string,
    meta?: Record<string, unknown> & { error?: unknown }
  ) => void;
  debug: (event: string, meta?: Record<string, unknown>) => void;
  metric: (event: string, meta?: Record<string, unknown>) => void;
};

export type MetricsSnapshot = {
  toolCalls: number;
  toolFailures: number;
  toolAvgLatencyMs: number | null;
  vad: {
    forwarded: number;
    dropped: number;
    speechFrames: number;
    totalFrames: number;
    speechRatio: number | null;
  };
  cancellations: number;
};

export type MetricsTracker = {
  recordToolResult: (params: {
    name: string;
    ok: boolean;
    durationMs?: number;
  }) => void;
  recordVadSample: (params: {
    speechFrames: number;
    totalFrames: number;
    forwarded: boolean;
  }) => void;
  recordCancellation: (reason: string) => void;
  snapshot: () => MetricsSnapshot;
  startPeriodicLogging: (intervalMs?: number) => () => void;
};

export function createLogger(context: LogContext = {}) {
  const baseLog =
    (level: LogLevel) =>
    (event: string, meta: Record<string, unknown> = {}) => {
      const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...context,
        ...meta,
      };
      if (level === "error") {
        console.error(JSON.stringify(payload));
      } else {
        console.log(JSON.stringify(payload));
      }
    };

  const logger: StructuredLogger = {
    info: baseLog("info"),
    warn: baseLog("warn"),
    error: baseLog("error"),
    debug: baseLog("debug"),
    metric: baseLog("info"),
  };

  const metricsState = {
    toolCalls: 0,
    toolFailures: 0,
    toolLatencyMs: [] as number[],
    vad: {
      forwarded: 0,
      dropped: 0,
      speechFrames: 0,
      totalFrames: 0,
    },
    cancellations: 0,
  };

  const metrics: MetricsTracker = {
    recordToolResult({ name, ok, durationMs }) {
      metricsState.toolCalls += 1;
      if (!ok) {
        metricsState.toolFailures += 1;
      }
      if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
        metricsState.toolLatencyMs.push(durationMs);
      }
      logger.metric("tool.result", {
        name,
        ok,
        durationMs: durationMs ? Math.round(durationMs) : undefined,
      });
    },
    recordVadSample({ speechFrames, totalFrames, forwarded }) {
      metricsState.vad.speechFrames += speechFrames;
      metricsState.vad.totalFrames += totalFrames;
      if (forwarded) {
        metricsState.vad.forwarded += 1;
      } else {
        metricsState.vad.dropped += 1;
      }
      logger.metric("vad.sample", {
        speechFrames,
        totalFrames,
        forwarded,
      });
    },
    recordCancellation(reason: string) {
      metricsState.cancellations += 1;
      logger.metric("session.cancelled", { reason });
    },
    snapshot() {
      const avgLatency =
        metricsState.toolLatencyMs.length > 0
          ? metricsState.toolLatencyMs.reduce((a, b) => a + b, 0) /
            metricsState.toolLatencyMs.length
          : null;
      const speechRatio =
        metricsState.vad.totalFrames > 0
          ? metricsState.vad.speechFrames / metricsState.vad.totalFrames
          : null;

      return {
        toolCalls: metricsState.toolCalls,
        toolFailures: metricsState.toolFailures,
        toolAvgLatencyMs: avgLatency ? Math.round(avgLatency) : null,
        vad: {
          forwarded: metricsState.vad.forwarded,
          dropped: metricsState.vad.dropped,
          speechFrames: metricsState.vad.speechFrames,
          totalFrames: metricsState.vad.totalFrames,
          speechRatio: speechRatio !== null ? Number(speechRatio.toFixed(3)) : null,
        },
        cancellations: metricsState.cancellations,
      };
    },
    startPeriodicLogging(intervalMs = 60000) {
      const timer = setInterval(() => {
        const snapshot = metrics.snapshot();
        logger.metric("metrics.snapshot", snapshot);
      }, intervalMs);

      return () => clearInterval(timer);
    },
  };

  return { logger, metrics };
}
