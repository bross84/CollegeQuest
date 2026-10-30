// A stand-in for the AI provider and YouTube, for trying the app end to end without real keys.
// Serves OpenAI-style /chat/completions (streaming and not) and a YouTube-style /search, answering by matching the prompt.
// Run: node test/mock-ai.js   (port 3998, or MOCK_PORT), then start the app with
//   GROQ_API_KEY=x GROQ_BASE_URL=http://localhost:3998 YOUTUBE_API_KEY=x YOUTUBE_BASE_URL=http://localhost:3998 node server/index.js
const http = require('http');

const lines = (s, re) => [...String(s).matchAll(re)];
const after = (s, mark) => { const i = s.indexOf(mark); return i < 0 ? '' : s.slice(i + mark.length); };

// "Find every problem": deliberately sloppy, the way a weak model reads PDF text. Each "Question N:" comes back with its
// options left in the text and no format, except blanks tables, which it wrongly calls multiple choice.
function findProblems(p) {
  const text = after(p, '\nText:\n') || p;
  const out = [];
  const qs = text.split(/(?=Question\s*\d+\s*[:.])/i).filter((x) => /^Question\s*\d+/i.test(x));
  qs.forEach((q) => {
    const m = q.match(/^Question\s*(\d+)\s*[:.]\s*([\s\S]*)$/i), body = m[2].replace(/Answers?\s*:[\s\S]*$/i, '').trim();
    if (/_{3,}/.test(body)) out.push({ number: m[1], text: body.split(/[a-d]\)/)[0].trim(), format: 'mc', choices: ['9004', '0.00660', '22000'], answer: '' });
    else out.push({ number: '', text: `Question ${m[1]}:${body}`, format: 'work', choices: [], answer: '' });
  });
  if (!out.length) lines(text, /^\s*(\d+)\.\s+(.{10,})$/gm).forEach((m) => out.push({ number: m[1], text: m[2].trim(), format: 'work', choices: [], answer: m[1] === '1' ? '3' : '' }));
  return { topic: 'Mock topic', problems: out.slice(0, 30) };
}
function numbered(p) { return lines(p, /^(\d+)\.\s+(.*)$/gm).map((m) => ({ n: +m[1], text: m[2] })); }

function answer(p) {
  if (p.includes('Find every problem')) return findProblems(p);
  if (p.includes('name the textbook problems')) return { links: [] };
  if (p.includes('specific topics, rules')) return { topics: ['naming polyatomic ions', 'balancing equations', 'significant figures'] };
  if (p.includes('List the ones that test or use')) return { match: [1, 2] };
  if (p.includes('Pick up to 5')) return { picks: numbered(after(p, 'Problems:')).slice(0, 5).map((x) => ({ n: x.n, wrong: ['12', '7.5', '0.25'], answer: '4' })) };
  if (p.includes('captures the main ideas')) {
    const want = +((p.match(/Choose (\d+) of them/) || [])[1] || 5);
    return { picks: numbered(after(p, 'Problems:')).slice(0, want).map((x) => ({ n: x.n, topic: 'mock topic' })) };
  }
  if (p.includes('Work out the final answer to each')) {
    return { answers: numbered(p).map((x) => { const o = x.text.match(/Options: ([^|]+)/); return { n: x.n, answer: o ? o[1].trim() : '42' }; }) };
  }
  if (p.includes('NEW practice problems')) {
    const k = +((p.match(/Write (\d+) NEW/) || [])[1] || 3), models = numbered(after(p, 'Problems:'));
    const orig = after(p, 'Original problem:\n').split('\n')[0];
    const list = [];
    for (let i = 0; i < k; i++) {
      const m = models.length ? models[i % models.length] : { n: 1, text: orig };
      const parts = (m.text.match(/\(parts: ([^)]*)\)/) || [])[1];
      if (/mc\]/.test(m.text) || /Its options:/.test(p)) list.push({ like: m.n, text: `Mock new question ${i + 1} like ${m.n}: which is right?`, format: 'mc', choices: ['alpha', 'beta', 'gamma', 'delta'], answer: 'beta', steps: ['think'] });
      else if (parts) list.push({ like: m.n, text: `Mock new multi-part question ${i + 1} like ${m.n}.`, format: 'parts', parts: parts.split('|').map((x, j) => `new part ${j + 1}`), answer: '', steps: [] });
      else list.push({ like: m.n, text: `Mock new written question ${i + 1} like ${m.n}.`, format: 'work', choices: [], answer: '7', steps: ['step'] });
    }
    return { problems: list };
  }
  if (p.includes('multiple-choice practice problems for the section')) {
    const k = +((p.match(/Write (\d+) multiple-choice/) || [])[1] || 3);
    return { problems: Array.from({ length: k }, (_, i) => ({ text: `Mock section question ${i + 1}?`, choices: ['one', 'two', 'three', 'four'], answer: 'two', steps: ['count'] })) };
  }
  if (p.includes('writing a study guide')) {
    return {
      sections: [{ heading: 'Mock section A', summary: 'A summary.', video: 'mock video', terms: [{ term: 'mole', def: 'An amount.' }], points: ['A point.'] },
        { heading: 'Mock section B', summary: 'Another summary.', video: 'mock video', terms: [], points: ['Another point.'] }],
      cards: [{ q: 'What is a mole?', a: 'an amount', accept: [], wrong: ['a mass', 'a volume', 'a charge'] }],
    };
  }
  if (p.includes('YouTube search (4 to 7')) return { q: 'mock tutorial search words' };
  if (p.includes('Check the student')) return { verdict: 'error', where: 'line 1', procedure: 'mock rule', search: 'mock rule video', skill: null, note: 'Look again at line 1.' };
  return null;
}

const promptOf = (body) => (body.messages || []).map((m) => (typeof m.content === 'string' ? m.content : (m.content || []).map((c) => c.text || '').join('\n'))).join('\n');

function start(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname.endsWith('/search')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ items: [1, 2, 3].map((i) => ({ id: { videoId: `mockvid${i}` }, snippet: { title: `Mock video ${i}: ${url.searchParams.get('q')}`, channelTitle: 'Mock channel' } })) }));
    }
    if (req.method !== 'POST' || !url.pathname.endsWith('/chat/completions')) { res.writeHead(404); return res.end('{}'); }
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(b); } catch (e) { /* empty */ }
      const j = answer(promptOf(body)), content = j ? JSON.stringify(j) : 'This is the stand-in tutor. Try writing out the first step.';
      if (!body.stream) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ choices: [{ message: { content } }] })); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (let i = 0; i < content.length; i += 40) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: content.slice(i, i + 40) } }] })}\n\n`);
      res.end('data: [DONE]\n\n');
    });
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

if (require.main === module) start(+(process.env.MOCK_PORT || 3998)).then(() => console.log(`mock AI on ${process.env.MOCK_PORT || 3998}`));
module.exports = { start, answer };
