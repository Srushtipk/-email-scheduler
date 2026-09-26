import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/db';
import jwt from 'jsonwebtoken';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'dummy');
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

router.post('/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) return res.status(400).send('Invalid token');

        const { email, name, picture } = payload;
        
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            user = await prisma.user.create({
                data: { email: email!, name: name!, picture },
            });
        }

        const jwtToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token: jwtToken, user });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(400).send('Authentication failed');
    }
});

router.post('/slack-webhook', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send('Unauthorized');
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        const { webhookUrl } = req.body;
        
        await prisma.user.update({
            where: { id: decoded.userId },
            data: { slackWebhookUrl: webhookUrl }
        });
        
        res.send('Webhook saved');
    } catch (err) {
        res.status(401).send('Unauthorized');
    }
});

export default router;
