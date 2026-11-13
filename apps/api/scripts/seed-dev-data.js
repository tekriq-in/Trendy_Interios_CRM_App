/**
 * Dev test-data seed — run with: node scripts/seed-dev-data.js
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Parse .env manually — avoids dotenv dependency resolution in pnpm
function loadEnv(file) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*([^#=\s][^=]*)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv(path.resolve(__dirname, '../.env'));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI not set in apps/api/.env'); process.exit(1); }

const DEPT = {
  enquiry:       new mongoose.Types.ObjectId('6ac7dcd6f8e71fa367d8afbc'),
  measurement:   new mongoose.Types.ObjectId('6ac7dcd7f8e71fa367d8afd3'),
  design:        new mongoose.Types.ObjectId('6ac7dcd7f8e71fa367d8afd8'),
  purchase:      new mongoose.Types.ObjectId('6ac7dcd7f8e71fa367d8afdc'),
  manufacturing: new mongoose.Types.ObjectId('6ac7dcd7f8e71fa367d8afe0'),
  assembly:      new mongoose.Types.ObjectId('6ac7dcd8f8e71fa367d8afe4'),
  delivery:      new mongoose.Types.ObjectId('6ac7dcd8f8e71fa367d8afe8'),
  handover:      new mongoose.Types.ObjectId('6ac7dcd8f8e71fa367d8afec'),
};
const USER = {
  md:       new mongoose.Types.ObjectId('6ac7dcd9f8e71fa367d8affd'),
  gm:       new mongoose.Types.ObjectId('6acd1188fc6ffd97d3760c14'),
  head:     new mongoose.Types.ObjectId('6acd1188fc6ffd97d3760c18'),
  employee: new mongoose.Types.ObjectId('6acd1189fc6ffd97d3760c1c'),
};

const loose = { strict: false, timestamps: true };
const Client   = mongoose.model('Client',      new mongoose.Schema({}, loose), 'clients');
const Project  = mongoose.model('Project',     new mongoose.Schema({}, loose), 'projects');
const Task     = mongoose.model('Task',        new mongoose.Schema({}, loose), 'tasks');
const Blocker  = mongoose.model('Blocker',     new mongoose.Schema({}, loose), 'blockers');
const Activity = mongoose.model('ActivityLog', new mongoose.Schema({}, { strict: false }), 'activitylogs');

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  if (await Client.findOne({ email: 'meena@example.com' })) {
    console.log('Dev seed data already exists — skipping.');
    return;
  }

  // ── Clients ───────────────────────────────────────────────────────────────
  const [meena, suresh, preethi] = await Client.insertMany([
    {
      name: 'Meena Krishnan', phone: '9444123456', email: 'meena@example.com',
      address: '14, Anna Nagar East, Chennai - 600102',
      leadSource: 'referral', whatsappOptIn: true,
      notes: 'Full home renovation — 3 BHK. Prefers modern minimalist style.',
      createdBy: USER.md,
    },
    {
      name: 'Suresh Babu', phone: '9790234567', email: 'suresh.b@gmail.com',
      address: '7, Velachery Main Road, Chennai - 600042',
      leadSource: 'walkin', whatsappOptIn: true,
      notes: 'Kitchen + living room only. Budget conscious.',
      createdBy: USER.gm,
    },
    {
      name: 'Preethi Rajan', phone: '9600345678', email: 'preethi.r@outlook.com',
      address: '22, Adyar, Chennai - 600020',
      leadSource: 'marketing', whatsappOptIn: false,
      notes: 'Office interior — 1200 sqft. Needs 3D visualization.',
      createdBy: USER.gm,
    },
  ]);
  console.log(`Clients: ${meena._id}  ${suresh._id}  ${preethi._id}`);

  // ── Projects ──────────────────────────────────────────────────────────────
  const [p1, p2, p3] = await Project.insertMany([
    {
      client: meena._id,
      title: 'Meena Krishnan — Full Home Renovation',
      currentStage: DEPT.design,
      stageHistory: [
        { stage: DEPT.enquiry,     enteredAt: new Date('2026-09-01'), completedAt: new Date('2026-09-05') },
        { stage: DEPT.measurement, enteredAt: new Date('2026-09-05'), completedAt: new Date('2026-09-10') },
        { stage: DEPT.design,      enteredAt: new Date('2026-09-10'), completedAt: null },
      ],
      progressPct: 28,
      assignedTeam: [USER.md, USER.gm, USER.head, USER.employee],
      targetDate: new Date('2026-12-15'),
      status: 'active',
      requiresDrawing: true, createdBy: USER.md,
    },
    {
      client: suresh._id,
      title: 'Suresh Babu — Kitchen + Living Room',
      currentStage: DEPT.manufacturing,
      stageHistory: [
        { stage: DEPT.enquiry,       enteredAt: new Date('2026-08-10'), completedAt: new Date('2026-08-14') },
        { stage: DEPT.measurement,   enteredAt: new Date('2026-08-14'), completedAt: new Date('2026-08-18') },
        { stage: DEPT.design,        enteredAt: new Date('2026-08-18'), completedAt: new Date('2026-08-28') },
        { stage: DEPT.purchase,      enteredAt: new Date('2026-08-28'), completedAt: new Date('2026-09-08') },
        { stage: DEPT.manufacturing, enteredAt: new Date('2026-09-08'), completedAt: null },
      ],
      progressPct: 58,
      assignedTeam: [USER.md, USER.head, USER.employee],
      targetDate: new Date('2026-11-01'),
      status: 'active',
      requiresDrawing: true, createdBy: USER.md,
    },
    {
      client: preethi._id,
      title: 'Preethi Rajan — Office Interior',
      currentStage: DEPT.enquiry,
      stageHistory: [
        { stage: DEPT.enquiry, enteredAt: new Date('2026-10-01'), completedAt: null },
      ],
      progressPct: 5,
      assignedTeam: [USER.gm, USER.employee],
      targetDate: new Date('2027-02-28'),
      status: 'active', requiresDrawing: true, createdBy: USER.gm,
    },
  ]);
  console.log(`Projects: ${p1._id}  ${p2._id}  ${p3._id}`);

  // ── Tasks ─────────────────────────────────────────────────────────────────
  await Task.insertMany([
    { project: p1._id, department: DEPT.design,         title: 'Prepare 2D floor plan — master bedroom', assignedTo: USER.employee, status: 'done',        dueDate: new Date('2026-09-18'), completedAt: new Date('2026-09-17'), createdBy: USER.head },
    { project: p1._id, department: DEPT.design,         title: 'Prepare 2D floor plan — kitchen',        assignedTo: USER.employee, status: 'in_progress', dueDate: new Date('2026-10-20'), createdBy: USER.head },
    { project: p1._id, department: DEPT.design,         title: 'Client approval: laminate and acrylic',  assignedTo: USER.head,     status: 'pending',     dueDate: new Date('2026-10-25'), createdBy: USER.gm },
    { project: p2._id, department: DEPT.manufacturing,  title: 'Cut and polish kitchen cabinet panels',  assignedTo: USER.employee, status: 'done',        dueDate: new Date('2026-09-20'), completedAt: new Date('2026-09-19'), createdBy: USER.head },
    { project: p2._id, department: DEPT.manufacturing,  title: 'Assemble modular kitchen carcass',       assignedTo: USER.employee, status: 'in_progress', dueDate: new Date('2026-10-15'), createdBy: USER.head },
    { project: p2._id, department: DEPT.manufacturing,  title: 'Quality check — all panels before dispatch', assignedTo: USER.head, status: 'pending',    dueDate: new Date('2026-10-18'), createdBy: USER.head },
    { project: p3._id, department: DEPT.enquiry,        title: 'Schedule site visit — Adyar office',    assignedTo: USER.employee, status: 'pending',     dueDate: new Date('2026-10-15'), createdBy: USER.gm },
    { project: p3._id, department: DEPT.enquiry,        title: 'Collect client brief and reference images', assignedTo: USER.gm,   status: 'in_progress', dueDate: new Date('2026-10-18'), createdBy: USER.gm },
  ]);
  console.log('Tasks created');

  // ── Blockers ──────────────────────────────────────────────────────────────
  await Blocker.insertMany([
    {
      project: p1._id, raisedBy: USER.employee,
      title: 'Client not responding for material approval',
      description: 'Tried calling 3 times over 2 days. Laminate sample approval pending — blocks design completion.',
      type: 'client_side', status: 'open', createdBy: USER.employee,
    },
    {
      project: p2._id, raisedBy: USER.head,
      title: 'Handle hardware out of stock at supplier',
      description: 'SS handles from Amar Hardware are out of stock. Earliest delivery is 10 days.',
      type: 'internal', status: 'open', createdBy: USER.head,
    },
  ]);
  console.log('Blockers created');

  // ── Activity log ──────────────────────────────────────────────────────────
  await Activity.insertMany([
    { actor: USER.md,       action: 'project.created',  entity: 'projects', entityId: String(p1._id), metadata: { title: 'Meena Krishnan — Full Home Renovation' } },
    { actor: USER.md,       action: 'project.created',  entity: 'projects', entityId: String(p2._id), metadata: { title: 'Suresh Babu — Kitchen + Living Room' } },
    { actor: USER.gm,       action: 'project.created',  entity: 'projects', entityId: String(p3._id), metadata: { title: 'Preethi Rajan — Office Interior' } },
    { actor: USER.employee, action: 'blocker.raised',   entity: 'blockers', entityId: 'seed', metadata: { project: String(p1._id) } },
  ]);
  console.log('Activity log entries created');

  console.log('\n✓ Dev seed complete.');
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => mongoose.disconnect());
