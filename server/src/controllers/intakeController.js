const csv = require('csv-parser');
const { Readable } = require('stream');
const Participant = require('../models/Participant');
const Program = require('../models/Program');
const ImportBatch = require('../models/ImportBatch');
const AuditLog = require('../models/AuditLog');

/**
 * Public Website Application Intake
 */
exports.websiteApply = async (req, res, next) => {
  try {
    const { fullName, email, phone, programCode, batchId } = req.body;

    if (!fullName || !email || !programCode) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and program code are required.'
      });
    }

    const normEmail = email.toLowerCase().trim();
    const cleanProgramCode = programCode.toUpperCase().trim();
    const cleanBatch = (batchId || 'BATCH-2026-Q4').toUpperCase().trim();

    // Check if Program exists
    let program = await Program.findOne({ code: cleanProgramCode });
    const programTitle = program ? program.title : `${cleanProgramCode} Certification Program`;

    // Check for duplicate registration attempt
    const existing = await Participant.findOne({
      normalizedEmail: normEmail,
      programCode: cleanProgramCode,
      batchId: cleanBatch
    });

    if (existing) {
      // Return 409 Conflict - Do NOT silently overwrite
      return res.status(409).json({
        success: false,
        message: 'An application with this email address for this program and batch is already on file.',
        existingStatus: existing.completionStatus
      });
    }

    const participant = new Participant({
      fullName: fullName.trim(),
      email: normEmail,
      phone: phone ? phone.trim() : '',
      programCode: cleanProgramCode,
      programTitle,
      batchId: cleanBatch,
      source: 'WEBSITE',
      completionStatus: 'PENDING'
    });

    await participant.save();

    await AuditLog.create({
      actorType: 'PUBLIC_USER',
      action: 'INTAKE_SUBMITTED',
      targetEntity: 'PARTICIPANT',
      targetId: participant._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      summary: `Website application submitted by ${participant.fullName} (${participant.email}) for ${cleanProgramCode}`
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. Status is currently pending admin review.',
      participant: {
        id: participant._id,
        fullName: participant.fullName,
        programTitle: participant.programTitle,
        completionStatus: participant.completionStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Parses CSV buffer into structured rows
 */
function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer);
    stream
      .pipe(csv({ trim: true }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

/**
 * Previews uploaded CSV without committing to DB
 */
exports.previewCsv = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const { programCode, batchId } = req.body;
    if (!programCode) {
      return res.status(400).json({ success: false, message: 'Program code is required' });
    }

    const cleanProgramCode = programCode.toUpperCase().trim();
    const cleanBatch = (batchId || 'BATCH-2026-Q4').toUpperCase().trim();

    const rawRows = await parseCsvBuffer(req.file.buffer);

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, message: 'CSV file is empty' });
    }

    if (rawRows.length > 1000) {
      return res.status(400).json({ success: false, message: 'CSV exceeds limit of 1,000 rows per batch' });
    }

    // Auto-detect headers
    const sample = rawRows[0];
    const headers = Object.keys(sample);

    // Map common header variations
    const nameHeader = headers.find(h => /name|student|participant/i.test(h)) || headers[0];
    const emailHeader = headers.find(h => /email|mail/i.test(h)) || headers[1];
    const phoneHeader = headers.find(h => /phone|mobile|contact/i.test(h)) || '';

    const previewRows = [];
    let validCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rawName = row[nameHeader];
      const rawEmail = row[emailHeader];
      const rawPhone = phoneHeader ? row[phoneHeader] : '';

      const errors = [];
      if (!rawName || rawName.trim().length < 2) {
        errors.push('Missing or invalid name');
      }
      if (!rawEmail || !/^\S+@\S+\.\S+$/.test(rawEmail.trim())) {
        errors.push('Missing or invalid email');
      }

      let isDuplicate = false;
      if (errors.length === 0) {
        const normEmail = rawEmail.toLowerCase().trim();
        const existing = await Participant.findOne({
          normalizedEmail: normEmail,
          programCode: cleanProgramCode,
          batchId: cleanBatch
        });

        if (existing) {
          isDuplicate = true;
          duplicateCount++;
        } else {
          validCount++;
        }
      } else {
        errorCount++;
      }

      previewRows.push({
        rowIndex: i + 1,
        fullName: rawName ? rawName.trim() : '',
        email: rawEmail ? rawEmail.toLowerCase().trim() : '',
        phone: rawPhone ? rawPhone.trim() : '',
        isValid: errors.length === 0 && !isDuplicate,
        isDuplicate,
        errors
      });
    }

    res.json({
      success: true,
      stats: {
        totalRows: rawRows.length,
        validCount,
        duplicateCount,
        errorCount
      },
      detectedHeaders: {
        nameHeader,
        emailHeader,
        phoneHeader
      },
      availableHeaders: headers,
      previewRows: previewRows.slice(0, 100), // Preview top 100 rows
      fullRows: previewRows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Commits approved CSV rows into participants collection
 */
exports.commitCsv = async (req, res, next) => {
  try {
    const { rows, programCode, batchId, fileName } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided to commit' });
    }

    const cleanProgramCode = programCode.toUpperCase().trim();
    const cleanBatch = (batchId || 'BATCH-2026-Q4').toUpperCase().trim();

    let program = await Program.findOne({ code: cleanProgramCode });
    const programTitle = program ? program.title : `${cleanProgramCode} Certification Program`;

    // Filter only valid, non-duplicate rows
    const validRows = rows.filter(r => r.isValid && !r.isDuplicate);

    if (validRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid rows to commit.' });
    }

    // Create ImportBatch record
    const importBatch = new ImportBatch({
      fileName: fileName || 'manual_import.csv',
      uploadedBy: req.admin._id,
      programCode: cleanProgramCode,
      batchId: cleanBatch,
      totalRows: rows.length,
      validRows: validRows.length,
      duplicateRows: rows.filter(r => r.isDuplicate).length,
      errorRows: rows.filter(r => r.errors && r.errors.length > 0).length,
      status: 'COMMITTED'
    });
    await importBatch.save();

    const insertDocs = validRows.map(r => ({
      fullName: r.fullName.trim(),
      normalizedName: r.fullName.toLowerCase().trim(),
      email: r.email.toLowerCase().trim(),
      normalizedEmail: r.email.toLowerCase().trim(),
      phone: r.phone ? r.phone.trim() : '',
      programCode: cleanProgramCode,
      programTitle,
      batchId: cleanBatch,
      source: 'CSV_IMPORT',
      sourceImportBatchId: importBatch._id,
      completionStatus: 'PENDING'
    }));

    const result = await Participant.insertMany(insertDocs, { ordered: false });

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'CSV_COMMITTED',
      targetEntity: 'PARTICIPANT',
      summary: `Admin ${req.admin.email} imported ${result.length} participants for ${cleanProgramCode} from CSV`
    });

    res.json({
      success: true,
      message: `Successfully imported ${result.length} participants. All marked as PENDING.`,
      batchId: importBatch._id,
      importedCount: result.length
    });
  } catch (error) {
    next(error);
  }
};
