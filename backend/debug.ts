import axios from 'axios';
import jwt from 'jsonwebtoken';

import { prisma } from './src/config/db';

async function run() {
    const user = await prisma.user.findFirst();
    const token = jwt.sign({ userId: user?.id || 'dummy' }, 'super-secret-key');
    try {
        console.log('Fetching search...');
        const res = await axios.get('http://127.0.0.1:3000/api/search', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Search OK:', res.data);
    } catch (e: any) {
        console.error('Search 500:', e.response?.data || e.message);
    }

    try {
        console.log('Creating campaign...');
        const res2 = await axios.post('http://127.0.0.1:3000/api/campaigns', {
            subject: 'Test',
            body: 'Test body',
            emails: ['test@example.com'],
            delayBetweenEmails: 0,
            hourlyLimit: 10
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Campaign OK:', res2.data);
    } catch (e: any) {
        console.error('Campaign 500:', e.response?.data || e.message);
    }
}
run();
