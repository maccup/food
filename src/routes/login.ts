import { Hono } from 'hono';
import { Env } from '../types';
import { loginPage } from '../views/login';
import { createSession, destroySession, isAuthenticated } from '../middleware/auth';

const login = new Hono<{ Bindings: Env }>();

login.get('/login', async (c) => {
  if (await isAuthenticated(c)) {
    return c.redirect('/');
  }
  return c.html(loginPage());
});

login.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const password = body.password as string;

  if (password === c.env.PASSWORD) {
    await createSession(c);
    return c.redirect('/');
  }

  return c.html(loginPage('Błędne hasło'), 401);
});

login.get('/logout', (c) => {
  destroySession(c);
  return c.redirect('/login');
});

export default login;
