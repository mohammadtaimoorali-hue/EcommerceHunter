import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getPrisma } from './lib/prisma';
import { ensureDefaultSettings } from './lib/settings';
import { pipelineRoutes } from './routes/pipeline';
import { jobsRoutes } from './routes/jobs';
import { settingsRoutes } from './routes/settings';
import { productsRoutes } from './routes/products';
import { listingDraftsRoutes, listingsRoutes } from './routes/listings';
import { sourcesRoutes } from './routes/sources';
import { overviewRoutes } from './routes/overview';

const app = express();
const prisma = getPrisma();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/pipeline', pipelineRoutes(prisma));
app.use('/api/jobs', jobsRoutes(prisma));
app.use('/api/settings', settingsRoutes(prisma));
app.use('/api/products', productsRoutes(prisma));
app.use('/api/listing-drafts', listingDraftsRoutes(prisma));
app.use('/api/listings', listingsRoutes(prisma));
app.use('/api/sources', sourcesRoutes(prisma));
app.use('/api/overview', overviewRoutes(prisma));

async function main() {
  await ensureDefaultSettings(prisma);
  app.listen(PORT, () => {
    console.log(`ecom-hunter backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal error starting server', err);
  process.exit(1);
});
