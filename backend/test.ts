import { prisma } from './src/config/db';
import { esClient } from './src/config/elasticsearch';
import { redisConnection } from './src/config/redis';
import { Queue } from 'bullmq';

async function test() {
    console.log('Testing DB...');
    try {
        await prisma.user.findFirst();
        console.log('DB OK');
    } catch (e) {
        console.error('DB Error', e);
    }

    console.log('Testing ES...');
    try {
        await esClient.info();
        console.log('ES OK');
    } catch (e) {
        console.error('ES Error', e);
    }

    console.log('Testing Redis...');
    try {
        await redisConnection.ping();
        console.log('Redis OK');
    } catch (e) {
        console.error('Redis Error', e);
    }
}
test().then(() => process.exit(0));
