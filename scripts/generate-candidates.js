/**
 * Deterministic candidate generator for Exelentic Personal Services.
 *
 * Produces ~20-30 rich candidate records per talent category and writes them to
 * data/candidates.json. Seeded, so re-running yields byte-identical output --
 * important because the RPA training exercises are graded against fixed records.
 *
 *   node scripts/generate-candidates.js
 */

const fs = require('fs');
const path = require('path');

// --- seeded PRNG (mulberry32) -------------------------------------------------
let _seed = 0x5eed1234;
function rnd() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
function sample(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  return out;
}

// --- name / place pools -------------------------------------------------------
const FIRST = ['Markus','Aylin','Hans-Peter','Fatima','Stefan','Clara','Dimitri','Ingrid','Tomasz','Maria',
  'Aleksandr','Leila','Friedrich','Yuki','Elif','Patrick','Olga','Jonas','Nadja','Bilal',
  'Katharina','Sven','Amara','Lukas','Sofia','Mehmet','Anke','Piotr','Renata','Julian',
  'Hanna','Viktor','Chiara','Ahmet','Birgit','Nils','Zeynep','Matthias','Iveta','Ronan',
  'Sabine','Goran','Malik','Franziska','Emil','Dorota','Karim','Annika','Tobias','Marisa'];
const LAST = ['Lehmann','Demir','Gruber','Al-Rashid','Novak','Johansson','Papadopoulos','Hoffmann','Kowalski','Schneider',
  'Volkov','Mansouri','Weber','Tanaka','Yilmaz','O\'Brien','Petersen','Baumgartner','Fischer','Haddad',
  'Wagner','Lindqvist','Okonkwo','Bauer','Rossi','Kaya','Vogel','Zielinski','Marek','Brandt',
  'Keller','Ivanov','Ferrari','Ozturk','Krause','Andersen','Aydin','Richter','Novotna','Murphy',
  'Wolff','Petrovic','Diallo','Seidel','Larsen','Wojcik','Nasser','Berger','Schulz','Costa'];
const CITIES = ['Stuttgart','Berlin','Munich','Frankfurt','Dresden','Hamburg','Cologne','Dusseldorf','Leipzig','Nuremberg',
  'Hannover','Bonn','Essen','Karlsruhe','Mannheim','Freiburg','Augsburg','Bremen','Wiesbaden','Bochum'];
const MAILHOSTS = ['mailhaus.de','webpost.com','altmail.net','quickmail.org','postbox.eu','nordmail.se','bundesmail.de','freinet.de'];
const STATUSES = ['New','Under Review','Interview Scheduled','Offer Extended','Rejected','On Hold'];
const NOTICE = ['Immediately','2 weeks','1 month','2 months','3 months','After 01.09.'];
const LANG_LEVELS = ['Native','C2','C1','B2','B1'];
const EXTRA_LANGS = ['English','German','French','Spanish','Italian','Turkish','Polish','Russian','Arabic','Dutch'];

/**
 * The seven talent categories.
 *
 * `sap_department` records the equivalent unit in the SAP replica. The wording is
 * deliberately different on each side -- matching a portal category to the right SAP
 * department is part of the exercise -- but the mapping is 1:1 in principle.
 */
const CATEGORIES = [
  {
    key: 'TEC', label: 'Technical & Engineering Talent', sap_department: 'Engineering',
    roles: ['Senior Mechanical Engineer','Mechanical Design Engineer','Full Stack Developer','Backend Developer','Data Scientist','Machine Learning Engineer','Automation Engineer','CAD Konstrukteur','Embedded Software Engineer','Simulation Engineer (FEA)'],
    skills: ['CATIA V5','SolidWorks','AutoCAD','ANSYS','MATLAB','Python','JavaScript','TypeScript','React','Node.js','SQL','Docker','Kubernetes','Git','TIA Portal','SPS Programmierung','FEM Analysis','C++','Scikit-learn','TensorFlow'],
    companies: ['Bosch Rexroth','Siemens Digital Industries','ZF Friedrichshafen','Trumpf Werkzeugmaschinen','Continental Automotive','SAP SE','Zeiss Industrial','Festo AG'],
    degrees: ['B.Eng. Mechanical Engineering','M.Sc. Mechanical Engineering','B.Sc. Computer Science','M.Sc. Computer Science','Dipl.-Ing. Maschinenbau','M.Sc. Data Science'],
    certs: ['Six Sigma Green Belt','AWS Solutions Architect Associate','Certified SolidWorks Professional','Scrum Master (PSM I)','TUV Functional Safety Engineer'],
    bullets: [
      'Led redesign of {n} assembly components, cutting material cost by {p}%',
      'Owned CAD documentation for a product line of {n} SKUs',
      'Built automated test rig reducing validation time from {n} days to {m}',
      'Migrated legacy codebase to a containerised CI/CD pipeline',
      'Ran FEA studies that raised fatigue life by {p}% on load-bearing parts',
      'Mentored {m} junior engineers across two development squads',
      'Cut API p95 latency by {p}% via query and cache optimisation',
      'Delivered {n} sprint releases with zero critical post-release defects'
    ]
  },
  {
    key: 'EST', label: 'Estates, Trades & Site Services', sap_department: 'Facility Management',
    roles: ['Industrial Electrician','Landscape Gardener','Groundskeeper','Facility Technician','HVAC Technician','Executive Chef','Sous Chef','Building Services Engineer','Plumbing Technician','Site Caretaker'],
    skills: ['NEC / VDE 0100','Switchgear Maintenance','PLC Troubleshooting','Irrigation Systems','Tree Surgery','Ride-on Mower Operation','HVAC Servicing','Refrigeration','HACCP','Menu Planning','Welding (MAG)','Hydraulics','Fire Safety Systems','Forklift Operation'],
    companies: ['Apleona HSG','Wisag Facility Service','Strabag Property','Dussmann Group','Sodexo Deutschland','Gegenbauer Holding','Spie Deutschland'],
    degrees: ['Ausbildung Elektroniker fur Betriebstechnik','Gartner Fachrichtung Garten- und Landschaftsbau','Ausbildung Anlagenmechaniker SHK','Koch / Kochin IHK','Meisterbrief Elektrotechnik'],
    certs: ['Elektrofachkraft (VDE)','Arbeitssicherheit SCC','Kettensagenschein AS Baum I','HACCP Hygiene Certificate','Gabelstaplerschein','Kaltemittel-Sachkunde Kat. I'],
    bullets: [
      'Maintained electrical systems across {n} buildings with {p}% uptime',
      'Managed grounds maintenance for a {n} hectare corporate campus',
      'Reduced unplanned callouts by {p}% through preventive inspection rounds',
      'Supervised a crew of {m} during seasonal planting programmes',
      'Ran kitchen service for up to {n} covers per day',
      'Completed {n} annual safety inspections with no findings',
      'Cut energy consumption {p}% by retrofitting lighting and controls'
    ]
  },
  {
    key: 'FIN', label: 'Finance, Audit & Controlling', sap_department: 'Finance & Controlling',
    roles: ['Financial Accountant','Senior Accountant','Financial Controller','Cost Accountant','Accounts Payable Specialist','Internal Auditor','Tax Accountant','Treasury Analyst'],
    skills: ['SAP FI/CO','DATEV','Excel (Advanced)','IFRS','HGB','Monatsabschluss','Jahresabschluss','Kostenrechnung','Power BI','Umsatzsteuervoranmeldung','Konsolidierung','LucaNet','Liquiditatsplanung'],
    companies: ['Deloitte Deutschland','KPMG AG','Ernst & Young','Rodl & Partner','Commerzbank AG','Allianz SE','Henkel AG','BASF Services'],
    degrees: ['B.A. Betriebswirtschaftslehre','M.Sc. Finance & Accounting','Bilanzbuchhalter IHK','B.Sc. Accounting and Controlling','Steuerfachangestellte/r'],
    certs: ['Bilanzbuchhalter (IHK)','Certified Internal Auditor (CIA)','ACCA Part-Qualified','SAP FI Certification','Steuerfachwirt'],
    bullets: [
      'Closed monthly accounts for {n} entities within {m} working days',
      'Reduced DSO from {n} days to {m} through receivables follow-up',
      'Led IFRS conversion workstream covering {n} reporting units',
      'Automated reporting in Power BI, saving {m} hours per month',
      'Audited {n} cost centres and recovered {p}% in misposted spend',
      'Prepared annual statements per HGB for a EUR {n}m turnover unit'
    ]
  },
  {
    key: 'MED', label: 'Medical & Care Personnel', sap_department: 'Health Services',
    roles: ['Registered Nurse - Intensive Care','Registered Nurse - General Ward','Paediatric Nurse','Operating Theatre Nurse','Elderly Care Specialist','Medical Assistant (MFA)','Anaesthesia Nurse','Ward Coordinator'],
    skills: ['Intensivpflege','Beatmungsmanagement','Wundmanagement','Medikamentengabe','Notfallmanagement','Palliativpflege','Pflegedokumentation','Dialyse','EKG Monitoring','Hygienestandards','OP-Assistenz'],
    companies: ['Charite Berlin','Universitatsklinikum Heidelberg','Asklepios Kliniken','Helios Kliniken','Sana Kliniken','Caritas Pflegedienst','DRK Krankenhaus'],
    degrees: ['Ausbildung Gesundheits- und Krankenpflege','B.Sc. Pflegewissenschaft','Fachweiterbildung Intensivpflege','Altenpfleger/in examiniert','Ausbildung MFA'],
    certs: ['Fachweiterbildung Intensiv- und Anasthesiepflege','BLS / ACLS Provider','Praxisanleiter/in','Hygienebeauftragte/r','Palliative Care Basiskurs'],
    bullets: [
      'Cared for up to {m} ventilated patients per shift on a {n}-bed ICU',
      'Trained {m} new nursing staff as certified Praxisanleiter',
      'Coordinated ward handovers for a {n}-bed unit across three shifts',
      'Reduced documentation errors {p}% after introducing checklists',
      'Assisted in {n}+ operations across general and trauma surgery',
      'Supported palliative care for {n} long-term residents'
    ]
  },
  {
    key: 'COM', label: 'Commercial, Brand & Growth', sap_department: 'Sales & Marketing',
    roles: ['Marketing Manager (EMEA)','Digital Marketing Specialist','Brand Manager','Key Account Manager','Sales Representative','SEO Specialist','Content Marketing Lead','Product Marketing Manager'],
    skills: ['Google Analytics 4','Google Ads','SEO','SEA','HubSpot','Salesforce','Content Strategy','Marketing Automation','Adobe Creative Suite','Social Media Ads','A/B Testing','CRM Management','Copywriting'],
    companies: ['Publicis Groupe','Serviceplan Gruppe','Jung von Matt','Zalando SE','Delivery Hero','Otto Group','Beiersdorf AG','Ritter Sport'],
    degrees: ['B.A. Marketing Management','M.A. Media & Communication','B.Sc. Business Administration','M.Sc. Marketing Analytics','B.A. Kommunikationswissenschaft'],
    certs: ['Google Ads Search Certification','HubSpot Inbound Marketing','Google Analytics 4 Certified','Meta Blueprint','Salesforce Administrator'],
    bullets: [
      'Grew organic traffic {p}% year on year across {n} markets',
      'Managed an annual media budget of EUR {n}0,000',
      'Launched {n} campaigns delivering {p}% uplift in qualified leads',
      'Built the EMEA content calendar covering {n} channels',
      'Closed {n} new key accounts worth EUR {n}00,000 ARR',
      'Cut cost per acquisition {p}% through funnel optimisation'
    ]
  },
  {
    key: 'LOG', label: 'Logistics, Freight & Warehousing', sap_department: 'Supply Chain',
    roles: ['Logistics Coordinator','Warehouse Supervisor','Quality Assurance Inspector','Supply Chain Analyst','Dispatch Planner','Freight Forwarder','Inventory Controller','Fleet Coordinator'],
    skills: ['SAP MM','SAP EWM','Disposition','Zollabwicklung','Incoterms 2020','Gefahrgut ADR','Bestandsmanagement','Tourenplanung','Lean / Kaizen','Wareneingangskontrolle','ISO 9001','Staplerfuhrung'],
    companies: ['DB Schenker','Kuehne + Nagel','DHL Supply Chain','Dachser SE','Rhenus Logistics','Hermes Germany','Fiege Logistik'],
    degrees: ['Ausbildung Fachkraft fur Lagerlogistik','B.A. Logistikmanagement','Kaufmann/-frau fur Spedition','B.Sc. Supply Chain Management','Fachwirt Logistik IHK'],
    certs: ['Gabelstaplerschein','ADR Gefahrgutbeauftragter','IHK Fachwirt Logistiksysteme','Zollrecht Basiszertifikat','Six Sigma Yellow Belt'],
    bullets: [
      'Coordinated {n} inbound shipments per week across {m} suppliers',
      'Raised picking accuracy to {p}% through slotting redesign',
      'Supervised a warehouse team of {m} over two shifts',
      'Cut average dwell time by {p}% via dock scheduling',
      'Managed customs clearance for {n} cross-border consignments',
      'Reduced stock discrepancies {p}% with cycle-count programme'
    ]
  },
  {
    key: 'PEO', label: 'People Operations & Recruitment', sap_department: 'Human Capital Management',
    roles: ['HR Business Partner','Recruiter (Technical)','HR Generalist','Payroll Specialist','Talent Acquisition Lead','Learning & Development Officer','HR Administrator'],
    skills: ['Personalentwicklung','Recruiting','Active Sourcing','Arbeitsrecht','Betriebsverfassungsgesetz','Lohnabrechnung','DATEV Lohn','Personalcontrolling','Onboarding','SAP SuccessFactors','Workday','Zeugniserstellung'],
    companies: ['Randstad Deutschland','Hays AG','Adecco Group','Robert Half','Personio SE','Bertelsmann SE','Lufthansa Group'],
    degrees: ['B.A. Personalmanagement','M.Sc. Human Resource Management','Personalfachkaufmann/-frau IHK','B.A. Wirtschaftspsychologie','Ausbildung Industriekaufmann/-frau'],
    certs: ['Personalfachkaufmann (IHK)','SHRM-CP','Certified Recruiter (DGFP)','Arbeitsrecht Zertifikat','Systemischer Coach'],
    bullets: [
      'Filled {n} vacancies per year with an average time-to-hire of {m} weeks',
      'Advised {m} managers on employment law and restructuring',
      'Ran payroll for {n} employees across {m} legal entities',
      'Rolled out an onboarding programme lifting retention {p}%',
      'Built a talent pipeline of {n}+ qualified technical candidates',
      'Delivered {m} training modules to {n} staff annually'
    ]
  }
];

function fillBullet(tpl) {
  return tpl
    .replace(/\{n\}/g, () => String(int(8, 240)))
    .replace(/\{m\}/g, () => String(int(2, 18)))
    .replace(/\{p\}/g, () => String(int(9, 45)));
}

function makeSummary(cat, role, years) {
  const yr = years === 1 ? '1 year' : `${years} years`;
  const openers = [
    `${role} with ${yr} of hands-on experience`,
    `Experienced ${role.toLowerCase()} (${years} yrs)`,
    `${yr} of professional practice as ${role}`,
  ];
  const closers = [
    'seeking a permanent position in a mid-sized organisation.',
    'looking for a role with broader technical ownership.',
    'open to relocation within Germany for the right team.',
    'motivated by structured processes and clear documentation.',
    'available for shift work and on-call rotation.',
  ];
  return `${pick(openers)} in the ${cat.label.toLowerCase()} field, ${pick(closers)}`;
}

function makeExperience(cat, role, years) {
  const count = years >= 12 ? 3 : years >= 5 ? 2 : 1;
  const firms = sample(cat.companies, count);
  const out = [];
  let endYear = 2025;
  for (let i = 0; i < count; i++) {
    const span = i === 0 ? int(2, 6) : int(2, 5);
    const startYear = endYear - span;
    out.push({
      title: i === 0 ? role : pick(cat.roles),
      company: firms[i] || pick(cat.companies),
      location: pick(CITIES),
      period: `${String(int(1, 12)).padStart(2, '0')}/${startYear} - ${i === 0 ? 'present' : String(int(1, 12)).padStart(2, '0') + '/' + endYear}`,
      bullets: sample(cat.bullets, int(2, 3)).map(fillBullet)
    });
    endYear = startYear;
  }
  return out;
}

const candidates = [];
const usedEmails = new Set();
let idCounter = 10000;

CATEGORIES.forEach(cat => {
  const n = int(21, 29);          // 20-30 CVs per category
  for (let i = 0; i < n; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = `${first} ${last}`;
    const role = pick(cat.roles);
    const years = int(1, 24);
    const city = pick(CITIES);

    const base = `${first}.${last}`.toLowerCase()
      .replace(/[^a-z.]/g, '')
      .replace(/\.+/g, '.');
    let email = `${base}@${pick(MAILHOSTS)}`;
    let suffix = 2;
    while (usedEmails.has(email)) email = `${base}${suffix++}@${pick(MAILHOSTS)}`;
    usedEmails.add(email);

    const langs = [{ name: 'German', level: rnd() > 0.25 ? 'Native' : pick(['C2', 'C1']) }];
    sample(EXTRA_LANGS.filter(l => l !== 'German'), int(1, 2))
      .forEach(l => langs.push({ name: l, level: pick(LANG_LEVELS) }));

    candidates.push({
      id: 'CND-' + (++idCounter),
      name, first_name: first, last_name: last,
      email,
      phone: `+49 ${int(150, 179)} ${int(1000000, 9999999)}`,
      city, country: 'Germany',
      category: cat.key,
      category_label: cat.label,
      sap_department: cat.sap_department,
      position_applied: role,
      experience_years: years,
      status: pick(STATUSES),
      availability: pick(NOTICE),
      desired_salary: `EUR ${int(32, 96)},000`,
      applied_on: `202${int(4, 5)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
      summary: makeSummary(cat, role, years),
      skills: sample(cat.skills, int(5, 8)).map(s => ({ name: s, level: int(2, 5) })),
      languages: langs,
      certifications: sample(cat.certs, int(1, 3)),
      education: sample(cat.degrees, 1).map(d => ({
        degree: d,
        institution: pick(['Hochschule ' + pick(CITIES), 'Technische Universitat ' + pick(CITIES), 'Universitat ' + pick(CITIES), 'IHK ' + pick(CITIES), 'Berufsakademie ' + pick(CITIES)]),
        year: 2025 - years - int(0, 3)
      })),
      experience: makeExperience(cat, role, years)
    });
  }
});

const outPath = path.join(__dirname, '..', 'data', 'candidates.json');
fs.writeFileSync(outPath, JSON.stringify(candidates, null, 1));

const perCat = {};
candidates.forEach(c => { perCat[c.category] = (perCat[c.category] || 0) + 1; });
console.log(`Wrote ${candidates.length} candidates -> ${path.relative(process.cwd(), outPath)}`);
Object.keys(perCat).forEach(k => console.log(`  ${k}: ${perCat[k]}`));
console.log(`file size: ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
