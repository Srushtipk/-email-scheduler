import { Router } from 'express';
import { prisma } from '../config/db';
import { esClient } from '../config/elasticsearch';
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import jwt from 'jsonwebtoken';

const router = Router();
const emailQueue = new Queue('email-queue', { connection: redisConnection });
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

router.post('/', auth, async (req: any, res: any) => {
    const { subject, body, emails, delayBetweenEmails, hourlyLimit, startTime } = req.body;
    const userId = req.userId;

    try {
        const campaign = await prisma.campaign.create({
            data: {
                subject,
                body,
                delayBetweenEmails: Number(delayBetweenEmails),
                hourlyLimit: Number(hourlyLimit),
                userId
            }
        });

        const jobsData = emails.map((email: string) => ({
            campaignId: campaign.id,
            recipientEmail: email,
            scheduledTime: startTime ? new Date(startTime) : new Date(),
        }));

        await prisma.emailJob.createMany({
            data: jobsData,
            skipDuplicates: true // Idempotency: skip duplicates on (campaignId, recipientEmail)
        });

        const createdJobs = await prisma.emailJob.findMany({
            where: { campaignId: campaign.id }
        });

        let baseDelayMs = 0;
        if (startTime) {
            baseDelayMs = Math.max(new Date(startTime).getTime() - Date.now(), 0);
        }

        let index = 0;
        for (const job of createdJobs) {
            // Index in ES
            try {
                await esClient.index({
                    index: 'emails',
                    id: job.id,
                    document: {
                        campaignId: campaign.id,
                        subject,
                        recipientEmail: job.recipientEmail,
                        scheduledTime: job.scheduledTime,
                        status: job.status,
                        userId
                    }
                });
            } catch (esError) {
                console.error("ES Indexing error:", esError);
            }

            // Stagger the delay for each subsequent email in the campaign
            const staggeredDelayMs = baseDelayMs + (index * Number(delayBetweenEmails) * 1000);

            await emailQueue.add('send-email', {
                emailJobId: job.id,
                campaignId: campaign.id,
                userId,
                recipientEmail: job.recipientEmail,
                subject,
                body,
                delayBetweenEmails: Number(delayBetweenEmails),
                hourlyLimit: Number(hourlyLimit)
            }, {
                delay: staggeredDelayMs,
                jobId: job.id // Enforce idempotency in queue
            });
            index++;
        }

        res.json({ message: 'Campaign created', campaignId: campaign.id });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: String(error), stack: error?.stack });
    }
});

export default router;
