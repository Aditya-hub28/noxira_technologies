const { connectDB, disconnectDB } = require('../config/db');
const Program = require('../models/Program');
const Template = require('../models/Template');
const Participant = require('../models/Participant');
const { seedProgramCatalogue } = require('../config/programsCatalogue');

async function seedDemoData() {
  await connectDB();

  console.log('🌱 Seeding demo programs, templates, and participants...');

  // 1. Seed full 31-program catalogue additively and idempotently
  await seedProgramCatalogue(Program);
  console.log('✅ Seeded 31-program catalogue');

  // Ensure FS-DEV demo has default batch/dates if created
  let program = await Program.findOne({ code: 'FS-DEV' });
  if (!program) {
    program = await Program.create({
      code: 'FS-DEV',
      title: 'Full Stack Web Development & Cloud Systems',
      description: 'Engineering track covering modern web architecture.',
      defaultBatch: 'BATCH-2026-Q4',
      defaultStartDate: new Date('2026-09-01'),
      defaultEndDate: new Date('2026-10-31')
    });
    console.log('✅ Created demo Program: FS-DEV');
  }

  // 2. Template
  let template = await Template.findOne({ version: '1.0.0' });
  if (!template) {
    template = await Template.create({
      title: 'Official NOXIRA Certificate Template v1',
      version: '1.0.0',
      orientation: 'LANDSCAPE',
      dimensions: { width: 842, height: 595 },
      branding: {
        organizationName: 'NOXIRA TECHNOLOGIES',
        organizationTagline: 'INNOVATION & EXCELLENCE IN DIGITAL ENGINEERING',
        primaryColor: '#0F172A',
        accentColor: '#D97706',
        textColor: '#1E293B'
      },
      signatory: {
        name: 'Aditya Jha',
        title: 'Managing Director & Lead Architect',
        organization: 'NOXIRA Technologies'
      },
      isActive: true
    });
    console.log('✅ Created demo Template v1.0.0');
  }

  // 3. Sample Participants (in different states)
  const sampleData = [
    {
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      phone: '+91 98765 43210',
      completionStatus: 'ELIGIBLE',
      completionEvidence: 'Passed capstone project with 94% score. Verified GitHub repository.'
    },
    {
      fullName: 'Priya Sundaram',
      email: 'priya.sundaram@example.com',
      phone: '+91 98765 43211',
      completionStatus: 'ELIGIBLE',
      completionEvidence: 'Completed full curriculum and deployment assignment.'
    },
    {
      fullName: 'Rohan Deshmukh with Very Long Name for Certificate Elasticity Verification Test',
      email: 'rohan.deshmukh@example.com',
      phone: '+91 98765 43212',
      completionStatus: 'PENDING',
      completionEvidence: 'Project submitted, pending code review.'
    },
    {
      fullName: 'Neha Kapoor',
      email: 'neha.kapoor@example.com',
      phone: '+91 98765 43213',
      completionStatus: 'REWORK',
      completionEvidence: 'Database indexes missing in final submission, needs rework.'
    }
  ];

  for (const s of sampleData) {
    const existing = await Participant.findOne({
      normalizedEmail: s.email.toLowerCase(),
      programCode: 'FS-DEV',
      batchId: 'BATCH-2026-Q4'
    });

    if (!existing) {
      await Participant.create({
        fullName: s.fullName,
        normalizedName: s.fullName.toLowerCase(),
        email: s.email.toLowerCase(),
        normalizedEmail: s.email.toLowerCase(),
        phone: s.phone,
        programCode: 'FS-DEV',
        programTitle: 'Full Stack Web Development & Cloud Systems',
        batchId: 'BATCH-2026-Q4',
        source: 'WEBSITE',
        completionStatus: s.completionStatus,
        completionEvidence: s.completionEvidence
      });
      console.log(`✅ Seeded Participant: ${s.fullName} [${s.completionStatus}]`);
    }
  }

  console.log('✨ Demo seeding completed successfully!');
  await disconnectDB();
  process.exit(0);
}

seedDemoData().catch(err => {
  console.error('❌ Demo seeding failed:', err);
  process.exit(1);
});
