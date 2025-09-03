import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();

const COOKIE_NAME = 'unbind_token';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const signJwt = (payload: object) => {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL_SECONDS });
};

const verifyJwt = (token: string) => {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    return jwt.verify(token, secret) as { userId: string };
};

router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body as { username: string; email: string; password: string };
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email: email.toLowerCase(), passwordHash });

        const token = signJwt({ userId: user.id });
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: TOKEN_TTL_SECONDS * 1000
        });

        return res.json({ id: user.id, username: user.username, email: user.email, picture: user.picture });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body as { email: string; password: string };
        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email or password' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = signJwt({ userId: user.id });
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: TOKEN_TTL_SECONDS * 1000
        });

        return res.json({ id: user.id, username: user.username, email: user.email, picture: user.picture });
    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    return res.json({ ok: true });
});

router.get('/me', async (req, res) => {
    try {
        const token = req.cookies?.[COOKIE_NAME];
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const { userId } = verifyJwt(token);
        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        return res.json({ id: user.id, username: user.username, email: user.email, picture: user.picture });
    } catch {
        return res.status(401).json({ error: 'Not authenticated' });
    }
});

export default router;


