import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { Env } from '../src/types';
import { authMiddleware } from '../src/middleware/auth';
import login from '../src/routes/login';

const app = new Hono<{ Bindings: Env }>();

app.use('*', authMiddleware);

app.route('/', login);

export const onRequest = handle(app);
