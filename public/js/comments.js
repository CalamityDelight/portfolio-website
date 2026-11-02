// Comments on each work: load them from the server, and post new ones.
import { esc } from './works.js';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function commentHTML(c) {
  return `
    <li class="comment">
      <p class="comment__meta"><span class="comment__name">${esc(c.first_name)}</span>
        <time datetime="${esc(c.created_at)}">${dateFormat.format(new Date(c.created_at))}</time></p>
      <p class="comment__body">${esc(c.body)}</p>
    </li>`;
}

const EMPTY = '<li class="muted comment-list__empty">No comments yet. Be the first.</li>';

async function loadComments(postId, listEl) {
  const res = await fetch(`/api/posts/${postId}/comments`);
  const comments = res.ok ? await res.json() : [];
  listEl.innerHTML = comments.length ? comments.map(commentHTML).join('') : EMPTY;
}

export function initComments(cube) {
  cube.querySelectorAll('.comment-form').forEach((form) => {
    const postId = form.dataset.postId;
    const listEl = form.closest('.comments').querySelector('.comment-list');
    const message = form.querySelector('.form-message');

    loadComments(postId, listEl);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      message.textContent = '';
      message.classList.remove('is-ok');

      // Uses the browser's own checks (required, type="email") before sending
      if (!form.reportValidity()) return;

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Show the new comment straight away, without reloading the page
        listEl.querySelector('.comment-list__empty')?.remove();
        listEl.insertAdjacentHTML('beforeend', commentHTML(data));
        form.reset();
        message.textContent = 'Thanks, your comment is posted.';
        message.classList.add('is-ok');
      } catch (err) {
        message.textContent = err.message || 'Could not post the comment. Try again.';
      } finally {
        button.disabled = false;
      }
    });
  });
}
