const csv = require('csv-parser');
const { Readable } = require('stream');
const Participant = require('../models/Participant');
const Program = require('../models/Program');
const ImportBatch = require('../models/ImportBatch');
const AuditLog = require('../models/AuditLog');
const Application = require('../models/Application');
const { generateApplicationId } = require('../models/Application');
const Setting = require('../models/Setting');

/**
 * Parses CSV buffer into structured rows and headers.
 * Strips UTF-8 BOM on the first header and detects duplicate headers.
 */
function parseForm1CsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    if (!buffer || buffer.length === 0) {
      return reject(new Error('CSV file is empty'));
    }

    const rawRows = [];
    let detectedHeaders = null;
    let headerError = null;

    const stream = Readable.from(buffer);
    const parser = csv({
      trim: true,
      mapHeaders: ({ header, index }) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim()
    });

    parser.on('headers', (headers) => {
      detectedHeaders = headers;
      const seen = new Set();
      const duplicates = [];

      for (const h of headers) {
        if (seen.has(h)) {
          duplicates.push(h);
        } else {
          seen.add(h);
        }
      }

      if (duplicates.length > 0) {
        headerError = new Error(`CSV file contains duplicate column header(s): ${duplicates.map((d) => `"${d}"`).join(', ')}. Please rename duplicate columns in the sheet and re-export.`);
        headerError.code = 'DUPLICATE_HEADERS';
        headerError.duplicates = duplicates;
      }
    });

    parser.on('data', (row) => {
      if (!headerError) {
        rawRows.push(row);
      }
    });

    parser.on('end', () => {
      if (headerError) {
        return reject(headerError);
      }
      if (!detectedHeaders || detectedHeaders.length === 0 || rawRows.length === 0) {
        return reject(new Error('CSV file is empty'));
      }
      resolve({ headers: detectedHeaders, rows: rawRows });
    });

    parser.on('error', (err) => {
      reject(err);
    });

    stream.pipe(parser);
  });
}

/**
 * Fuzzy header matcher for auto-suggestions.
 */
function suggestColumnMapping(headers, savedMappings = []) {
  const TARGET_DEFINITIONS = [
    { target: 'email', required: true, regex: /email|mail/i },
    { target: 'fullName', required: true, regex: /^(full\s*)?name|student(\s*name)?$/i, fallbackRegex: /name/i, excludeRegex: /college|university|institute|father|mother|school/i },
    { target: 'domain', required: true, regex: /domain|internship|track|stream|programme|specialization/i },
    { target: 'phone', required: false, regex: /phone|mobile|contact|whatsapp.*no|whatsapp.*num/i },
    { target: 'gender', required: false, regex: /gender|sex/i },
    { target: 'country', required: false, regex: /country|nation/i },
    { target: 'college', required: false, regex: /college|university|institute|school|campus/i },
    { target: 'qualification', required: false, regex: /qualification|degree|education|branch|course/i },
    { target: 'currentYear', required: false, regex: /current.*year|year.*study|academic.*year|\byear\b/i },
    { target: 'referralSource', required: false, regex: /referral|hear|source|how.*know|where.*hear/i },
    { target: 'linkedinFollow', required: false, regex: /linkedin/i },
    { target: 'whatsappJoin', required: false, regex: /whatsapp.*(group|join)|join.*whatsapp/i },
    { target: 'timestamp', required: false, regex: /timestamp|submission.*time|time/i }
  ];

  const assignedHeaders = new Set();
  const suggestions = [];

  // 1. Try saved mappings first
  for (const def of TARGET_DEFINITIONS) {
    const saved = savedMappings.find((m) => m.target === def.target);
    if (saved && headers.includes(saved.header) && !assignedHeaders.has(saved.header)) {
      suggestions.push({ target: def.target, header: saved.header, required: def.required });
      assignedHeaders.add(saved.header);
    }
  }

  // 2. Fuzzy match remaining unassigned targets
  for (const def of TARGET_DEFINITIONS) {
    if (suggestions.some((s) => s.target === def.target)) continue;

    let matchedHeader = null;
    for (const h of headers) {
      if (assignedHeaders.has(h)) continue;
      if (def.excludeRegex && def.excludeRegex.test(h)) continue;

      if (def.regex.test(h)) {
        matchedHeader = h;
        break;
      }
    }

    if (!matchedHeader && def.fallbackRegex) {
      for (const h of headers) {
        if (assignedHeaders.has(h)) continue;
        if (def.excludeRegex && def.excludeRegex.test(h)) continue;
        if (def.fallbackRegex.test(h)) {
          matchedHeader = h;
          break;
        }
      }
    }

    if (matchedHeader) {
      suggestions.push({ target: def.target, header: matchedHeader, required: def.required });
      assignedHeaders.add(matchedHeader);
    } else {
      suggestions.push({ target: def.target, header: '', required: def.required });
    }
  }

  return suggestions;
}

/**
 * Auto-suggests programme codes for distinct domain values:
 * Matches ONLY exact title or code (case-insensitive, trimmed). Never guesses.
 */
function suggestDomainMapping(distinctDomains, activePrograms, savedDomainMappings = []) {
  const domainSuggestions = [];

  for (const rawDomain of distinctDomains) {
    const cleanDomain = (rawDomain || '').trim();
    if (!cleanDomain) continue;

    // Check saved mapping first
    const saved = savedDomainMappings.find((m) => m.value && m.value.trim().toLowerCase() === cleanDomain.toLowerCase());
    if (saved && activePrograms.some((p) => p.code === saved.programCode)) {
      domainSuggestions.push({ value: cleanDomain, programCode: saved.programCode });
      continue;
    }

    // Exact match ONLY against active programme code or title
    const exactMatch = activePrograms.find((p) =>
      p.code.trim().toLowerCase() === cleanDomain.toLowerCase() ||
      p.title.trim().toLowerCase() === cleanDomain.toLowerCase()
    );

    if (exactMatch) {
      domainSuggestions.push({ value: cleanDomain, programCode: exactMatch.code });
    } else {
      domainSuggestions.push({ value: cleanDomain, programCode: '__UNMAPPED__' });
    }
  }

  return domainSuggestions;
}

/**
 * Preview Form 1 CSV upload
 * POST /api/v1/intake/form1-preview
 */
exports.previewForm1 = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const { batchId, columnMapping, domainMapping } = req.body;
    const cleanBatch = typeof batchId === 'string' ? batchId.trim().toUpperCase() : '';

    if (!cleanBatch) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID is required. Please specify a non-empty batch ID.'
      });
    }

    // Parse CSV buffer
    let parsed;
    try {
      parsed = await parseForm1CsvBuffer(req.file.buffer);
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: parseErr.message,
        duplicates: parseErr.duplicates
      });
    }

    const { headers, rows: rawRows } = parsed;

    if (rawRows.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'CSV exceeds limit of 1,000 rows per batch'
      });
    }

    // Load active programs and settings
    const activePrograms = await Program.find({ isActive: true }).select('code title durationWeeks feeInr isActive').lean();
    const setting = await Setting.findOne({ key: 'site' }).lean();
    const savedColMap = setting?.form1ColumnMapping || [];
    const savedDomMap = setting?.form1DomainMapping || [];

    // Parse confirmed column and domain mappings if passed
    let parsedColMap = null;
    if (columnMapping) {
      try {
        parsedColMap = typeof columnMapping === 'string' ? JSON.parse(columnMapping) : columnMapping;
      } catch (e) {
        parsedColMap = null;
      }
    }

    let parsedDomMap = null;
    if (domainMapping) {
      try {
        parsedDomMap = typeof domainMapping === 'string' ? JSON.parse(domainMapping) : domainMapping;
      } catch (e) {
        parsedDomMap = null;
      }
    }

    // Generate column suggestions
    const columnSuggestions = suggestColumnMapping(headers, savedColMap);

    // Identify active domain column to gather distinct values
    const effectiveColMap = Array.isArray(parsedColMap) && parsedColMap.length > 0 ? parsedColMap : columnSuggestions;
    const domainColEntry = effectiveColMap.find((m) => m.target === 'domain' && m.header);
    const domainHeader = domainColEntry ? domainColEntry.header : '';

    const distinctDomains = [];
    if (domainHeader && headers.includes(domainHeader)) {
      const seen = new Set();
      for (const r of rawRows) {
        const val = r[domainHeader] ? String(r[domainHeader]).trim() : '';
        if (val && !seen.has(val)) {
          seen.add(val);
          distinctDomains.push(val);
        }
      }
    }

    // Generate domain suggestions
    const domainSuggestions = suggestDomainMapping(distinctDomains, activePrograms, savedDomMap);
    const effectiveDomMap = Array.isArray(parsedDomMap) && parsedDomMap.length > 0 ? parsedDomMap : domainSuggestions;

    // Check if required columns are mapped
    const emailColEntry = effectiveColMap.find((m) => m.target === 'email' && m.header);
    const nameColEntry = effectiveColMap.find((m) => m.target === 'fullName' && m.header);

    const hasRequiredColumns = !!(emailColEntry && nameColEntry && domainColEntry);

    // If required columns are not mapped, return structure for column/domain mapping setup
    if (!hasRequiredColumns) {
      return res.json({
        success: true,
        stage: 'MAPPING_REQUIRED',
        headers,
        totalRows: rawRows.length,
        columnSuggestions,
        distinctDomains,
        domainSuggestions,
        programs: activePrograms.map((p) => ({
          code: p.code,
          title: p.title,
          durationWeeks: p.durationWeeks,
          feeInr: p.feeInr,
          isCurrentOffering: p.durationWeeks === 4 && p.feeInr === 99
        }))
      });
    }

    // We have column mapping, now evaluate rows for preview
    const emailHeader = emailColEntry.header;
    const nameHeader = nameColEntry.header;

    const mappedHeaderSet = new Set(effectiveColMap.filter((m) => m.header).map((m) => m.header));
    const optionalTargets = ['phone', 'gender', 'country', 'college', 'qualification', 'currentYear', 'referralSource', 'linkedinFollow', 'whatsappJoin', 'timestamp'];
    const targetToHeader = {};
    for (const t of optionalTargets) {
      const entry = effectiveColMap.find((m) => m.target === t && m.header);
      targetToHeader[t] = entry ? entry.header : '';
    }

    // Index programs by code
    const programMap = new Map();
    for (const p of activePrograms) {
      programMap.set(p.code.toUpperCase(), p);
    }

    // Index domain mapping
    const domainToProgramCode = new Map();
    for (const dm of effectiveDomMap) {
      if (dm && dm.value) {
        domainToProgramCode.set(dm.value.trim().toLowerCase(), dm.programCode ? dm.programCode.trim().toUpperCase() : '__UNMAPPED__');
      }
    }

    const previewRows = [];
    let validCount = 0;
    let linkableCount = 0;
    let duplicateInDbCount = 0;
    let duplicateInFileCount = 0;
    let invalidCount = 0;
    let needsProgramCount = 0;
    let needsNormalizationCount = 0;
    let skippedCount = 0;

    const seenInFile = new Set();

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const rowIndex = i + 1;
      const rawEmail = r[emailHeader] ? String(r[emailHeader]).trim() : '';
      const rawName = r[nameHeader] ? String(r[nameHeader]).trim() : '';
      const rawDomain = r[domainHeader] ? String(r[domainHeader]).trim() : '';

      const errors = [];
      let status = 'VALID';
      let mappedProgramCode = '';
      let mappedProgramTitle = '';

      // Format validations
      if (!rawEmail || !/^\S+@\S+\.\S+$/.test(rawEmail)) {
        errors.push('Missing or invalid email');
        status = 'INVALID';
      }
      if (!rawName || rawName.length < 2) {
        errors.push('Name missing or fewer than 2 characters');
        status = 'INVALID';
      }
      if (!rawDomain) {
        errors.push('Missing internship domain');
        status = 'INVALID';
      }

      if (status !== 'INVALID') {
        const domainKey = rawDomain.toLowerCase();
        const progCode = domainToProgramCode.get(domainKey) || '__UNMAPPED__';

        if (progCode === '__UNMAPPED__') {
          errors.push(`Internship domain "${rawDomain}" is not mapped to any programme`);
          status = 'NEEDS_PROGRAM';
          needsProgramCount++;
        } else if (progCode === '__SKIP__') {
          status = 'SKIPPED';
          skippedCount++;
        } else {
          mappedProgramCode = progCode;
          const prog = programMap.get(progCode);

          if (!prog || !prog.isActive || prog.durationWeeks !== 4 || prog.feeInr !== 99) {
            errors.push(`Programme ${progCode} requires normalization (must be 4 weeks & ₹99)`);
            status = 'NEEDS_NORMALIZATION';
            needsNormalizationCount++;
          } else {
            mappedProgramTitle = prog.title;
            const normEmail = rawEmail.toLowerCase();
            const compositeKey = `${normEmail}|${progCode}|${cleanBatch}`;

            if (seenInFile.has(compositeKey)) {
              status = 'DUPLICATE_IN_FILE';
              errors.push('Duplicate entry inside this CSV file');
              duplicateInFileCount++;
            } else {
              seenInFile.add(compositeKey);

              // Check database for existing participant
              const existing = await Participant.findOne({
                normalizedEmail: normEmail,
                programCode: progCode,
                batchId: cleanBatch
              });

              if (existing) {
                // Check if application exists
                const existingApp = await Application.findOne({ participantId: existing._id });
                if (existingApp) {
                  status = 'DUPLICATE_IN_DB';
                  errors.push('Already registered in database with an application');
                  duplicateInDbCount++;
                } else {
                  // Check if linkable
                  let isLinkable = false;
                  if (existing.source === 'WEBSITE') {
                    isLinkable = true;
                  } else if (existing.source === 'CSV_IMPORT' && existing.sourceImportBatchId) {
                    const parentBatch = await ImportBatch.findById(existing.sourceImportBatchId).select('kind').lean();
                    if (parentBatch && parentBatch.kind === 'FORM1_RESPONSES') {
                      isLinkable = true;
                    }
                  }

                  if (isLinkable) {
                    status = 'LINKABLE';
                    linkableCount++;
                  } else {
                    status = 'DUPLICATE_IN_DB';
                    errors.push('Existing participant cannot be linked (belongs to certificate import batch)');
                    duplicateInDbCount++;
                  }
                }
              } else {
                status = 'VALID';
                validCount++;
              }
            }
          }
        }
      } else {
        invalidCount++;
      }

      // Collect extra unmapped headers for preview
      const form1Extra = [];
      for (const h of headers) {
        if (!mappedHeaderSet.has(h)) {
          form1Extra.push({
            header: h,
            value: r[h] !== undefined && r[h] !== null ? String(r[h]).trim() : ''
          });
        }
      }

      previewRows.push({
        rowIndex,
        fullName: rawName,
        email: rawEmail.toLowerCase(),
        domain: rawDomain,
        programCode: mappedProgramCode,
        programTitle: mappedProgramTitle,
        batchId: cleanBatch,
        status,
        errors,
        phone: targetToHeader.phone ? (r[targetToHeader.phone] || '') : '',
        gender: targetToHeader.gender ? (r[targetToHeader.gender] || '') : '',
        country: targetToHeader.country ? (r[targetToHeader.country] || '') : '',
        college: targetToHeader.college ? (r[targetToHeader.college] || '') : '',
        qualification: targetToHeader.qualification ? (r[targetToHeader.qualification] || '') : '',
        currentYear: targetToHeader.currentYear ? (r[targetToHeader.currentYear] || '') : '',
        referralSource: targetToHeader.referralSource ? (r[targetToHeader.referralSource] || '') : '',
        linkedinFollow: targetToHeader.linkedinFollow ? (r[targetToHeader.linkedinFollow] || '') : '',
        whatsappJoin: targetToHeader.whatsappJoin ? (r[targetToHeader.whatsappJoin] || '') : '',
        form1Timestamp: targetToHeader.timestamp ? (r[targetToHeader.timestamp] || '') : '',
        form1Extra
      });
    }

    res.json({
      success: true,
      stage: 'PREVIEW',
      stats: {
        totalRows: rawRows.length,
        validCount,
        linkableCount,
        duplicateInDbCount,
        duplicateInFileCount,
        invalidCount,
        needsProgramCount,
        needsNormalizationCount,
        skippedCount
      },
      headers,
      columnMapping: effectiveColMap,
      columnSuggestions,
      distinctDomains,
      domainSuggestions,
      domainMapping: effectiveDomMap,
      previewRows: previewRows.slice(0, 100),
      fullRows: previewRows,
      canCommit: (validCount + linkableCount > 0) && needsProgramCount === 0 && needsNormalizationCount === 0
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Commit Form 1 CSV responses into Participants and Applications
 * POST /api/v1/intake/form1-commit
 */
exports.commitForm1 = async (req, res, next) => {
  try {
    const { rows, batchId, columnMapping, domainMapping, fileName, fileSizeBytes } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided to commit' });
    }

    if (rows.length > 1000) {
      return res.status(400).json({ success: false, message: 'CSV exceeds limit of 1,000 rows per batch' });
    }

    const cleanBatch = typeof batchId === 'string' ? batchId.trim().toUpperCase() : '';
    if (!cleanBatch) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID is required. Please specify a non-empty batch ID.'
      });
    }

    // Parse confirmed mappings
    let confirmedColMap = columnMapping;
    if (typeof confirmedColMap === 'string') {
      try { confirmedColMap = JSON.parse(confirmedColMap); } catch (e) { confirmedColMap = []; }
    }
    let confirmedDomMap = domainMapping;
    if (typeof confirmedDomMap === 'string') {
      try { confirmedDomMap = JSON.parse(confirmedDomMap); } catch (e) { confirmedDomMap = []; }
    }

    if (!Array.isArray(confirmedColMap) || !Array.isArray(confirmedDomMap)) {
      return res.status(400).json({ success: false, message: 'Invalid column or domain mapping format' });
    }

    // Verify required target mappings
    const emailCol = confirmedColMap.find((m) => m.target === 'email' && m.header);
    const nameCol = confirmedColMap.find((m) => m.target === 'fullName' && m.header);
    const domainCol = confirmedColMap.find((m) => m.target === 'domain' && m.header);

    if (!emailCol || !nameCol || !domainCol) {
      return res.status(400).json({
        success: false,
        message: 'Required column mappings (Email, Full name, Internship domain) must be mapped'
      });
    }

    // Domain mapping lookup map
    const domainToProgramCode = new Map();
    for (const dm of confirmedDomMap) {
      if (dm && dm.value) {
        domainToProgramCode.set(dm.value.trim().toLowerCase(), dm.programCode ? dm.programCode.trim().toUpperCase() : '__UNMAPPED__');
      }
    }

    // Fresh reload of all mapped programmes
    const distinctProgramCodes = Array.from(new Set(
      confirmedDomMap
        .map((dm) => dm.programCode ? dm.programCode.trim().toUpperCase() : '')
        .filter((code) => code && code !== '__UNMAPPED__' && code !== '__SKIP__')
    ));

    const reloadedPrograms = await Program.find({ code: { $in: distinctProgramCodes } });
    const programMap = new Map();
    for (const p of reloadedPrograms) {
      programMap.set(p.code.toUpperCase(), p);
    }

    // Check if any domain mapping is unmapped
    for (const r of rows) {
      const rowDomain = (r.domain || (domainCol && r[domainCol.header]) || '').trim();
      if (rowDomain) {
        const mappedCode = domainToProgramCode.get(rowDomain.toLowerCase());
        if (!mappedCode || mappedCode === '__UNMAPPED__') {
          return res.status(400).json({
            success: false,
            message: `Domain value "${rowDomain}" is unmapped. All domain values must be mapped or skipped before committing.`
          });
        }
      }
    }

    // Pre-create ImportBatch document BEFORE writing any Participant
    const importBatch = new ImportBatch({
      fileName: fileName || 'form1_responses.csv',
      fileSizeBytes: typeof fileSizeBytes === 'number' ? fileSizeBytes : undefined,
      uploadedBy: req.admin._id,
      kind: 'FORM1_RESPONSES',
      batchId: cleanBatch,
      columnMapping: confirmedColMap,
      domainMapping: confirmedDomMap,
      totalRows: rows.length,
      validRows: 0,
      duplicateRows: 0,
      errorRows: 0,
      status: 'PREVIEW'
    });
    await importBatch.save();

    // Persist confirmed mappings to Setting for future pre-filling
    await Setting.findOneAndUpdate(
      { key: 'site' },
      {
        $set: {
          form1ColumnMapping: confirmedColMap,
          form1DomainMapping: confirmedDomMap
        }
      },
      { upsert: true, new: true }
    );

    const importedApps = [];
    const linkedApps = [];
    const duplicateList = [];
    const invalidList = [];
    const needsProgramSkippedList = [];
    const errorList = [];
    const allCreatedApplications = [];

    const seenInCommit = new Set();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowIndex = r.rowIndex || (i + 1);

      // Extract raw or mapped values
      const rawEmail = (r.email || (emailCol && r[emailCol.header]) || '').trim();
      const rawName = (r.fullName || (nameCol && r[nameCol.header]) || '').trim();
      const rawDomain = (r.domain || (domainCol && r[domainCol.header]) || '').trim();

      // Field format validation
      if (!rawEmail || !/^\S+@\S+\.\S+$/.test(rawEmail)) {
        invalidList.push({ rowIndex, email: rawEmail, error: 'Missing or invalid email' });
        continue;
      }
      if (!rawName || rawName.length < 2) {
        invalidList.push({ rowIndex, email: rawEmail, error: 'Name missing or fewer than 2 characters' });
        continue;
      }
      if (!rawDomain) {
        invalidList.push({ rowIndex, email: rawEmail, error: 'Missing internship domain' });
        continue;
      }

      const domainKey = rawDomain.toLowerCase();
      const progCode = domainToProgramCode.get(domainKey);

      if (progCode === '__SKIP__') {
        needsProgramSkippedList.push({ rowIndex, domain: rawDomain, reason: 'Skipped by admin mapping' });
        continue;
      }

      if (!progCode || progCode === '__UNMAPPED__') {
        needsProgramSkippedList.push({ rowIndex, domain: rawDomain, reason: 'Unmapped domain' });
        continue;
      }

      // Re-verify programme fresh
      const program = programMap.get(progCode);
      if (!program || !program.isActive || program.durationWeeks !== 4 || program.feeInr !== 99) {
        errorList.push({
          rowIndex,
          email: rawEmail,
          programCode: progCode,
          error: `Programme ${progCode} requires normalization (must be 4 weeks & ₹99) and was blocked.`
        });
        continue;
      }

      const normEmail = rawEmail.toLowerCase();
      const cleanProgramCode = program.code.toUpperCase();
      const programTitle = program.title;
      const feeLocked = Number(program.feeInr);
      const compositeKey = `${normEmail}|${cleanProgramCode}|${cleanBatch}`;

      // In-batch duplicate check
      if (seenInCommit.has(compositeKey)) {
        duplicateList.push({ rowIndex, email: normEmail, programCode: cleanProgramCode, reason: 'Duplicate inside submitted batch' });
        continue;
      }
      seenInCommit.add(compositeKey);

      // Check DB for existing participant
      let existing = await Participant.findOne({
        normalizedEmail: normEmail,
        programCode: cleanProgramCode,
        batchId: cleanBatch
      });

      if (existing) {
        const existingApp = await Application.findOne({ participantId: existing._id });
        if (existingApp) {
          duplicateList.push({ rowIndex, email: normEmail, programCode: cleanProgramCode, reason: 'Already registered in database with an application' });
          continue;
        }

        // Linkable check
        let isLinkable = false;
        let appIntakeSource = 'FORM1_IMPORT';
        if (existing.source === 'WEBSITE') {
          isLinkable = true;
          appIntakeSource = 'WEBSITE';
        } else if (existing.source === 'CSV_IMPORT' && existing.sourceImportBatchId) {
          const parentBatch = await ImportBatch.findById(existing.sourceImportBatchId).select('kind').lean();
          if (parentBatch && parentBatch.kind === 'FORM1_RESPONSES') {
            isLinkable = true;
            appIntakeSource = 'FORM1_IMPORT';
          }
        }

        if (!isLinkable) {
          duplicateList.push({ rowIndex, email: normEmail, programCode: cleanProgramCode, reason: 'Existing participant belongs to certificate import batch (cannot link)' });
          continue;
        }

        // Create ONLY Application for existing linkable participant
        let application = null;
        let attempts = 0;
        try {
          while (!application && attempts < 5) {
            attempts++;
            const candidateAppId = generateApplicationId();
            try {
              application = new Application({
                applicationId: candidateAppId,
                participantId: existing._id,
                programCode: cleanProgramCode,
                programTitle,
                batchId: cleanBatch,
                status: 'APPLIED',
                intakeSource: appIntakeSource,
                feeLocked
              });
              await application.save();
            } catch (appErr) {
              if (appErr.code === 11000) {
                const racedApp = await Application.findOne({ participantId: existing._id });
                if (racedApp) {
                  application = racedApp;
                  break;
                }
                if (attempts < 5) continue;
              }
              throw appErr;
            }
          }

          if (application) {
            await AuditLog.create({
              actorType: 'ADMIN',
              actorId: req.admin._id,
              action: 'APPLICATION_CREATED',
              targetEntity: 'APPLICATION',
              targetId: application._id,
              ipAddress: req.ip || '127.0.0.1',
              userAgent: (req.headers && req.headers['user-agent']) || 'Unknown',
              summary: `Application ${application.applicationId} linked for existing participant ${existing.fullName} (${existing.email}) in ${cleanProgramCode}`
            });

            linkedApps.push({
              applicationId: application.applicationId,
              fullName: existing.fullName,
              email: existing.email,
              programCode: cleanProgramCode,
              programTitle
            });

            allCreatedApplications.push({
              applicationId: application.applicationId,
              fullName: existing.fullName,
              email: existing.email,
              programCode: cleanProgramCode,
              programTitle,
              batchId: cleanBatch
            });
            continue;
          }
        } catch (linkErr) {
          errorList.push({ rowIndex, email: normEmail, error: linkErr.message });
          continue;
        }
      }

      // New VALID row: Create Participant + Application
      const rawPhone = r.phone || '';
      const rawGender = r.gender || '';
      const rawCountry = r.country || '';
      const rawCollege = r.college || '';
      const rawQualification = r.qualification || '';
      const rawCurrentYear = r.currentYear || '';
      const rawReferralSource = r.referralSource || '';
      const rawLinkedinFollow = r.linkedinFollow || '';
      const rawWhatsappJoin = r.whatsappJoin || '';
      const rawTimestamp = r.form1Timestamp || '';
      const form1Extra = Array.isArray(r.form1Extra) ? r.form1Extra : [];

      const participant = new Participant({
        fullName: rawName,
        email: normEmail,
        phone: rawPhone.trim(),
        programCode: cleanProgramCode,
        programTitle,
        batchId: cleanBatch,
        source: 'CSV_IMPORT',
        sourceImportBatchId: importBatch._id,
        gender: rawGender.trim() || undefined,
        country: rawCountry.trim() || undefined,
        college: rawCollege.trim() || undefined,
        qualification: rawQualification.trim() || undefined,
        currentYear: rawCurrentYear.trim() || undefined,
        referralSource: rawReferralSource.trim() || undefined,
        linkedinFollow: rawLinkedinFollow.trim() || undefined,
        whatsappJoin: rawWhatsappJoin.trim() || undefined,
        form1Timestamp: rawTimestamp.trim() || undefined,
        form1Extra: form1Extra.length > 0 ? form1Extra : undefined,
        completionStatus: 'PENDING'
      });

      try {
        await participant.save();
      } catch (saveErr) {
        if (saveErr.code === 11000) {
          // Raced duplicate on participant creation - re-check
          const racedParticipant = await Participant.findOne({
            normalizedEmail: normEmail,
            programCode: cleanProgramCode,
            batchId: cleanBatch
          });

          if (racedParticipant) {
            const racedApp = await Application.findOne({ participantId: racedParticipant._id });
            if (racedApp) {
              duplicateList.push({ rowIndex, email: normEmail, programCode: cleanProgramCode, reason: 'Already registered in database with an application' });
              continue;
            }
          }
        }
        errorList.push({ rowIndex, email: normEmail, error: saveErr.message });
        continue;
      }

      // Create Application with retry and compensating rollback
      let application = null;
      let attempts = 0;
      let appCreationErr = null;

      try {
        while (!application && attempts < 5) {
          attempts++;
          const candidateAppId = generateApplicationId();
          try {
            application = new Application({
              applicationId: candidateAppId,
              participantId: participant._id,
              programCode: cleanProgramCode,
              programTitle,
              batchId: cleanBatch,
              status: 'APPLIED',
              intakeSource: 'FORM1_IMPORT',
              feeLocked
            });
            await application.save();
          } catch (appErr) {
            if (appErr.code === 11000) {
              const racedApp = await Application.findOne({ participantId: participant._id });
              if (racedApp) {
                application = racedApp;
                break;
              }
              if (attempts < 5) continue;
            }
            throw appErr;
          }
        }
        if (!application) {
          throw new Error('Failed to create unique Application after retries.');
        }
      } catch (err) {
        appCreationErr = err;
      }

      if (appCreationErr || !application) {
        // Re-check one last time: if another concurrent process created it, keep participant
        const lastCheckApp = await Application.findOne({ participantId: participant._id });
        if (lastCheckApp) {
          application = lastCheckApp;
          linkedApps.push({
            applicationId: application.applicationId,
            fullName: participant.fullName,
            email: participant.email,
            programCode: cleanProgramCode,
            programTitle
          });
          allCreatedApplications.push({
            applicationId: application.applicationId,
            fullName: participant.fullName,
            email: participant.email,
            programCode: cleanProgramCode,
            programTitle,
            batchId: cleanBatch
          });
        } else {
          // Compensating rollback: delete just-created participant
          try {
            await Participant.deleteOne({ _id: participant._id });
          } catch (rbErr) {
            console.error('[FORM1_ROLLBACK_ERROR] Failed to delete stranded participant:', rbErr);
          }
          errorList.push({ rowIndex, email: normEmail, error: appCreationErr?.message || 'Application creation failed' });
          continue;
        }
      } else {
        await AuditLog.create({
          actorType: 'ADMIN',
          actorId: req.admin._id,
          action: 'APPLICATION_CREATED',
          targetEntity: 'APPLICATION',
          targetId: application._id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.headers && req.headers['user-agent']) || 'Unknown',
          summary: `Application ${application.applicationId} created for ${participant.fullName} (${participant.email}) in ${cleanProgramCode}`
        });

        importedApps.push({
          applicationId: application.applicationId,
          fullName: participant.fullName,
          email: participant.email,
          programCode: cleanProgramCode,
          programTitle
        });

        allCreatedApplications.push({
          applicationId: application.applicationId,
          fullName: participant.fullName,
          email: participant.email,
          programCode: cleanProgramCode,
          programTitle,
          batchId: cleanBatch
        });
      }
    }

    // Finalize ImportBatch counts & status
    importBatch.validRows = importedApps.length + linkedApps.length;
    importBatch.duplicateRows = duplicateList.length;
    importBatch.errorRows = invalidList.length + errorList.length;
    importBatch.status = 'COMMITTED';
    await importBatch.save();

    // Audit summary log
    await AuditLog.create({
      actorType: 'ADMIN',
      actorId: req.admin._id,
      action: 'FORM1_COMMITTED',
      targetEntity: 'APPLICATION',
      targetId: importBatch._id,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: (req.headers && req.headers['user-agent']) || 'Unknown',
      summary: `Form 1 import committed: ${importedApps.length} created, ${linkedApps.length} linked, ${duplicateList.length} duplicates skipped, ${invalidList.length} invalid, ${errorList.length} errors for batch ${cleanBatch}`
    });

    res.status(200).json({
      success: true,
      message: `Form 1 import committed: ${importedApps.length} applications created, ${linkedApps.length} linked.`,
      counts: {
        total: rows.length,
        imported: importedApps.length,
        linked: linkedApps.length,
        duplicatesSkipped: duplicateList.length,
        invalidRejected: invalidList.length,
        needsProgramSkipped: needsProgramSkippedList.length,
        errors: errorList.length
      },
      details: {
        imported: importedApps.slice(0, 50),
        linked: linkedApps.slice(0, 50),
        duplicates: duplicateList.slice(0, 50),
        invalid: invalidList.slice(0, 50),
        needsProgramSkipped: needsProgramSkippedList.slice(0, 50),
        errors: errorList.slice(0, 50)
      },
      createdApplications: allCreatedApplications
    });
  } catch (error) {
    next(error);
  }
};
