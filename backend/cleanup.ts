import { prisma } from './src/config/db';
import { esClient } from './src/config/elasticsearch';
import { redisConnection } from './src/config/redis';

async function cleanup() {
    console.log('Cleaning up database, redis, and elasticsearch...');

    // 1. Delete all Email Jobs
    await prisma.emailJob.deleteMany({});
    console.log('✅ Cleared Email Jobs from Postgres');

    // 2. Delete all Campaigns
    await prisma.campaign.deleteMany({});
    console.log('✅ Cleared Campaigns from Postgres');

    // 3. Clear Elasticsearch index
    try {
        await esClient.deleteByQuery({
            index: 'emails',
            query: { match_all: {} }
        });
        console.log('✅ Cleared Elasticsearch index');
    } catch (err: any) {
        if (err.meta?.body?.error?.type === 'index_not_found_exception') {
            console.log('✅ Elasticsearch index was already empty');
        } else {
            console.error('❌ Failed to clear Elasticsearch:', err.message);
        }
    }

    // 4. Flush Redis to clear BullMQ queues and rate limits
    await redisConnection.flushdb();
    console.log('✅ Cleared Redis (Queues & Rate limits)');

    console.log('\n🎉 System is now completely clean and ready for your demo video!');
    process.exit(0);
}

cleanup().catch(console.error);
