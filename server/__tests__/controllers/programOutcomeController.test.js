const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
jest.mock('ioredis');
jest.mock('bull');

const app = require('../../server');
const ProgramOutcome = require('../../models/ProgramOutcome');
const User = require('../../models/User');
const dbHandler = require('../setup/db');

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'testsecretkey12345';
    process.env.JWT_EXPIRES_IN = '1d';
    await dbHandler.connect();
});

afterEach(async () => await dbHandler.clearDatabase());
afterAll(async () => await dbHandler.closeDatabase());

describe('Program Outcome Controller Test', () => {

    let adminToken;
    let studentToken;

    beforeEach(async () => {
        // Create an admin user
        const adminUser = new User({
            name: 'Admin User',
            email: 'admin@university.edu',
            password: 'securepassword',
            role: 'admin',
            isActive: true,
            isEmailVerified: true
        });
        await adminUser.save();
        adminToken = jwt.sign(
            { id: adminUser._id, role: adminUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Create a student user
        const studentUser = new User({
            name: 'Student User',
            email: 'student@university.edu',
            password: 'securepassword',
            role: 'student',
            roll: '2101001',
            isActive: true,
            isEmailVerified: true
        });
        await studentUser.save();
        studentToken = jwt.sign(
            { id: studentUser._id, role: studentUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Create initial Program Outcomes
        const pos = [
            {
                po_code: 'PO_A',
                po_number: 1,
                title: 'Engineering Knowledge',
                description: 'Apply knowledge of mathematics, natural science, computing, and engineering.',
                is_system: true
            },
            {
                po_code: 'PO_B',
                po_number: 2,
                title: 'Problem Analysis',
                description: 'Identify, formulate, research literature and analyze complex engineering problems.',
                is_system: true
            }
        ];
        await ProgramOutcome.insertMany(pos);
    });

    it('should retrieve all program outcomes', async () => {
        const response = await request(app)
            .get('/api/program-outcomes');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.length).toBe(2);
        expect(response.body.data[0].po_code).toBe('PO_A');
    });

    it('should retrieve a specific program outcome by code', async () => {
        const response = await request(app)
            .get('/api/program-outcomes/PO_A');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.po_code).toBe('PO_A');
        expect(response.body.data.title).toBe('Engineering Knowledge');
    });

    it('should return 404 for a non-existent program outcome code', async () => {
        const response = await request(app)
            .get('/api/program-outcomes/PO_Z');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
    });

    it('should update a program outcome when requested by an admin', async () => {
        const updatedData = {
            title: 'Updated Engineering Knowledge',
            description: 'Updated Description'
        };

        const response = await request(app)
            .put('/api/program-outcomes/PO_A')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(updatedData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Updated Engineering Knowledge');
        expect(response.body.data.description).toBe('Updated Description');
    });

    it('should fail to update a program outcome if not authenticated', async () => {
        const response = await request(app)
            .put('/api/program-outcomes/PO_A')
            .send({ title: 'Hacked Title' });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
    });

    it('should fail to update a program outcome if requested by a non-admin (e.g. student)', async () => {
        const response = await request(app)
            .put('/api/program-outcomes/PO_A')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ title: 'Hacked Title' });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
    });
});
