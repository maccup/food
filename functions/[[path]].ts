import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { Env } from '../src/types';
import { authMiddleware } from '../src/middleware/auth';
import login from '../src/routes/login';
import importRoutes from '../src/routes/import';
import day from '../src/routes/day';
import week from '../src/routes/week';
import log from '../src/routes/log';
import supplements from '../src/routes/supplements';
import restrictions from '../src/routes/restrictions';
import calendar from '../src/routes/calendar';
import settingsRoutes from '../src/routes/settings';
import gaps from '../src/routes/gaps';

const app = new Hono<{ Bindings: Env }>();

app.use('*', authMiddleware);

app.route('/', login);
app.route('/', importRoutes);
app.route('/', week);
app.route('/', log);
app.route('/', supplements);
app.route('/', restrictions);
app.route('/', calendar);
app.route('/', settingsRoutes);
app.route('/', gaps);
app.route('/', day); // ostatni, bo lapie '/' i '/day/:date'

export const onRequest = handle(app);
