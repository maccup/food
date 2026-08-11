import { Hono } from 'hono';
import { Env } from '../types';
import { page, esc } from '../views/ui';
import { NAV_POZA_PASKIEM } from '../views/layout';

/**
 * Ekran „Więcej”.
 *
 * Pasek na telefonie miesci szesc pozycji, a ekranow jest dziewiec. Zamiast
 * sciskac ikony albo chowac je w wysuwanym menu na javascripcie, ostatnia
 * pozycja prowadzi do zwyklej strony z reszta. Na duzym ekranie menu boczne
 * pokazuje wszystko naraz, wiec ten ekran jest tam dodatkowa droga, nie jedyna.
 *
 * Cały wiersz jest jednym <a>, bez opakowania w <li> i bez stylow w atrybutach.
 * Poprzednia wersja wieszala klase `.item-content` na odnosniku, czyli na
 * elemencie inline, przez co wciecie nie obejmowalo tresci i ikony wychodzily
 * poza lewa krawedz ekranu.
 */
const more = new Hono<{ Bindings: Env }>();

more.get('/wiecej', (c) => {
  const content = `
    <nav class="nav-list" aria-label="Pozostałe ekrany">
      ${NAV_POZA_PASKIEM.map((n) => `<a href="${n.href}">
        <span class="nav-icon" aria-hidden="true">${n.icon}</span>
        <span class="nav-text">
          <span class="nav-label">${esc(n.label)}</span>
          ${n.opis ? `<span class="nav-opis">${esc(n.opis)}</span>` : ''}
        </span>
        <span class="nav-chevron" aria-hidden="true">›</span>
      </a>`).join('')}
    </nav>
  `;

  return c.html(page({ title: 'Więcej', tab: 'more', header: 'Więcej', content }));
});

export default more;
