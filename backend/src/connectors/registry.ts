// Shared connector instances keyed by Source.key, used by the pipeline and
// the price/stock monitor so both look up the same connector for a given
// source without re-instantiating (FixtureConnector keeps in-memory call
// counters that drive its deterministic drift, so identity matters).
import type { SourceConnector } from './base';
import { FixtureConnector } from './fixture';
import {
  KmartConnector,
  BigWConnector,
  TargetConnector,
  AmazonAuConnector,
  CatchConnector,
} from './stubs';

let registry: Record<string, SourceConnector> | null = null;

export function getConnectorRegistry(): Record<string, SourceConnector> {
  if (!registry) {
    const all: SourceConnector[] = [
      new FixtureConnector(),
      new KmartConnector(),
      new BigWConnector(),
      new TargetConnector(),
      new AmazonAuConnector(),
      new CatchConnector(),
    ];
    registry = Object.fromEntries(all.map((c) => [c.key, c]));
  }
  return registry;
}

export function getConnector(key: string): SourceConnector | undefined {
  return getConnectorRegistry()[key];
}

export function getFixtureConnector(): FixtureConnector {
  return getConnectorRegistry()['fixture'] as FixtureConnector;
}
