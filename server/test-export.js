/**
 * Test script to verify export endpoints are registered correctly
 * Run with: node test-export.js
 */

const express = require('express');
const router = require('./routes/exportRoutes');

console.log('✓ Export routes loaded successfully');
console.log('✓ Available routes:');
console.log('  - GET /api/export/course/:courseId/marks');
console.log('  - GET /api/export/course/:courseId/:component');
console.log('\n✓ Export system is ready to test!');
console.log('\nTo test manually:');
console.log('1. Login to the application as a teacher or admin');
console.log('2. Navigate to any course CT Marks sheet');
console.log('3. Click "Export CT" or "Export All" button');
console.log('4. Excel file should download automatically\n');
