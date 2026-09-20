/**
 * Navegação entre telas (SPA — Single Page Application).
 *
 * Em vez de carregar uma página HTML nova a cada clique, o app troca só o
 * conteúdo da área principal. A tela atual é definida pelo "hash" da URL:
 *   #/dashboard, #/clientes, #/produtos, #/vendas
 * Usar hash funciona no GitHub Pages sem configuração de servidor
 * e permite usar os botões Voltar/Avançar do navegador.
 */
import { html } from './utils/html.js';
import { icon } from './ui/icons.js';
import { mountDashboard } from './views/dashboard.js';
import { mountClients } from './views/clients.js';
import { mountProducts } from './views/products.js';
import { mountSales } from './views/sales.js';

export const routes = [
  { path: 'dashboard', label: 'Dashboard', icon: 'dashboard', mount: mountDashboard },
  { path: 'vendas', label: 'Vendas', icon: 'cart', mount: mountSales },
  { path: 'clientes', label: 'Clientes', icon: 'users', mount: mountClients },
  { path: 'produtos', label: 'Produtos', icon: 'box', mount: mountProducts },
];

export function startRouter({ outlet, nav, ctx }) {
  nav.innerHTML = routes
    .map((route) => html`<a class="nav-link" href="#/${route.path}" data-route="${route.path}">${icon(route.icon, 20)}<span>${route.label}</span></a>`)
    .join('');

  function show() {
    const path = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const route = routes.find((r) => r.path === path) ?? routes[0];

    nav.querySelectorAll('.nav-link').forEach((link) => {
      const active = link.dataset.route === route.path;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    document.title = `${route.label} · SalesFlow`;
    // Cada tela recebe um <div> novo. Os "ouvintes de evento" ficam nesse <div>,
    // então somem junto com ele ao trocar de tela (senão se acumulariam no <main>).
    const view = document.createElement('div');
    view.className = 'view';
    outlet.replaceChildren(view);

    try {
      route.mount(view, ctx);
    } catch (error) {
      // Se uma tela falhar ao carregar, o app não "quebra" por inteiro.
      console.error(error);
      view.innerHTML = html`
        <div class="empty-state">
          <p class="empty-title">Não foi possível carregar esta página</p>
          <p class="empty-text">Recarregue a página. Se o problema continuar, os dados do navegador podem estar corrompidos: use "Apagar todos os dados" no Dashboard.</p>
        </div>`.toString();
    }

    // Acessibilidade: leva o foco ao título da nova tela para leitores de tela.
    outlet.querySelector('#page-title')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', show);
  show();
  return { refresh: show };
}
