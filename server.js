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
  name: 'epssess',
  keys: [process.env.SESSION_SECRET || 'xK9_legacy_eps_2004'],
  maxAge: 24 * 60 * 60 * 1000
}));

const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'candidates.json'), 'utf8'));

// One-page CV, generated on demand and streamed straight to the response (no disk
// writes), so this runs fine on read-only serverless filesystems like Vercel.
//
// The layout deliberately keeps every important value on a "Label: value" line so a
// bot can pull structured data back out of the PDF text layer.
function streamCV(c, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 45 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="CV_${c.id}_${c.name.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);

  const L = doc.page.margins.left;
  const R = doc.page.width - doc.page.margins.right;
  const W = R - L;
  const NAVY = '#1a3a5c';
  const GREY = '#555555';

  const rule = (y, color = '#bbbbbb') => {
    doc.save().moveTo(L, y).lineTo(R, y).lineWidth(0.8).strokeColor(color).stroke().restore();
  };
  // NB: no characterSpacing here -- it makes pdfkit emit per-glyph positioning, which
  // comes back out of text extraction as "P R O F I L E" and breaks section matching.
  const heading = text => {
    doc.moveDown(0.55);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text(text.toUpperCase(), L, y);
    rule(doc.y + 1.5, NAVY);
    doc.moveDown(0.42);
  };

  // --- header -----------------------------------------------------------------
  doc.font('Helvetica-Bold').fontSize(21).fillColor(NAVY).text(c.name, L, L, { width: W - 150 });
  doc.font('Helvetica').fontSize(11.5).fillColor('#333333').text(c.position_applied, { width: W - 150 });

  // ID badge, top-right
  doc.save();
  doc.rect(R - 143, L - 2, 143, 40).fillColor('#f2efe8').fill();
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
    .text(c.id, R - 137, L + 4, { width: 131, align: 'right' });
  doc.font('Helvetica').fontSize(7.5).fillColor(GREY)
    .text(c.category_label, R - 137, L + 19, { width: 131, align: 'right' });
  doc.restore();

  doc.moveDown(0.7);
  doc.font('Helvetica').fontSize(9).fillColor(GREY)
    .text(`${c.email}  |  ${c.phone}  |  ${c.city}, ${c.country}`, L, doc.y, { width: W });

  doc.moveDown(0.5);
  rule(doc.y);
  doc.moveDown(0.45);

  // --- extraction block: fixed "Label: value" pairs ---------------------------
  const facts = [
    ['Candidate ID', c.id],
    ['Category', c.category_label],
    ['Total Experience', `${c.experience_years} year${c.experience_years === 1 ? '' : 's'}`],
    ['Availability', c.availability],
    ['Desired Salary', c.desired_salary],
    ['Application Status', c.status],
    ['Applied On', c.applied_on],
    ['Location', `${c.city}, ${c.country}`],
  ];
  const colW = W / 2;
  let fy = doc.y;
  facts.forEach((f, i) => {
    const x = L + (i % 2) * colW;
    const y = fy + Math.floor(i / 2) * 12.5;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GREY).text(`${f[0]}: `, x, y, { continued: true, width: colW - 8 });
    doc.font('Helvetica').fillColor('#000000').text(String(f[1]), { width: colW - 8 });
  });
  doc.y = fy + Math.ceil(facts.length / 2) * 12.5;

  // --- profile ----------------------------------------------------------------
  heading('Profile');
  doc.font('Helvetica').fontSize(9).fillColor('#222222').text(c.summary, L, doc.y, { width: W, align: 'justify' });

  // --- experience -------------------------------------------------------------
  heading('Professional Experience');
  (c.experience || []).slice(0, 3).forEach((job, idx) => {
    if (idx) doc.moveDown(0.35);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111')
      .text(`${job.title} - ${job.company}`, L, y, { width: W - 108 });
    doc.font('Helvetica').fontSize(8).fillColor(GREY)
      .text(job.period, R - 105, y + 1, { width: 105, align: 'right' });
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(GREY)
      .text(job.location, L, doc.y, { width: W });
    doc.moveDown(0.15);
    (job.bullets || []).slice(0, 3).forEach(b => {
      doc.font('Helvetica').fontSize(8.5).fillColor('#222222')
        .text(`•  ${b}`, L + 6, doc.y, { width: W - 6 });
    });
  });

  // --- skills -----------------------------------------------------------------
  heading('Skills');
  const sk = (c.skills || []);
  const half = Math.ceil(sk.length / 2);
  const sy = doc.y;
  sk.forEach((s, i) => {
    const col = i < half ? 0 : 1;
    const row = i < half ? i : i - half;
    const x = L + col * colW;
    const y = sy + row * 11.5;
    doc.font('Helvetica').fontSize(8.5).fillColor('#222222')
      .text(s.name, x, y, { width: colW - 60, continued: false });
    // ASCII bar only -- filled/hollow circles are outside WinAnsi and extract as mojibake
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
      .text(`[${'#'.repeat(s.level)}${'-'.repeat(5 - s.level)}]  ${s.level}/5`, x + colW - 62, y, { width: 58 });
  });
  doc.y = sy + half * 11.5;

  // --- education / languages / certifications ---------------------------------
  heading('Education');
  (c.education || []).forEach(e => {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111').text(e.degree, L, doc.y, { width: W, continued: true });
    doc.font('Helvetica').fillColor(GREY).text(`  -  ${e.institution}, ${e.year}`);
  });

  heading('Languages & Certifications');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GREY).text('Languages: ', L, doc.y, { continued: true, width: W });
  doc.font('Helvetica').fillColor('#222222').text((c.languages || []).map(l => `${l.name} (${l.level})`).join(', '), { width: W });
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GREY).text('Certifications: ', L, doc.y, { continued: true, width: W });
  doc.font('Helvetica').fillColor('#222222').text((c.certifications || []).join(', ') || 'None on file', { width: W });

  // --- footer -----------------------------------------------------------------
  const fyy = doc.page.height - doc.page.margins.bottom - 14;
  rule(fyy - 5, '#dddddd');
  doc.font('Helvetica').fontSize(6.8).fillColor('#999999')
    .text(`Document ID: ${c.id}  |  Exelentic Personal Services - candidate record  |  Training mock document, not a real CV`,
      L, fyy, { width: W, align: 'center' });

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

// Talent categories present in the dataset, with counts. The labels differ from the
// SAP replica's department names on purpose -- mapping one to the other is part of
// the exercise -- but they correspond 1:1.
function categoryList() {
  const map = new Map();
  candidates.forEach(c => {
    if (!c.category) return;
    if (!map.has(c.category)) map.set(c.category, { key: c.category, label: c.category_label, count: 0 });
    map.get(c.category).count++;
  });
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
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
  const byCategory = {};
  candidates.forEach(c => { byCategory[c.category_label] = (byCategory[c.category_label] || 0) + 1; });
  res.render('overview', { candidates, byStatus, byCategory, categories: categoryList() });
});

app.get('/dashboard', requireLogin, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const cat = (req.query.category || '').trim();
  const status = (req.query.status || '').trim();

  let list = candidates;
  if (cat) list = list.filter(c => c.category === cat);
  if (status) list = list.filter(c => c.status === status);
  if (q) {
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.position_applied.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      (c.category_label || '').toLowerCase().includes(q) ||
      (c.skills || []).some(s => s.name.toLowerCase().includes(q)));
  }

  const total = list.length;
  const sizeRaw = parseInt(req.query.page_size, 10);
  const pageSize = [10, 25, 50, 100].includes(sizeRaw) ? sizeRaw : 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), pages);
  const slice = list.slice((page - 1) * pageSize, page * pageSize);

  res.render('dashboard', {
    candidates: slice,
    query: req.query.q || '',
    categories: categoryList(),
    statuses: [...new Set(candidates.map(c => c.status))].sort(),
    selectedCategory: cat,
    selectedStatus: status,
    page, pages, pageSize, total,
    shownFrom: total === 0 ? 0 : (page - 1) * pageSize + 1,
    shownTo: Math.min(page * pageSize, total)
  });
});

app.get('/candidates/new', requireLogin, (req, res) => {
  res.render('new-candidate', { error: null, values: {}, categories: categoryList() });
});

app.post('/candidates/new', requireLogin, (req, res) => {
  const { name, email, phone, city, position_applied, experience_years } = req.body;
  if (!name || !name.trim()) {
    return res.render('new-candidate', { error: 'Candidate name is required.', values: req.body, categories: categoryList() });
  }
  const cat = categoryList().find(x => x.key === req.body.category);
  const candidate = {
    id: newCandidateId(),
    name: name.trim(),
    email: (email || '').trim(),
    phone: (phone || '').trim(),
    city: (city || '').trim(),
    country: 'Germany',
    status: 'New',
    category: cat ? cat.key : 'TEC',
    category_label: cat ? cat.label : 'Technical & Engineering Talent',
    position_applied: (position_applied || 'Unspecified').trim(),
    experience_years: parseInt(experience_years, 10) || 0,
    availability: 'Immediately',
    desired_salary: 'On request',
    applied_on: new Date().toISOString().slice(0, 10),
    summary: `Manually registered candidate for ${(position_applied || 'an unspecified role').trim()}.`,
    skills: [], languages: [], certifications: [], education: [], experience: []
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
  const byCategory = {};
  candidates.forEach(c => { byCategory[c.category_label] = (byCategory[c.category_label] || 0) + 1; });
  const avgExp = candidates.length
    ? (candidates.reduce((s, c) => s + (c.experience_years || 0), 0) / candidates.length).toFixed(1)
    : 0;
  res.render('reports', { candidates, byStatus, byCity, byCategory, avgExp });
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
