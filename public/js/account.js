// The discreet footer under the CV: "login" for visitors, "studio" and "sign out" for Axel.

export async function initAccount() {
  const link = document.querySelector('.site-footer .footer-link');
  const res = await fetch('/api/me');
  const { signedIn } = await res.json();
  if (!signedIn) return; // visitors keep the plain "login" link

  link.outerHTML = `
    <span class="site-footer__links">
      <a class="footer-link" href="/studio">studio</a>
      <button type="button" class="footer-link" id="sign-out">sign out</button>
    </span>`;

  document.getElementById('sign-out').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
  });
}
