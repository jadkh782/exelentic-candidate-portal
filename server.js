const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieSession({
  name: 'cenissess',
  keys: [process.env.SESSION_SECRET || 'xK9_legacy_cenis_2004'],
  maxAge: 24 * 60 * 60 * 1000
}));

const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'candidates.json'), 'utf8'));

// CVs are generated on demand and streamed to the response (no disk writes),
// so this runs fine on read-only serverless filesystems like Vercel.
function streamCV(candidate, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="CV_${candidate.name.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);
  doc.fontSize(22).text('CURRICULUM VITAE', { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(16).text(candidate.name, { align: 'center' });
  doc.moveDown();
  doc.fontSize(11);
  doc.text(`Email: ${candidate.email}`);
  doc.text(`Phone: ${candidate.phone}`);
  doc.text(`City: ${candidate.city}`);
  doc.moveDown();
  doc.fontSize(13).text('Professional Summary', { underline: true });
  doc.fontSize(11).text(`Experienced professional with ${candidate.experience_years} years in the field of ${candidate.position_applied}. Seeking new opportunities to contribute skills and expertise.`);
  doc.moveDown();
  doc.fontSize(13).text('Experience', { underline: true });
  doc.fontSize(11).text(`${candidate.experience_years} years — ${candidate.position_applied}`);
  doc.text(`Based in ${candidate.city}, Germany`);
  doc.moveDown();
  doc.fontSize(13).text('Education', { underline: true });
  doc.fontSize(11).text('University of Applied Sciences — Relevant Degree');
  doc.moveDown();
  doc.fontSize(8).fillColor('#999').text(`Document ID: ${candidate.id} | Generated for recruitment purposes only`, { align: 'center' });
  doc.end();
}

// === CHAOS UTILITY FUNCTIONS ===

function rHex(len) {
  return crypto.randomBytes(len).toString('hex').substring(0, len);
}

function chaosId() {
  const prefixes = ['el', 'nd', 'cmp', 'x', 'ctrl', 'obj', 'ref', 'itm', 'blk', 'wr'];
  const separators = ['_', '-', '__', '--', '___', '_x_', '-z-'];
  return prefixes[Math.floor(Math.random() * prefixes.length)] +
    separators[Math.floor(Math.random() * separators.length)] +
    rHex(6) +
    separators[Math.floor(Math.random() * separators.length)] +
    rHex(4);
}

function chaosClass() {
  const parts = ['data', 'ui', 'core', 'legacy', 'tbl', 'frm', 'btn', 'lnk', 'wrp', 'ctn'];
  const modifiers = ['actv', 'hdn', 'vis', 'pri', 'sec', 'alt', 'dflt', 'ovr'];
  return parts[Math.floor(Math.random() * parts.length)] +
    '__' + parts[Math.floor(Math.random() * parts.length)] +
    '--' + modifiers[Math.floor(Math.random() * modifiers.length)] +
    '___' + rHex(3);
}

function chaosDataAttrs() {
  const attrs = [
    `data-xref="${rHex(8)}"`,
    `data-bind-ctx="obj_${rHex(4)}"`,
    `data-legacy-hook="cmp_${rHex(5)}"`,
    `data-render-id="${rHex(10)}"`,
    `data-track-node="n_${rHex(3)}"`,
    `data-sap-ui="${rHex(7)}"`,
    `data-form-idx="${Math.floor(Math.random() * 999)}"`,
    `data-testid="wrong_${rHex(4)}"`,
  ];
  const count = 2 + Math.floor(Math.random() * 4);
  const shuffled = attrs.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).join(' ');
}

function wrapChaos(innerHtml, minDepth, maxDepth) {
  const depth = minDepth + Math.floor(Math.random() * (maxDepth - minDepth + 1));
  let result = innerHtml;
  for (let i = 0; i < depth; i++) {
    const tag = Math.random() > 0.7 ? 'span' : 'div';
    result = `<${tag} class="${chaosClass()}" id="${chaosId()}" ${chaosDataAttrs()}>${result}</${tag}>`;
  }
  return result;
}

function ghostElement(type) {
  const ghosts = {
    input: `<div style="position:absolute;left:-9999px;opacity:0;pointer-events:none"><input type="text" class="${chaosClass()}" id="${chaosId()}" tabindex="-1" aria-hidden="true" ${chaosDataAttrs()}></div>`,
    button: `<div style="height:0;overflow:hidden;visibility:hidden"><button class="${chaosClass()}" id="${chaosId()}" tabindex="-1" disabled ${chaosDataAttrs()}>Submit</button></div>`,
    link: `<span style="display:none"><a href="#" class="${chaosClass()}" id="${chaosId()}" tabindex="-1" ${chaosDataAttrs()}>Download</a></span>`,
    row: `<tr style="display:none" class="${chaosClass()}" id="${chaosId()}" ${chaosDataAttrs()}><td></td><td></td><td></td><td></td><td></td></tr>`,
  };
  return ghosts[type] || '';
}

function legacyCruft() {
  const cruft = [
    `<font color="#000000" face="Arial" size="1">&nbsp;</font>`,
    `<center><span style="font-size:0">&nbsp;</span></center>`,
    `<marquee style="display:none" scrollamount="0">&nbsp;</marquee>`,
    `<!-- TODO: fix this later (2003-04-12) -->`,
    `<!-- LEGACY: do not remove - breaks IE6 layout -->`,
    `<div class="${chaosClass()}" style="height:0;overflow:hidden">&zwnj;</div>`,
  ];
  return cruft[Math.floor(Math.random() * cruft.length)];
}

// Bottom-right easter egg, present on every page
function easterEgg() {
  return `<div id="${chaosId()}" class="${chaosClass()}" style="position:fixed;right:6px;bottom:4px;z-index:99999;font-family:'Courier New',monospace;font-size:10px;color:#b3a894;opacity:0.7;pointer-events:none;user-select:none;letter-spacing:0.2px;">Coded by a sleep deprived nicotine/caffiene addict at 2am - enjoy :)</div>`;
}

function newCandidateId() {
  let id;
  do { id = 'CND-' + String(Math.floor(1000 + Math.random() * 9000)); }
  while (candidates.some(c => c.id === id));
  return id;
}

app.use((req, res, next) => {
  res.locals.chaosId = chaosId;
  res.locals.chaosClass = chaosClass;
  res.locals.chaosDataAttrs = chaosDataAttrs;
  res.locals.wrapChaos = wrapChaos;
  res.locals.ghostElement = ghostElement;
  res.locals.legacyCruft = legacyCruft;
  res.locals.easterEgg = easterEgg;
  res.locals.rHex = rHex;
  res.locals.currentPath = req.path;
  next();
});

function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/');
}

app.get('/', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.loggedIn = true;
    res.redirect('/overview');
  } else {
    res.render('login', { error: 'Invalid credentials. Please try again.' });
  }
});

app.get('/overview', requireLogin, (req, res) => {
  const byStatus = {};
  candidates.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
  const byPosition = {};
  candidates.forEach(c => { byPosition[c.position_applied] = (byPosition[c.position_applied] || 0) + 1; });
  res.render('overview', { candidates, byStatus, byPosition });
});

app.get('/dashboard', requireLogin, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  let list = candidates;
  if (q) {
    list = candidates.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.position_applied.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q));
  }
  res.render('dashboard', { candidates: list, query: req.query.q || '' });
});

app.get('/candidates/new', requireLogin, (req, res) => {
  res.render('new-candidate', { error: null, values: {} });
});

app.post('/candidates/new', requireLogin, (req, res) => {
  const { name, email, phone, city, position_applied, experience_years } = req.body;
  if (!name || !name.trim()) {
    return res.render('new-candidate', { error: 'Candidate name is required.', values: req.body });
  }
  const candidate = {
    id: newCandidateId(),
    name: name.trim(),
    email: (email || '').trim(),
    phone: (phone || '').trim(),
    status: 'New',
    position_applied: (position_applied || 'Unspecified').trim(),
    city: (city || '').trim(),
    experience_years: parseInt(experience_years, 10) || 0
  };
  candidates.push(candidate);
  res.redirect('/candidate/' + candidate.id);
});

app.get('/archive', requireLogin, (req, res) => {
  const archived = candidates.filter(c => c.status === 'Rejected');
  res.render('archive', { candidates: archived });
});

app.get('/reports', requireLogin, (req, res) => {
  const byStatus = {};
  candidates.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
  const byCity = {};
  candidates.forEach(c => { byCity[c.city] = (byCity[c.city] || 0) + 1; });
  const byPosition = {};
  candidates.forEach(c => { byPosition[c.position_applied] = (byPosition[c.position_applied] || 0) + 1; });
  const avgExp = candidates.length
    ? (candidates.reduce((s, c) => s + (c.experience_years || 0), 0) / candidates.length).toFixed(1)
    : 0;
  res.render('reports', { candidates, byStatus, byCity, byPosition, avgExp });
});

app.get('/settings', requireLogin, (req, res) => {
  res.render('settings', { saved: req.query.saved === '1' });
});

app.post('/settings', requireLogin, (req, res) => {
  // no-op: settings are not persisted in this training mock
  res.redirect('/settings?saved=1');
});

app.get('/candidate/:id', requireLogin, (req, res) => {
  const candidate = candidates.find(c => c.id === req.params.id);
  if (!candidate) return res.status(404).send('Candidate not found');
  res.render('candidate', { candidate });
});

app.get('/download-cv/:id', requireLogin, (req, res) => {
  const candidate = candidates.find(c => c.id === req.params.id);
  if (!candidate) return res.status(404).send('Not found');
  streamCV(candidate, res);
});

app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

// Vercel imports the app as a serverless handler; only listen when run directly.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Candidate Portal running on http://localhost:${PORT}`);
    console.log('Login: admin / admin123');
  });
}

module.exports = app;
