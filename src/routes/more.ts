import { Hono } from 'hono';
import { Env } from '../types';
import { page, esc } from '../views/ui';
import { NAV_POZA_PASKIEM } from '../views/layout';

/**
 * Ekran „Więcej”.
 *
 * Pasek na telefonie ma piec miejsc, a ekranow jest osiem. Zamiast sciskac
 * ikony albo chowac je w wysuwanym menu na javascripcie, piata pozycja prowadzi
 * do zwyklej strony z reszta. Na duzym ekranie menu boczne pokazuje wszystko
 * naraz, wiec ten ekran jest tam tylko dodatkowa droga, nie jedyna.
 */
const more = new Hono<{ Bindings: Env }>();

more.get('/wiecej', (c) => {
  const content = `
    <div class="list media-list" style="margin-top:10px"><ul>
      ${NAV_POZA_PASKIEM.map((n) => `<li>
        <a href="${n.href}" class="item-content" style="text-decoration:none;color:inherit">
          <div class="item-inner" style="display:flex;gap:12px;align-items:center;padding:14px 0;min-height:56px">
            <span style="font-size:22px" aria-hidden="true">${n.icon}</span>
            <span style="flex:1">
              <b style="display:block">${esc(n.label)}</b>
              ${n.opis ? `<span style="font-size:12px;color:var(--muted)">${esc(n.opis)}</span>` : ''}
            </span>
            <span style="color:var(--muted)" aria-hidden="true">›</span>
          </div>
        </a>
      </li>`).join('')}
    </ul></div>
  `;

  return c.html(page({ title: 'Więcej', tab: 'more', header: 'Więcej', content }));
});

export default more;
