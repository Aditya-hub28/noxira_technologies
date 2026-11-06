const csv = require('csv-parser');
const { Readable } = require('stream');
const Participant = require('../models/Participant');
const Program = require('../models/Program');
const ImportBatch = require('../models/ImportBatch');
const AuditLog = require('../models/AuditLog');
const Application = require('../models/Application');
const { generateApplicationId } = require('../models/Application');

/**
 * Public Website Application Intake
 */
exports.websiteApply = async (req, res, next) => {
  try {
    const configuredBatch = (process.env.WEBSITE_INTAKE_BATCH_ID || '').trim().toUpperCase();

    if (!configuredBatch) {
      return res.status(503).json({
        success: false,
        message: 'Website application intake is temporarily unavailable (intake batch not configured). Please contact the administration.'
      });
    }

    const { fullName, email, phone, programCode, feeAcknowledged } = req.body;

    // Strict string-only input validation (prevents non-string injection)
    if (
      typeof fullName !== 'string' ||
      typeof email !== 'string' ||
      typeof programCode !== 'string' ||
      !fullName.trim() ||
      !email.trim() ||
      !programCode.trim() ||
      (phone !== undefined && phone !== null && typeof phone !== 'string')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and program code are required.'
      });
    }

    const normEmail = email.toLowerCase().trim();
    const cleanProgramCode = programCode.toUpperCase().trim();

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

    // FIX 3: Fee must be explicitly set before anyone can apply (0 is a valid free programme)
    if (program.feeInr === undefined || program.feeInr === null) {
      return res.status(400).json({
        success: false,
        code: 'FEE_NOT_SET',
        message: 'Applications for this programme are not open yet. NOXIRA has not published its Task Submission & Review Fee.'
      });
    }

    const programTitle = program.title;

    // Fee Disclosure Acknowledgment Validation (Mandatory boolean check)
    if (feeAcknowledged !== true) {
      return res.status(400).json({
        success: false,
        message: 'Fee disclosure acknowledgment is mandatory before submitting your application.'
      });
    }

    // Check for duplicate registration attempt in configured batch
    const existing = await Participant.findOne({
      normalizedEmail: normEmail,
      programCode: cleanProgramCode,
      batchId: configuredBatch
    });

    if (existing) {
      // FIX 1: Self-heal on duplicate path for stranded WEBSITE participants lacking an Application
      if (existing.source === 'WEBSITE') {
        const existingApp = await Application.findOne({ participantId: existing._id });
        if (!existingApp) {
          let healedApp = null;
          let healAttempts = 0;
          while (!healedApp && healAttempts < 5) {
            healAttempts++;
            const candidateAppId = generateApplicationId();
            try {
              healedApp = new Application({
                applicationId: candidateAppId,
                participantId: existing._id,
                programCode: existing.programCode,
                programTitle: existing.programTitle,
                batchId: existing.batchId,
                status: 'APPLIED',
                intakeSource: 'WEBSITE',
                feeLocked: Number(program.feeInr)
              });
              await healedApp.save();
            } catch (healErr) {
              if (healErr.code === 11000) {
                const racedApp = await Application.findOne({ participantId: existing._id });
                if (racedApp) {
                  healedApp = racedApp;
                  break;
                }
                if (healAttempts < 5) {
                  healedApp = null;
                  continue;
                }
              }
              throw healErr;
            }
          }

          if (healedApp) {
            await AuditLog.create({
              actorType: 'PUBLIC_USER',
              action: 'APPLICATION_CREATED',
              targetEntity: 'APPLICATION',
              targetId: healedApp._id,
              ipAddress: req.ip || '127.0.0.1',
              userAgent: (req.headers && req.headers['user-agent']) || 'Unknown',
              summary: `Application ${healedApp.applicationId} self-healed for existing website participant ${existing.fullName} (${existing.email}) in ${cleanProgramCode}`
            });

            return res.status(201).json({
              success: true,
              message: 'Application submitted successfully. Status is currently pending admin review.',
              participant: {
                id: existing._id,
                fullName: existing.fullName,
                programTitle: existing.programTitle,
                completionStatus: existing.completionStatus
              },
              application: {
                applicationId: healedApp.applicationId,
                status: healedApp.status,
                appliedAt: healedApp.appliedAt,
                programTitle: healedApp.programTitle
              }
            });
          }
        }
      }

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
      batchId: configuredBatch,
      source: 'WEBSITE',
      completionStatus: 'PENDING'
    });

    try {
      await participant.save();
    } catch (saveErr) {
      if (saveErr.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'An application with this email address for this program and batch is already on file.'
        });
      }
      throw saveErr;
    }

    // Persist human-friendly Application with retry for rare unique-index collisions
    // FIX 1: Compensating rollback on failure deleting just-created participant
    let application = null;
    let attempts = 0;
    try {
      while (!application && attempts < 5) {
        attempts++;
        const candidateAppId = generateApplicationId();
        try {
          application = new Application({
            applicationId: candidateAppId,
            participantId: participant._id,
            programCode: participant.programCode,
            programTitle: participant.programTitle,
            batchId: participant.batchId,
            status: 'APPLIED',
            intakeSource: 'WEBSITE',
            feeLocked: Number(program.feeInr)
          });
          await application.save();
        } catch (appSaveErr) {
          if (appSaveErr.code === 11000) {
            // Check if duplicate key was on participantId (race)
            const racedApp = await Application.findOne({ participantId: participant._id });
            if (racedApp) {
              application = racedApp;
              break;
            }
            if (attempts < 5) {
              application = null;
              continue;
            }
          }
          throw appSaveErr;
        }
      }

      if (!application) {
        throw new Error('Failed to create unique Application after retries.');
      }
    } catch (appCreationErr) {
      console.error('[INTAKE_ROLLBACK] Application creation failed, removing stranded participant:', appCreationErr);
      try {
        await Participant.deleteOne({ _id: participant._id });
      } catch (rollbackErr) {
        console.error('[INTAKE_ROLLBACK_ERROR] Failed to delete stranded participant:', rollbackErr);
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to complete application registration. Please retry.'
      });
    }

    await AuditLog.create({
      actorType: 'PUBLIC_USER',
      action: 'INTAKE_SUBMITTED',
      targetEntity: 'PARTICIPANT',
      targetId: participant._id,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: (req.headers && req.headers['user-agent']) || 'Unknown',
      summary: `Website application submitted by ${participant.fullName} (${participant.email}) for ${cleanProgramCode}`
    });

    await AuditLog.create({
      actorType: 'PUBLIC_USER',
      action: 'APPLICATION_CREATED',
      targetEntity: 'APPLICATION',
      targetId: application._id,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: (req.headers && req.headers['user-agent']) || 'Unknown',
      summary: `Application ${application.applicationId} created for ${participant.fullName} (${participant.email}) in ${cleanProgramCode}`
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. Status is currently pending admin review.',
      participant: {
        id: participant._id,
        fullName: participant.fullName,
        programTitle: participant.programTitle,
        completionStatus: participant.completionStatus
      },
      application: {
        applicationId: application.applicationId,
        status: application.status,
        appliedAt: application.appliedAt,
        programTitle: application.programTitle
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public Application Status Lookup
 * Requires email and id query params as strings.
 * Compares normalized email against application's participant.
 * Returns identical generic 404 on any lookup failure to prevent enumeration.
 */
exports.getApplicationStatus = async (req, res, next) => {
  try {
    const { email, id } = req.query;

    // FIX 2: Strict string-only check and length caps (prevents object/array query injections)
    if (
      typeof email !== 'string' ||
      typeof id !== 'string' ||
      !email.trim() ||
      !id.trim() ||
      email.trim().length > 254 ||
      id.trim().length > 32
    ) {
      return res.status(400).json({
        success: false,
        message: 'Both email and application ID are required.'
      });
    }

    const cleanId = id.trim().toUpperCase();
    const normEmail = email.trim().toLowerCase();

    const application = await Application.findOne({ applicationId: cleanId }).populate('participantId');

    // On ANY failure - unknown id, missing participant, email mismatch - return identical generic 404
    if (!application || !application.participantId) {
      return res.status(404).json({
        success: false,
        message: 'No application found for the details provided.'
      });
    }

    const participantEmail = (application.participantId.normalizedEmail || application.participantId.email || '').toLowerCase().trim();
    if (participantEmail !== normEmail) {
      return res.status(404).json({
        success: false,
        message: 'No application found for the details provided.'
      });
    }

    const appData = {
      applicationId: application.applicationId,
      programTitle: application.programTitle,
      status: application.status,
      appliedAt: application.appliedAt
    };

    if (application.decidedAt) {
      appData.decidedAt = application.decidedAt;
    }

    if (application.status === 'REJECTED' && application.rejectionReason) {
      appData.rejectionReason = application.rejectionReason;
    }

    if (application.status === 'APPROVED') {
      const deliveryState = application.offerDeliveryState;
      const offerState = application.offerState;

      if (deliveryState === 'PROVIDER_ACCEPTED') {
        appData.offerStatus = 'Offer letter dispatched via email service provider.';
      } else if (deliveryState === 'SIMULATED') {
        appData.offerStatus = 'Application approved. Offer letter generated (delivery simulated in non-production mode).';
      } else if (deliveryState === 'BLOCKED_TEMPLATE' || offerState === 'BLOCKED_TEMPLATE') {
        appData.offerStatus = 'Offer letter is being prepared by admissions.';
      } else if (deliveryState === 'FAILED' || deliveryState === 'DELIVERY_UNKNOWN') {
        appData.offerStatus = 'Offer letter delivery is undergoing administrative verification by admissions.';
      } else {
        // Includes QUEUED, PROCESSING, GENERATED, NONE
        appData.offerStatus = 'Application approved. Offer letter preparation is in progress.';
      }

      // Module 5: approved students see their programme's tasks and learning material on the status page
      const program = await Program.findOne({ code: application.programCode }).select('tasks learningMaterials');
      if (program) {
        if (Array.isArray(program.tasks) && program.tasks.length > 0) {
          appData.tasks = program.tasks;
        }
        if (Array.isArray(program.learningMaterials) && program.learningMaterials.length > 0) {
          appData.learningMaterials = program.learningMaterials;
        }
      }
    }

    if (typeof application.feeLocked === 'number') {
      appData.feeLocked = application.feeLocked;
    }

    return res.status(200).json({
      success: true,
      application: appData
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
