// AI summary: the studio sends a work's title, process and tags; we ask a
// language model on OpenRouter for a short summary and send the draft back.
// Axel edits and approves it in the studio; only approved text is published.
const express = require('express');
const { requireLogin } = require('./auth');

const router = express.Router();
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5.5';

// The instructions the model follows every time (the "system prompt")
const SYSTEM_PROMPT = `You write the summary shown at the top of a portfolio post by Axel af Ugglas, an AI video artist.

Write:
1. A summary of the work's title and process in English, 5 to 8 sentences at most.
   - Third person, using his name: "Axel ...".
   - Written for a potential employer, from the perspective of an artist: what he set out to make, the creative choices, how he solved problems.
   - Use only facts from the material below. Do not invent tools, results, clients or numbers.
2. Then, on its own line: "Tools: " followed by every tool used, comma-separated.
3. Then, on its own line: "Skills: " followed by the skills shown, comma-separated.

Plain text only: no headings, no markdown, no bullet points.`;

// Turns the process blocks into plain text the model can read
function processAsText(process) {
  return (Array.isArray(process) ? process : []).map((block) => block.type === 'list'
    ? (block.items || []).map((item) => `- ${item}`).join('\n')
    : block.text
  ).join('\n\n');
}

router.post('/api/summary', requireLogin, async (req, res) => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key.startsWith('sk-or-replace')) {
    return res.status(503).json({ error: 'OpenRouter is not set up yet. Add OPENROUTER_API_KEY to .env.' });
  }

  const { title, process: blocks, tags } = req.body;
  const processText = processAsText(blocks);
  if (!title || !processText.trim()) {
    return res.status(400).json({ error: 'Add a title and some process text first.' });
  }

  const material = `Title: ${title}
Tags (tools, skills, roles): ${(tags || []).join(', ') || 'none'}

Process:
${processText}`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,  // the secret key stays on the server
        'Content-Type': 'application/json',
        'X-Title': 'Axel af Ugglas portfolio', // shows up in OpenRouter's usage list
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: material },
        ],
        max_tokens: 600,
        temperature: 0.5, // a little variety, but stays close to the facts
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenRouter error:', data);
      return res.status(502).json({ error: `The AI service said: ${data.error?.message || response.status}` });
    }

    const draft = data.choices?.[0]?.message?.content?.trim();
    if (!draft) return res.status(502).json({ error: 'The AI service sent back an empty answer. Try again.' });
    res.json({ draft, model: MODEL });
  } catch (err) {
    console.error('Summary failed:', err.message);
    res.status(502).json({ error: 'Could not reach the AI service. Try again.' });
  }
});

module.exports = router;
