import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import searchRoutes from './routes/search';
import { prisma } from './config/db';
import { redisConnection } from './config/redis';
import { esClient } from './config/elasticsearch';
import { Queue } from 'bullmq';
import jwt from 'jsonwebtoken';
// Initialize worker
import './workers/emailWorker';

dotenv.config();

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const emailQueue = new Queue('email-queue', { connection: redisConnection });

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/search', searchRoutes);

// Health check — shows all service statuses
app.get('/api/health', async (_req, res) => {
    const checks: Record<string, string> = {};
    
    try { await prisma.$queryRaw`SELECT 1`; checks.postgres = 'healthy'; }
    catch { checks.postgres = 'unhealthy'; }
    
    try { await redisConnection.ping(); checks.redis = 'healthy'; }
    catch { checks.redis = 'unhealthy'; }
    
    try { await esClient.ping(); checks.elasticsearch = 'healthy'; }
    catch { checks.elasticsearch = 'unhealthy'; }

    const allHealthy = Object.values(checks).every(v => v === 'healthy');
    res.status(allHealthy ? 200 : 503).json({ status: allHealthy ? 'ok' : 'degraded', services: checks, uptime: process.uptime() });
});

// Retry a failed email job
app.post('/api/retry/:jobId', async (req: any, res: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).send('Unauthorized');
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        const job = await prisma.emailJob.findUnique({ where: { id: req.params.jobId }, include: { campaign: true } });
        
        if (!job || job.campaign.userId !== decoded.userId) return res.status(404).send('Not found');
        if (job.status !== 'FAILED') return res.status(400).send('Only failed jobs can be retried');
        
        await prisma.emailJob.update({ where: { id: job.id }, data: { status: 'PENDING' } });
        
        // Update ES
        try {
            await esClient.update({ index: 'emails', id: job.id, doc: { status: 'PENDING' } });
        } catch {}

        await emailQueue.add('send-email', {
            emailJobId: job.id,
            campaignId: job.campaignId,
            userId: decoded.userId,
            recipientEmail: job.recipientEmail,
            subject: job.campaign.subject,
            body: job.campaign.body,
            delayBetweenEmails: job.campaign.delayBetweenEmails,
            hourlyLimit: job.campaign.hourlyLimit
        }, { jobId: `retry-${job.id}-${Date.now()}` });
        
        res.json({ message: 'Retrying' });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// Email Open Tracking Endpoint (Invisible 1x1 Pixel)
app.get('/api/track/:jobId', async (req, res) => {
    try {
        const jobId = req.params.jobId;
        
        // Update Postgres
        await prisma.emailJob.update({
            where: { id: jobId },
            data: { status: 'OPENED' }
        });
        
        // Update Elasticsearch
        try {
            await esClient.update({
                index: 'emails',
                id: jobId,
                doc: { status: 'OPENED' }
            });
        } catch {}

    } catch (err) {
        // Ignore errors to not break the image load
    }
    
    // Return a 1x1 transparent GIF
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
    });
    res.end(pixel);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});
