// Start-up: check sign-in, learn what the server can do, then show the classes (or reopen the one in the URL).
async function startApp() {
  await initAI();
  try { CLASSES = await api('GET', '/api/classes'); }
  catch (e) { if (e.code === 'auth_required') return; app.innerHTML = `<div class="fb no" role="status"><p>${esc(e.message)}</p></div>`; return; }
  const m = location.hash.match(/^#\/class\/(\w+)/), c = m && CLASSES.find((x) => x.id === m[1]);
  if (c) enterClass(c); else renderClasses();
}

(async () => {
  try {
    const s = await (await fetch('/api/session')).json();
    AUTH.required = !!s.authRequired;
    if (s.authRequired && !s.authed) return renderLogin();
  } catch (e) { app.innerHTML = '<div class="fb no" role="status"><p>Could not reach the server.</p></div>'; return; }
  startApp();
})();

// The browser's back button from a class returns to the class list.
window.addEventListener('hashchange', () => {
  if (CLASS && !/^#\/class\//.test(location.hash)) leaveClass();
});
