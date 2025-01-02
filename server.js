const https = require('https');

const cors = require('cors');
const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
require('dotenv').config();
const fs = require('fs');


const app = express();
app.use(cors());

const port = process.env.PORT || 5000;

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save files to the 'uploads' folder in the project directory
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    // Name the file with a timestamp to avoid conflicts
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Configure your S3-compatible storage

const s3 = new AWS.S3({
  endpoint: process.env.AWS_ENDPOINT,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  s3ForcePathStyle: true,  // Ensure path-style URL format (some S3-compatible services require this)
  signatureVersion: 'v4',
  httpOptions: {
    rejectUnauthorized: false, // Disable SSL verification for testing
  },
});

/**
 * Upload a file to S3-compatible storage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */


const storageMulterS3 = multerS3({
  s3: s3,
  bucket: process.env.AWS_BUCKET_NAME, // Your S3 bucket name
  acl: 'public-read', // File permissions (can be public or private)
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    // Use a unique file name with a 'public/' prefix and timestamp
    const uniqueKey = `public/${Date.now().toString()}-${file.originalname}`;
    cb(null, uniqueKey);
  },
});



// Initialize Multer with the storage configuration
const uploadMulter = multer({ storage: storage });

const uploadMulterS3 = multer({ storage: storageMulterS3 });


// Define the upload route normal 
app.post('/upload', uploadMulter.single('file'), (req, res) => {
  try {
    if (req.file) {
      res.status(200).json({
        message: 'File uploaded successfully',
        filePath: `/uploads/${req.file.filename}`
      });
    } else {
      res.status(400).json({ message: 'File upload failed' });
    }
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ message: 'An error occurred while uploading the file', error: error.message });
  }
});

// Define the upload route to aws
app.post('/uploadmulters3', uploadMulterS3.single('file'), (req, res) => {
  try {
    const file = req.file; // Assuming you use multer for file uploads

    if (file) {
      //Start Optional part because N0c Storage need
      // Construct the custom URL using the key without "public/"
      const customDomain = process.env.CUSTOM_ENDPOINT;
      const cleanedKey = file.key.replace(/^public\//, ''); // Remove the "public/" prefix
      const secureUrl = `${customDomain}/${cleanedKey}`;
      //End Optional part

      // Return a detailed response
      return res.status(200).json({
        url: file.location,  // URL of the uploaded file
        secureUrl,               // Custom domain URL
        fileName: path.basename(file.key), // File name from the S3 key
        etag: file.etag.replace(/"/g, ''),
        key: file.key,       // Full key (path to file)
        file: file

      });
    } else {
      res.status(400).json({ message: 'File upload failed' });
    }
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ message: 'An error occurred while uploading the file', error: error.message });
  }
});



// Initialize Multer with the storage configuration
const uploadLocal = multer({ storage: storage });

// Route to upload file to local storage and then to S3 AWS sdk

app.post('/uploadsawssdk', uploadLocal.single('file'), (req, res) => {
  try {
    const file = req.file; // Assuming you use multer for file uploads

    if (!file) {
      return res.status(400).json({ error: 'No file was uploaded' });
    }

    // Configure your S3-compatible storage
    const s3 = new AWS.S3({
      endpoint: process.env.AWS_ENDPOINT,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      s3ForcePathStyle: true,  // Ensure path-style URL format (some S3-compatible services require this)
      signatureVersion: 'v4',
      httpOptions: {
        rejectUnauthorized: false, // Disable SSL verification for testing
      },
    });

    const bucket = process.env.AWS_BUCKET_NAME;
    // verify if you need public. Is need when use N0c storage
    const key = `public/${path.basename(file.originalname)}`; // Construct the file path in the bucket
    // Upload the file to S3
    const result = s3
      .upload({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: fs.createReadStream(file.path),
        ACL: 'public-read', // File permissions | private
      })
      .promise();

    // Create a custom URL using a custom domain
    const customDomain = process.env.CUSTOM_ENDPOINT;
    const secureUrl = `${customDomain}/${path.basename(file.originalname)}`;

    // Delete the temporary file after upload
    fs.unlinkSync(file.path);

    // Return a detailed response
    return res.status(200).json({
      url: result.Location, // URL of the uploaded file
      secureUrl,            // Custom domain URL
      fileName: path.basename(key), // File name
      etag: result.ETag, // MD5 hash (trim quotes)
      bucket,               // Bucket name
      key,                  // Full key (path to file)

    });
  } catch (error) {
    console.error('S3 Upload Error:', error);
    return res.status(500).json({
      error: 'S3 upload error',
      message: error.message,
    });
  }
});


// Serve the uploaded files as static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.get('/api', (req, res) => {
  res.status(200).send({
    success: 'true',
    message: "Bienvenu a API upload Donilab ",
    version: '1.0.0',
  });
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
