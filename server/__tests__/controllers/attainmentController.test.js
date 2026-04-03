const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
jest.mock('ioredis');
jest.mock('bull');

const app = require('../../server');
const dbHandler = require('../setup/db');
const User = require('../../models/User');
const Course = require('../../models/Course');
const CTAttainment = require('../../models/CTAttainment');

const generateTestToken = (userId, role) => {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'testsecretkey12345';
    process.env.JWT_EXPIRES_IN = '1d';
    await dbHandler.connect();
});

afterEach(async () => await dbHandler.clearDatabase());
afterAll(async () => await dbHandler.closeDatabase());

describe('Attainment Controller Test', () => {
    let teacherToken;
    let studentToken;
    let courseId;
    let teacherId;

    beforeEach(async () => {
        // 1. Create a Teacher User
        const teacher = new User({
            name: 'Test Teacher',
            email: 'teacher@university.edu',
            password: 'securepassword',
            role: 'teacher',
            isEmailVerified: true,
            isApprovedByAdmin: true,
            isActive: true
        });
        const savedTeacher = await teacher.save();
        teacherId = savedTeacher._id;
        teacherToken = generateTestToken(teacherId, 'teacher');

        // 2. Create a Student User
        const student = new User({
            name: 'Test Student',
            email: 'student@university.edu',
            password: 'securepassword',
            role: 'student',
            roll: '2101000',
            isEmailVerified: true,
            isApprovedByAdmin: true,
            isActive: true
        });
        await student.save();
        studentToken = generateTestToken(student._id, 'student');

        // 3. Create a Course assigned to the Teacher
        const course = new Course({
            courseCode: 'CSE-101',
            courseTitle: 'Intro to Computer Science',
            credit: 3,
            course_type: 'THEORY',
            course_offered_to: 'CSE',
            category: 'COMPULSORY',
            createdBy: teacherId,
            course_objectives: ['Obj 1'],
            kpa_mapping: ['K1'],
            course_content: [{ concept_description: 'Concepts' }],
            lecture_plan: [{ plan: 'Plan 1' }],
            assignedTeachers: [{
                teacher: teacherId,
                section: 'A'
            }],
            assignedBatches: [{ batch: '21', deptCode: 'CSE' }],
            programOutcomes: ['PO1'],
            courseOutcomes: [
                {
                    coNumber: 'CO1',
                    description: 'Basic Concepts',
                    mappedPOs: [{ po: 'PO1', level: 3 }]
                }
            ],
            yearLevel: 1,
            semester: 1
        });
        const savedCourse = await course.save();
        courseId = savedCourse._id;
    });

    it('should allow teacher to get sheets (courses assigned to them)', async () => {
        const response = await request(app)
            .get('/api/attainment/sheets')
            .set('Authorization', `Bearer ${teacherToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.courses).toBeInstanceOf(Array);
        expect(response.body.courses.length).toBeGreaterThan(0);
        expect(response.body.courses[0].courseCode).toBe('CSE-101');
    });

    it('should fail if student tries to get attainment data assigned to teachers', async () => {
        const response = await request(app)
            .post(`/api/attainment/ct/${courseId}`)
            .set('Authorization', `Bearer ${studentToken}`)
            .send({});

        // Expect 403 Forbidden because route is protected by `authorizeRoles('teacher', 'admin')`
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
    });

    it('should save and get CT Attainment data for a course by teacher', async () => {
        const ctDataPayload = {
            ctRows: [
                { coNumber: 'CO1', CT1_Q1: 10, CT1_Q2: 0, CT1_Q3: 0, CT2_Q1: 0, CT2_Q2: 0, CT2_Q3: 0, CT3_Q1: 0, CT3_Q2: 0, CT3_Q3: 0 }
            ],
            ctSummary: { useEqWt: 1, coMappedMarks60: 60, ctTaken: 2 },
            ctManualWts: { CT1: 0, CT2: 0, CT3: 0, CT4: 0 }
        };

        // SAVE
        const saveRes = await request(app)
            .post(`/api/attainment/ct/${courseId}`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .send(ctDataPayload);

        expect(saveRes.status).toBe(200);
        expect(saveRes.body.success).toBe(true);
        expect(saveRes.body.message).toMatch(/CT data saved successfully/);

        // GET
        const getRes = await request(app)
            .get(`/api/attainment/ct/${courseId}`)
            .set('Authorization', `Bearer ${teacherToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.success).toBe(true);
        // MongoDB stores nested arrays, so verifying an aspect of the payload:
        expect(getRes.body.data.ctRows[0].coNumber).toBe('CO1');
        expect(getRes.body.data.ctRows[0].CT1_Q1).toBe(10);
    });

    it('should clear/reset attainment data for a course', async () => {
        // Insert mockup piece manually or via endpoint
        await request(app)
            .post(`/api/attainment/ct/${courseId}`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({
                ctRows: [{ coNumber: 'CO1', CT1_Q1: 5 }]
            });

        // Ensure it is there
        const getRes1 = await request(app)
            .get(`/api/attainment/ct/${courseId}`)
            .set('Authorization', `Bearer ${teacherToken}`);
        expect(getRes1.body.data).toBeDefined();

        // Delete
        const deleteRes = await request(app)
            .delete(`/api/attainment/reset/${courseId}`)
            .set('Authorization', `Bearer ${teacherToken}`);

        expect(deleteRes.status).toBe(200);
        expect(deleteRes.body.success).toBe(true);
        expect(deleteRes.body.message).toBe('Attainment data reset successfully');

        // Ensure it is gone
        const getRes2 = await request(app)
            .get(`/api/attainment/ct/${courseId}`)
            .set('Authorization', `Bearer ${teacherToken}`);
        
        expect(getRes2.status).toBe(200);
        expect(getRes2.body.data.ctRows.length).toBe(0); 
    });
});