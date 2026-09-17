// Shared MockEbayAdapter singleton for the demo/dev process. Both the
// dry-run API route and the scheduler/job runner must publish to and monitor
// the SAME in-memory mock marketplace, or the price/stock monitor would be
// looking for listings that only ever existed in a throwaway instance.
import { MockEbayAdapter } from './mockEbay';

let shared: MockEbayAdapter | null = null;

export function getSharedMockEbayAdapter(): MockEbayAdapter {
  if (!shared) shared = new MockEbayAdapter();
  return shared;
}
