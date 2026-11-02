// AI summary: the studio sends a work's title, process and tags; we ask Claude
// (Anthropic's API, through the official SDK) for a short summary and send the
// draft back. Axel edits and approves it in the studio; only approved text is published.
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk').default;
const { requireLogin } = require('./auth');

const router = express.Router();
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

// The instructions Claude follows every time (the "system prompt")
const SYSTEM_PROMPT = `You write the summary shown at the top of a portfolio post by Axel af Ugglas, an AI video artist.

Write:
1. A summary of the work's title and process in English, 5 to 8 sentences at most.
   - Third person, using his name: "Axel ...".
   - Written for a potential employer, from the perspective of an artist: what he set out to make, the creative choices, how he solved problems.
   - Use only facts from the material below. Do not invent tools, results, clients or numbers.
2. Then, on its own line: "Tools: " followed by every tool used, comma-separated.
3. Then, on its own line: "Skills: " followed by the skills shown, comma-separated.

Plain text only: no headings, no markdown, no bullet points.`;

// Turns the process blocks into plain text Claude can read
function processAsText(process) {
  return (Array.isArray(process) ? process : []).map((block) => block.type === 'list'
    ? (block.items || []).map((item) => `- ${item}`).join('\n')
    : block.text
  ).join('\n\n');
}

router.post('/api/summary', requireLogin, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'The AI summary is not set up yet. Add ANTHROPIC_API_KEY to .env.' });
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

  // The client reads ANTHROPIC_API_KEY from the environment; the key never reaches the browser
  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' }, // how hard Claude thinks; medium suits a short summary
      // If the model declines for safety reasons, the API retries on a suitable fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: material }],
    });

    if (response.stop_reason === 'refusal') {
      return res.status(502).json({ error: 'The AI declined to write this summary. Try rewording the process text.' });
    }

    // The answer is a list of content blocks; keep the text ones
    const draft = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    if (!draft) return res.status(502).json({ error: 'The AI sent back an empty answer. Try again.' });

    res.json({ draft, model: response.model });
  } catch (err) {
    // Most specific first, so each problem gets a clear message
    console.error('Summary failed:', err.message);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: 'The Anthropic API key in .env is not valid.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(502).json({ error: 'Too many requests to the AI right now. Wait a minute and try again.' });
    }
    if (err instanceof Anthropic.APIError && err.status) {
      return res.status(502).json({ error: `The AI service said: ${err.message}` });
    }
    res.status(502).json({ error: 'Could not reach the AI service. Try again.' });
  }
});

module.exports = router;
