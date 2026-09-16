export function registerPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error: unknown) => {
      console.error('The offline app shell could not be registered.', error);
    });
  });
}
