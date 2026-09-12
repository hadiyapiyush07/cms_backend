const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Load environment variables
dotenv.config();

const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Professor = require('../models/Professor');

async function hashPasswords() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL, {
      
      
    });
    console.log('Connected to MongoDB Atlas');

    const collections = [
      { model: Admin, name: 'Admin' },
      { model: Student, name: 'Student' },
      { model: Professor, name: 'Professor' }
    ];

    for (let { model, name } of collections) {
      console.log(`\nChecking ${name} collection...`);
      const documents = await model.find({}).select('+password');
      let updatedCount = 0;

      for (let doc of documents) {
        if (!doc.password) continue;
        
        // bcrypt hashes always start with $2a$, $2b$, or $2y$
        if (!doc.password.startsWith('$2')) {
          console.log(`Hashing password for ${name}: ${doc.email || doc.enrollmentNum || doc._id}`);
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(doc.password, salt);
          
          // Use updateOne to bypass pre('save') hook since we already hashed it manually here
          await model.updateOne({ _id: doc._id }, { $set: { password: hashedPassword } });
          updatedCount++;
        }
      }
      
      console.log(`Done for ${name}. Hashed ${updatedCount} passwords.`);
    }

    console.log('\nAll plain text passwords have been hashed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error hashing passwords:', error);
    process.exit(1);
  }
}

hashPasswords();
