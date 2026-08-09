import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { Env } from '../src/types';
import { authMiddleware } from '../src/middleware/auth';
import login from '../src/routes/login';
import importRoutes from '../src/routes/import';

const app = new Hono<{ Bindings: Env }>();

app.use('*', authMiddleware);

app.route('/', login);
app.route('/', importRoutes);

export const onRequest = handle(app);
