import { Router } from 'express';
import { esClient } from '../config/elasticsearch';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const auth = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).send('Unauthorized');
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        req.userId = decoded.userId;
        next();
    } catch {
        res.status(401).send('Unauthorized');
    }
};

router.get('/', auth, async (req: any, res: any) => {
    const { q } = req.query;
    try {
        if (!process.env.ELASTICSEARCH_URL) {
            const { prisma } = require('../config/db');
            const jobs = await prisma.emailJob.findMany({
                where: {
                    campaign: { userId: req.userId },
                    ...(q ? {
                        OR: [
                            { recipientEmail: { contains: String(q), mode: 'insensitive' } },
                            { subject: { contains: String(q), mode: 'insensitive' } }
                        ]
                    } : {})
                },
                orderBy: { scheduledTime: 'desc' },
                take: 100,
                include: { campaign: true }
            });
            return res.json(jobs.map((j: any) => ({
                id: j.id,
                jobId: j.jobId,
                campaignId: j.campaignId,
                userId: j.campaign.userId,
                recipientEmail: j.recipientEmail,
                subject: j.subject,
                body: j.body,
                status: j.status,
                scheduledTime: j.scheduledTime
            })));
        }

        const result = await esClient.search({
            index: 'emails',
            query: {
                bool: {
                    must: [
                        { match: { userId: req.userId } }
                    ],
                    ...(q ? {
                        should: [
                            { match: { subject: q } },
                            { match: { recipientEmail: q } }
                        ],
                        minimum_should_match: 1
                    } : {})
                }
            },
            size: 100,
            sort: [
                { scheduledTime: { order: "desc" } }
            ]
        });
        
        const hits = result.hits.hits.map((h: any) => ({
            id: h._id,
            ...h._source
        }));
        
        res.json(hits);
    } catch (error: any) {
        // Handle index not found on first start gracefully
        if (error.meta?.body?.error?.type === 'index_not_found_exception') {
            return res.json([]);
        }
        console.error(error);
        res.status(500).json({ error: String(error), stack: error?.stack });
    }
});

export default router;
