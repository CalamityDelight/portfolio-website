// The discreet footer: "login" for visitors, "studio" and "sign out" for Axel.

export async function initAccount() {
  const footer = document.querySelector('.site-footer');
  const res = await fetch('/api/me');
  const { signedIn } = await res.json();
  if (!signedIn) return; // visitors keep the plain "login" link

  footer.innerHTML = `
    <a class="footer-link" href="/studio">studio</a>
    <button type="button" class="footer-link" id="sign-out">sign out</button>`;

  document.getElementById('sign-out').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
  });
}
