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

    // Strict Program Validation (Reject unknown/invented program codes)
    const program = await Program.findOne({ code: cleanProgramCode });
    if (!program) {
      return res.status(400).json({
        success: false,
        message: `Program code "${cleanProgramCode}" does not exist. Please select from valid official programs.`
      });
    }
    if (!program.isActive) {
      return res.status(400).json({
        success: false,
        message: `Program "${program.title}" is currently inactive and not accepting applications.`
      });
    }
    const programTitle = program.title;

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

    // Validate program code
    const program = await Program.findOne({ code: cleanProgramCode });
    if (!program) {
      return res.status(400).json({
        success: false,
        message: `Program code "${cleanProgramCode}" not found. Please select from valid programs.`
      });
    }

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

    // Track duplicates within the CSV file itself using composite key
    const seenInFile = new Set();

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
        const rowKey = `${normEmail}|${cleanProgramCode}|${cleanBatch}`;

        if (seenInFile.has(rowKey)) {
          isDuplicate = true;
          duplicateCount++;
          errors.push('Duplicate entry inside this CSV file');
        } else {
          seenInFile.add(rowKey);

          const existing = await Participant.findOne({
            normalizedEmail: normEmail,
            programCode: cleanProgramCode,
            batchId: cleanBatch
          });

          if (existing) {
            isDuplicate = true;
            duplicateCount++;
            errors.push('Already exists in database for this program & batch');
          } else {
            validCount++;
          }
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
      previewRows: previewRows.slice(0, 100),
      fullRows: previewRows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Commits CSV rows into participants collection.
 * CRITICAL RULE: Revalidates every single row on server-side.
 * Never blindly trusts client-provided isValid or isDuplicate flags.
 */
exports.commitCsv = async (req, res, next) => {
  try {
    const { rows, programCode, batchId, fileName } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided to commit' });
    }

    const cleanProgramCode = (programCode || '').toUpperCase().trim();
    const cleanBatch = (batchId || 'BATCH-2026-Q4').toUpperCase().trim();

    // 1. Strict Server-Side Program Code Validation
    const program = await Program.findOne({ code: cleanProgramCode });
    if (!program) {
      return res.status(400).json({
        success: false,
        message: `Program code "${cleanProgramCode}" not found. Please choose from official programs.`
      });
    }
    const programTitle = program.title;

    // 2. Strict Server-Side Row Re-Validation & In-Batch Deduplication
    const toInsert = [];
    const duplicateConflicts = [];
    const invalidRows = [];
    const seenInCommit = new Set();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = r.rowIndex || (i + 1);
      const fullName = (r.fullName || '').trim();
      const email = (r.email || '').toLowerCase().trim();
      const phone = (r.phone || '').trim();

      // Field validation
      if (!fullName || fullName.length < 2) {
        invalidRows.push({ rowIndex, email, error: 'Name missing or fewer than 2 characters' });
        continue;
      }
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        invalidRows.push({ rowIndex, email, error: 'Invalid email format' });
        continue;
      }

      // In-batch composite key deduplication
      const rowKey = `${email}|${cleanProgramCode}|${cleanBatch}`;
      if (seenInCommit.has(rowKey)) {
        duplicateConflicts.push({ rowIndex, email, reason: 'Duplicate within the submitted import batch' });
        continue;
      }
      seenInCommit.add(rowKey);

      // Database composite key collision check
      const existing = await Participant.findOne({
        normalizedEmail: email,
        programCode: cleanProgramCode,
        batchId: cleanBatch
      });

      if (existing) {
        duplicateConflicts.push({ rowIndex, email, reason: 'Already registered in database for this program & cohort' });
        continue;
      }

      toInsert.push({
        fullName,
        normalizedName: fullName.toLowerCase(),
        email,
        normalizedEmail: email,
        phone,
        programCode: cleanProgramCode,
        programTitle,
        batchId: cleanBatch,
        source: 'CSV_IMPORT',
        completionStatus: 'PENDING'
      });
    }

    // 3. Create ImportBatch audit record
    const importBatch = new ImportBatch({
      fileName: fileName || 'manual_import.csv',
      uploadedBy: req.admin._id,
      programCode: cleanProgramCode,
      batchId: cleanBatch,
      totalRows: rows.length,
      validRows: toInsert.length,
      duplicateRows: duplicateConflicts.length,
      errorRows: invalidRows.length,
      status: toInsert.length > 0 ? 'COMMITTED' : 'DISCARDED'
    });
    await importBatch.save();

    // 4. Handle Case where 0 rows are eligible
    if (toInsert.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No valid or non-duplicate records found to import.',
        batchId: importBatch._id,
        importedCount: 0,
        duplicatesCount: duplicateConflicts.length,
        invalidCount: invalidRows.length,
        details: {
          duplicateConflicts,
          invalidRows
        }
      });
    }

    // Attach batch reference
    toInsert.forEach(doc => { doc.sourceImportBatchId = importBatch._id; });

    // 5. Insert Valid Rows Gracefully
    let insertedCount = 0;
    try {
      const result = await Participant.insertMany(toInsert, { ordered: false });
      insertedCount = result.length;
    } catch (e) {
      if (e.name === 'MongoBulkWriteError' || e.name === 'BulkWriteError') {
        insertedCount = e.insertedDocs ? e.insertedDocs.length : (e.result?.nInserted || 0);
        importBatch.validRows = insertedCount;
        importBatch.duplicateRows += (toInsert.length - insertedCount);
        await importBatch.save();
      } else {
        throw e;
      }
    }

    await AuditLog.create({
      actorId: req.admin._id,
      actorType: 'ADMIN',
      action: 'CSV_COMMITTED',
      targetEntity: 'PARTICIPANT',
      summary: `Admin ${req.admin.email} imported ${insertedCount} participants for ${cleanProgramCode} from CSV (${duplicateConflicts.length} duplicates skipped, ${invalidRows.length} invalid rejected)`
    });

    res.json({
      success: true,
      message: `Successfully imported ${insertedCount} participants. ${duplicateConflicts.length} duplicates skipped. ${invalidRows.length} invalid rejected.`,
      batchId: importBatch._id,
      importedCount: insertedCount,
      duplicatesCount: duplicateConflicts.length,
      invalidCount: invalidRows.length,
      details: {
        duplicateConflicts: duplicateConflicts.slice(0, 50),
        invalidRows: invalidRows.slice(0, 50)
      }
    });
  } catch (error) {
    next(error);
  }
};
