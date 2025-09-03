import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import authRouter from './routes/auth';

dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true
}));

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://sachinsamprit_db_user:6mSLIwtlvdkXRP2M@auth.ofkrkli.mongodb.net/?retryWrites=true&w=majority&appName=auth';
mongoose
    .connect(mongoUri)
    .then(() => {
        // eslint-disable-next-line no-console
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
});


