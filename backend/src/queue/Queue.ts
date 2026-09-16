// DB-backed job queue. Processed by an in-process worker loop (see worker.ts)
// using setInterval-based polling — this avoids requiring Redis for local
// dev. The public surface is intentionally BullMQ-shaped (enqueue/process)
// so swapping to BullMQ+Redis for horizontal scaling later is a drop-in
// upgrade: replace this class's internals with a BullMQ Queue/Worker pair
// without changing callers.
import type { PrismaClient } from '@prisma/client';

export type QueueHandler = (payload: any) => Promise<void>;

export class Queue {
  private handlers: Map<string, QueueHandler> = new Map();

  constructor(private prisma: PrismaClient) {}

  register(type: string, handler: QueueHandler): void {
    this.handlers.set(type, handler);
  }

  async enqueue(type: string, payload: unknown, jobId?: string): Promise<string> {
    const item = await this.prisma.queueItem.create({
      data: {
        type,
        payload: JSON.stringify(payload ?? {}),
        status: 'PENDING',
        jobId,
      },
    });
    return item.id;
  }

  /** Process a batch of pending queue items. Called by the worker loop. */
  async processPending(limit = 10): Promise<{ processed: number; failed: number }> {
    const items = await this.prisma.queueItem.findMany({
      where: { status: 'PENDING' },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    let processed = 0;
    let failed = 0;

    for (const item of items) {
      const handler = this.handlers.get(item.type);
      await this.prisma.queueItem.update({
        where: { id: item.id },
        data: { status: 'PROCESSING' },
      });
      try {
        if (!handler) {
          throw new Error(`No handler registered for queue item type "${item.type}"`);
        }
        await handler(JSON.parse(item.payload));
        await this.prisma.queueItem.update({
          where: { id: item.id },
          data: { status: 'DONE' },
        });
        processed++;
      } catch (err: any) {
        await this.prisma.queueItem.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
            attempts: { increment: 1 },
            lastError: String(err?.message ?? err),
          },
        });
        failed++;
      }
    }

    return { processed, failed };
  }
}
