import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { prisma } from '../config/db';
import { transporter } from '../config/smtp';
import { esClient } from '../config/elasticsearch';
import axios from 'axios';

const QUEUE_NAME = 'email-queue';

export const emailWorker = new Worker(QUEUE_NAME, async (job: Job) => {
    const { emailJobId, campaignId, userId, recipientEmail, subject, body, delayBetweenEmails, hourlyLimit } = job.data;

    // 1. Check Rate Limit (Counter per user per hour)
    const currentHour = new Date().toISOString().slice(0, 13); // e.g., "2023-10-25T14"
    const rateLimitKey = `rate_limit:${userId}:${currentHour}`;

    const currentCountStr = await redisConnection.get(rateLimitKey);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;

    if (currentCount >= hourlyLimit) {
        // Hourly limit reached. 
        // a) Reschedule to the start of the next hour
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0, 0, 0); // Start of next hour
        
        const delayMs = nextHour.getTime() - Date.now();
        await job.moveToDelayed(Date.now() + delayMs, job.token as string);

        // Update status in DB to delayed
        await prisma.emailJob.update({
            where: { id: emailJobId },
            data: { status: 'DELAYED' }
        });

        // b) Trigger Slack notification
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.slackWebhookUrl) {
            try {
                await axios.post(user.slackWebhookUrl, {
                    text: `Rate limit hit for campaign ${campaignId}. Emails delayed to the next hour.`
                });
            } catch (err) {
                console.error('Failed to send Slack notification', err);
            }
        }

        // Must throw an error or return a specific value so BullMQ knows it was delayed
        throw new Error('Rate limit exceeded, moved to delayed.');
    }

    // 2. Increment rate limit counter
    await redisConnection.incr(rateLimitKey);
    await redisConnection.expire(rateLimitKey, 3600); // 1 hour expiration

    // 3. Wait for delayBetweenEmails
    if (delayBetweenEmails > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenEmails * 1000));
    }

    // 4. Send via Ethereal SMTP
    try {
        await transporter.sendMail({
            from: '"ReachInbox" <no-reply@reachinbox.ai>',
            to: recipientEmail,
            subject: subject,
            text: body,
            html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        });

        // 5. Update Postgres to SENT
        await prisma.emailJob.update({
            where: { id: emailJobId },
            data: { status: 'SENT' }
        });

        // 6. Update Elasticsearch to SENT
        try {
            await esClient.update({
                index: 'emails',
                id: emailJobId,
                doc: {
                    status: 'SENT'
                }
            });
        } catch (esErr) {
            console.error('ES update error:', esErr);
        }

    } catch (error) {
        // Mark as failed
        await prisma.emailJob.update({
            where: { id: emailJobId },
            data: { status: 'FAILED' }
        });
        
        try {
            await esClient.update({
                index: 'emails',
                id: emailJobId,
                doc: { status: 'FAILED' }
            });
        } catch (esErr) {
            console.error('ES update error:', esErr);
        }
        throw error;
    }

}, {
    connection: redisConnection,
    concurrency: 5 // Configurable concurrency
});

emailWorker.on('completed', (job) => {
    console.log(`${job.id} has completed!`);
});

emailWorker.on('failed', (job, err) => {
    console.log(`${job?.id} has failed with ${err.message}`);
});
