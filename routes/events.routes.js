const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { protect, authorize } = require('../middleware/auth.middleware');
const fs = require('fs');
const path = require('path');

// Helper to delete a file from the uploads folder given its URL
const deleteFileFromUrl = (url) => {
  if (!url) return;
  // Extract filename from URL (e.g., http://localhost:5000/uploads/filename.jpg)
  const filename = url.split('/uploads/')[1];
  if (!filename) return;
  const filePath = path.join(__dirname, '..', 'uploads', filename);
  fs.unlink(filePath, (err) => {
    if (err) console.error(`Failed to delete file ${filePath}:`, err);
  });
};

// @route   GET /api/events
// @desc    Get all events (public)
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/events
// @desc    Create a new event (admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { title, date, cover, photos } = req.body;
    const newEvent = new Event({ title, date, cover, photos });
    await newEvent.save();
    res.json(newEvent);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/events/:id
// @desc    Update an event (admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { title, date, cover, photos } = req.body;
    
    // Find existing event
    const existingEvent = await Event.findById(req.params.id);
    if (!existingEvent) {
      return res.status(404).json({ msg: 'Event not found' });
    }

    // Determine removed photos (old ones not in new list)
    const oldPhotos = existingEvent.photos;
    const removedPhotos = oldPhotos.filter(url => !photos.includes(url));
    
    // Delete removed photo files
    removedPhotos.forEach(url => deleteFileFromUrl(url));

    // If cover image changed, delete old cover file
    if (existingEvent.cover !== cover) {
      deleteFileFromUrl(existingEvent.cover);
    }

    // Update event
    const updated = await Event.findByIdAndUpdate(
      req.params.id,
      { title, date, cover, photos },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete an event (admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ msg: 'Event not found' });
    }

    // Delete cover image
    deleteFileFromUrl(event.cover);

    // Delete all photos
    event.photos.forEach(url => deleteFileFromUrl(url));

    // Remove event from database
    await Event.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Event removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;