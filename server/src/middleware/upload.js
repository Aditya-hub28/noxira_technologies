const multer = require('multer');

// Memory storage for CSV files
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const isCsvExt = file.originalname.toLowerCase().endsWith('.csv');

  if (allowedMimes.includes(file.mimetype) || isCsvExt) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files (.csv) are allowed for import'), false);
  }
};

const uploadCsv = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max limit
  },
  fileFilter
});

module.exports = { uploadCsv };
