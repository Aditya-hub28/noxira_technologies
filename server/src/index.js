const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const intakeRoutes = require('./routes/intakeRoutes');
const participantRoutes = require('./routes/participantRoutes');
const templateRoutes = require('./routes/templateRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const verifyRoutes = require('./routes/verifyRoutes');
const distributionRoutes = require('./routes/distributionRoutes');
const auditRoutes = require('./routes/auditRoutes');
const programRoutes = require('./routes/programRoutes');
const adminProgramRoutes = require('./routes/adminProgramRoutes');
const adminApplicationRoutes = require('./routes/adminApplicationRoutes');
const adminOfferTemplateRoutes = require('./routes/adminOfferTemplateRoutes');
const offerDownloadRoutes = require('./routes/offerDownloadRoutes');

const app = express();

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'NOXIRA Certificate Management API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/intake', intakeRoutes);
app.use('/api/v1/participants', participantRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/public', verifyRoutes);
app.use('/api/v1/distribution', distributionRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/programs', programRoutes);
app.use('/api/v1/admin/programs', adminProgramRoutes);
app.use('/api/v1/admin/applications', adminApplicationRoutes);
app.use('/api/v1/admin/offer-templates', adminOfferTemplateRoutes);
app.use('/api/v1/offers', offerDownloadRoutes);

// Global Error Handler
app.use(errorHandler);

async function autoSeedIfEmpty() {
  if (env.NODE_ENV === 'production') {
    console.log('🔒 Production mode active: Auto-seeding disabled. Default admin and demo data will not be provisioned.');
    return;
  }

  const Admin = require('./models/Admin');
  const Program = require('./models/Program');
  const Template = require('./models/Template');
  const Participant = require('./models/Participant');

  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    console.log('⚡ Bootstrapping initial Super Admin & Demo Cohorts...');
    const crypto = require('crypto');
    const isCustomPass = Boolean(process.env.INITIAL_ADMIN_PASSWORD);
    const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(12).toString('hex');
    const hash = await Admin.hashPassword(defaultPassword);
    await Admin.create({
      name: 'Aditya Jha',
      email: 'admin@noxira.com',
      passwordHash: hash,
      role: 'SUPER_ADMIN',
      isActive: true
    });
    console.log('✅ Default Super Admin provisioned (admin@noxira.com)');
    if (!isCustomPass) {
      const secretFile = path.resolve(__dirname, '../../server/.initial_admin_secret');
      try {
        fs.writeFileSync(secretFile, `admin@noxira.com:${defaultPassword}\n`, { mode: 0o600 });
        console.log('🔒 Generated initial development Super Admin credentials saved to server/.initial_admin_secret (never logged to stdout).');
      } catch (writeErr) {
        console.log('🔒 Initial development Super Admin provisioned (configure INITIAL_ADMIN_PASSWORD in server/.env).');
      }
      console.log('💡 Tip: Set INITIAL_ADMIN_PASSWORD in server/.env to configure a static development password.');
    }

    const { seedProgramCatalogue } = require('./config/programsCatalogue');

    // Provision initial dev demo programs if not yet existing
    await Program.updateOne(
      { code: 'FS-DEV' },
      {
        $setOnInsert: {
          code: 'FS-DEV',
          title: 'Full Stack Web Development & Cloud Systems',
          description: 'Engineering track covering modern web architecture.',
          defaultBatch: 'BATCH-2026-Q4',
          defaultStartDate: new Date('2026-09-01'),
          defaultEndDate: new Date('2026-10-31'),
          category: 'Development',
          isActive: true
        }
      },
      { upsert: true }
    );
    await Program.updateOne(
      { code: 'AI-ENG' },
      {
        $setOnInsert: {
          code: 'AI-ENG',
          title: 'Applied Artificial Intelligence & LLM Engineering',
          description: 'Deep dive into LLM agent workflows, fine-tuning, and scalable neural architectures.',
          defaultBatch: 'BATCH-2026-Q4',
          defaultStartDate: new Date('2026-09-15'),
          defaultEndDate: new Date('2026-11-01'),
          category: 'AI & Data Science',
          isActive: true
        }
      },
      { upsert: true }
    );

    // Seed full 31-program catalogue additively and idempotently
    await seedProgramCatalogue(Program);

    await Template.create({
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
      layout: {
        signatory: {
          name: 'Aditya Jha',
          title: 'Managing Director & Lead Architect',
          organization: 'NOXIRA Technologies'
        }
      },
      isActive: true
    });

    await Participant.create([
      {
        fullName: 'Aarav Sharma',
        normalizedName: 'aarav sharma',
        email: 'aarav.sharma@example.com',
        normalizedEmail: 'aarav.sharma@example.com',
        phone: '+91 98765 43210',
        programCode: 'FS-DEV',
        programTitle: 'Full Stack Web Development & Cloud Systems',
        batchId: 'BATCH-2026-Q4',
        source: 'WEBSITE',
        completionStatus: 'ELIGIBLE',
        completionEvidence: 'Verified 100% attendance & high-distinction capstone deployment.'
      },
      {
        fullName: 'Priya Sundaram',
        normalizedName: 'priya sundaram',
        email: 'priya.sundaram@example.com',
        normalizedEmail: 'priya.sundaram@example.com',
        phone: '+91 98765 43211',
        programCode: 'FS-DEV',
        programTitle: 'Full Stack Web Development & Cloud Systems',
        batchId: 'BATCH-2026-Q4',
        source: 'CSV_IMPORT',
        completionStatus: 'PENDING',
        completionEvidence: 'Project submitted, pending code review.'
      },
      {
        fullName: 'Prof. Dr. Christopher Bartholomew Montgomery-Fitzgerald',
        normalizedName: 'prof. dr. christopher bartholomew montgomery-fitzgerald',
        email: 'christopher.fitzgerald@example.com',
        normalizedEmail: 'christopher.fitzgerald@example.com',
        phone: '+91 98765 43212',
        programCode: 'FS-DEV',
        programTitle: 'Full Stack Web Development & Cloud Systems',
        batchId: 'BATCH-2026-Q4',
        source: 'CSV_IMPORT',
        completionStatus: 'ELIGIBLE',
        completionEvidence: 'Capstone verified. Test for long name font scaling.'
      }
    ]);

    console.log('✅ Demo programs, template, and initial candidates provisioned.');
  }

  const OfferLetterTemplate = require('./models/OfferLetterTemplate');
  const offerPdfService = require('./services/offerPdfService');
  const storageService = require('./services/storageService');

  const templateCount = await OfferLetterTemplate.countDocuments();
  if (templateCount === 0) {
    try {
      const samplePdfBuffer = await offerPdfService.generateSampleOfferTemplatePdf();
      const sampleSaved = await storageService.saveOfferTemplateFile(samplePdfBuffer, 'sample_offer_template_v1.pdf');
      const samplePath = sampleSaved.diskPath || String(sampleSaved);
      await OfferLetterTemplate.create({
        name: 'Built-in Sample Offer Template',
        version: 1,
        isSample: true,
        isActive: false,
        pdfStoragePath: samplePath,
        pdfSizeBytes: samplePdfBuffer.length,
        pageCount: 1,
        pageDimensions: [{ pageNumber: 1, width: 595.28, height: 841.89 }],
        fields: offerPdfService.DEFAULT_SAMPLE_FIELDS
      });
      console.log('📄 Built-in Sample Offer Template provisioned.');
    } catch (seedErr) {
      console.error('Failed to seed sample offer template:', seedErr);
    }
  }
}

// Start Server
async function startServer() {
  await connectDB();
  await autoSeedIfEmpty();
  const server = app.listen(env.PORT, () => {
    console.log(`✨ NOXIRA Certificate Engine running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    console.log(`🔗 Public Verification Base: ${env.VERIFY_BASE_URL}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
