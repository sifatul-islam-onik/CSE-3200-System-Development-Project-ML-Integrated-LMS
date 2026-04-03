const request = require('supertest');
const app = require('../../server'); // Ensure server.js conditionally exports app
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const dbHandler = require('../setup/db');

const User = require('../../models/User');
const Department = require('../../models/Department');
const Course = require('../../models/Course');

jest.mock('../../__mocks__/ioredis');
jest.mock('../../__mocks__/bull');

beforeAll(async () => {
  await dbHandler.connect();
});

afterEach(async () => {
  await dbHandler.clearDatabase();
});

afterAll(async () => {
  await dbHandler.closeDatabase();
});

// Helper functions for mock users
const createMockUser = async (role, idSuffix) => {
  const user = new User({
    user_id: `user_${role}_${idSuffix}`,
    name: `Test ${role}`,
    email: `${role}${idSuffix}@test.com`,
    password: 'password123',
    role: role,
    status: 'approved',
    isApprovedByAdmin: true,
    isEmailVerified: true
  });
  if (role === 'student') {
    user.student_batch = '2020';
  }
  await user.save();
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });
  return { user, token };
};

const createMockDepartment = async () => {
  const dept = new Department({
    _id: 'CSE',
    name: 'Computer Science and Engineering',
    numericCode: '01',
    maxYear: 4,
    isActive: true
  });
  await dept.save();
  return dept;
};

describe('Course Controller Integration Tests', () => {
  let adminToken;
  let teacherToken;

  beforeEach(async () => {
    const adminData = await createMockUser('admin', '1');
    adminToken = adminData.token;

    const teacherData = await createMockUser('teacher', '1');
    teacherToken = teacherData.token;

    await createMockDepartment();
  });

  const validCoursePayload = {
    courseCode: 'CSE3200',
    courseTitle: 'SDP',
    course_type: 'PROJECT/THESIS',
    credit: 1.5,
    course_offered_to: 'CSE',
    category: 'COMPULSORY',
    kpa_mapping: ['K1', 'P1'],
    knowledge_required: ['Programming'],
    course_objectives: ['Learn to design systems'],
    course_content: [
      {
        concept_description: 'Software Architecture'
      }
    ],
    lecture_plan: [
      { week: 1, plan: 'Introduction' }
    ]
  };

  describe('POST /api/courses', () => {
    it('should allow admin to create a new course', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCoursePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courseCode).toBe('CSE3200');
      
      const courseInDb = await Course.findOne({ courseCode: 'CSE3200' });
      expect(courseInDb).not.toBeNull();
      expect(courseInDb.courseTitle).toBe('SDP');
    });

    it('should return 400 for duplicate course code', async () => {
      // Create it first
      await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCoursePayload);

      // Create it again
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCoursePayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should reject course creation for non-admin users', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(validCoursePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/admin/i);
    });

    it('should return 400 validation error if missing fields', async () => {
      const invalidPayload = { ...validCoursePayload, courseCode: '' };
      
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(400);
      // Wait, let's see if it's the custom validation or express-validator
      // Express validator array format: { errors: [{ msg: ... }] }
      // The controller maps both. Let's just check status.
      expect(res.body.success).toBe(false);
    });

    it('should enforce proper digits for THEORY/SESSIONAL type courses custom validator', async () => {
      // Theory must end in odd digit
      const theoryInvalidPayload = { 
        ...validCoursePayload, 
        courseCode: 'CSE3202', // Ending in 2 (even) for theory is invalid
        course_type: 'THEORY' 
      };

      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(theoryInvalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/courses', () => {
    it('should retrieve a list of all courses for authorized users (admin sees all)', async () => {
      // Create a course directly
      await new Course({...validCoursePayload, createdBy: new mongoose.Types.ObjectId()}).save();

      const res = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].courseCode).toBe('CSE3200');
    });
  });

  describe('GET /api/courses/:id', () => {
    it('should retrieve a specific course by id', async () => {
      const course = new Course({...validCoursePayload, createdBy: new mongoose.Types.ObjectId()});
      await course.save();

      const res = await request(app)
        .get(`/api/courses/${course._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courseCode).toBe('CSE3200');
    });

    it('should return 404 for non-existent course id', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/courses/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/courses/:id', () => {
    it('should allow admin to delete a course', async () => {
      const course = new Course({...validCoursePayload, createdBy: new mongoose.Types.ObjectId()});
      await course.save();

      const res = await request(app)
        .delete(`/api/courses/${course._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const courseInDb = await Course.findById(course._id);
      expect(courseInDb).toBeNull();
    });

    it('should not allow non-admin to delete a course', async () => {
      const course = new Course({...validCoursePayload, createdBy: new mongoose.Types.ObjectId()});
      await course.save();

      const res = await request(app)
        .delete(`/api/courses/${course._id}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
      
      // Course should still exist
      const courseInDb = await Course.findById(course._id);
      expect(courseInDb).not.toBeNull();
    });
  });
});
