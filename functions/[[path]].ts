import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { Env } from '../src/types';
import { authMiddleware } from '../src/middleware/auth';
import login from '../src/routes/login';
import importRoutes from '../src/routes/import';
import day from '../src/routes/day';
import stats from '../src/routes/stats';
import log from '../src/routes/log';
import shopping from '../src/routes/shopping';
import more from '../src/routes/more';
import supplements from '../src/routes/supplements';
import restrictions from '../src/routes/restrictions';
import calendar from '../src/routes/calendar';
import settingsRoutes from '../src/routes/settings';
import gaps from '../src/routes/gaps';
import mealRoutes from '../src/routes/meal';

const app = new Hono<{ Bindings: Env }>();

app.use('*', authMiddleware);

app.route('/', login);
app.route('/', importRoutes);
app.route('/', stats);
app.route('/', log);
app.route('/', shopping);
app.route('/', more);
app.route('/', supplements);
app.route('/', restrictions);
app.route('/', calendar);
app.route('/', settingsRoutes);
app.route('/', gaps);
app.route('/', mealRoutes);
app.route('/', day); // ostatni, bo lapie '/' i '/day/:date'

export const onRequest = handle(app);
