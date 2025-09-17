const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../services/fileUpload');

const router = express.Router();

// Upload single file
router.post('/single', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const folder = req.body.folder || 'glowup-channel';
    const result = await uploadToCloudinary(req.file, folder);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed'
    });
  }
});

// Upload multiple files
router.post('/multiple', authenticateToken, upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided'
      });
    }

    const folder = req.body.folder || 'glowup-channel';
    const uploadPromises = req.files.map(file => uploadToCloudinary(file, folder));
    const results = await Promise.all(uploadPromises);

    const successful = results.filter(result => result.success);
    const failed = results.filter(result => !result.success);

    res.json({
      success: true,
      data: {
        successful: successful.map(result => result.data),
        failed: failed.map(result => result.error),
        total: results.length,
        successful_count: successful.length,
        failed_count: failed.length
      }
    });

  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed'
    });
  }
});

// Delete file
router.delete('/:publicId', authenticateToken, async (req, res) => {
  try {
    const { publicId } = req.params;
    const result = await deleteFromCloudinary(publicId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Delete failed'
    });
  }
});

module.exports = router;

