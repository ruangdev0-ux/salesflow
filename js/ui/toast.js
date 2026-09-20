/**
 * Avisos rápidos ("toasts") no canto da tela: sucesso e erro.
 * O contêiner tem role="status", então leitores de tela anunciam as mensagens.
 */
import { html } from '../utils/html.js';

export function createToaster(container) {
  function show(message, type, duration) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = html`<span>${message}</span>`.toString();
    container.append(toast);
    setTimeout(() => toast.remove(), duration);
  }

  return {
    success: (message) => show(message, 'success', 3500),
    error: (message) => show(message, 'error', 6000),
    info: (message) => show(message, 'info', 4500),
  };
}
