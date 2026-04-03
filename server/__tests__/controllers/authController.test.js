const request = require('supertest');
jest.mock('ioredis');
jest.mock('bull');

const app = require('../../server');
const User = require('../../models/User');
const dbHandler = require('../setup/db');

beforeAll(async () => {
    // Set to test environment
    process.env.NODE_ENV = 'test';
    // Use dummy JWT secret for testing
    process.env.JWT_SECRET = 'testsecretkey12345';
    process.env.JWT_EXPIRES_IN = '1d';
    // Connect to in-memory db
    await dbHandler.connect();
});

afterEach(async () => await dbHandler.clearDatabase());
afterAll(async () => await dbHandler.closeDatabase());

describe('Auth Controller Test', () => {

    beforeEach(async () => {
        // Create a test user before each test
        const user = new User({
            name: 'Test Student',
            email: 'teststudent@university.edu',
            password: 'securepassword',
            role: 'student',
            roll: '2101000',
            isEmailVerified: true,
            isApprovedByAdmin: true,
            isActive: true
        });
        await user.save();
    });

    it('should login successfully with valid credentials', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: 'teststudent@university.edu', // Login can be identifier or email
                password: 'securepassword'
            });

        if (response.status !== 200) {
            console.log('Login failed body:', response.body);
        }

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.data.email).toBe('teststudent@university.edu');
    });

    it('should fail login with incorrect password', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: 'teststudent@university.edu',
                password: 'wrongpassword'
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/Invalid email\/roll number or password/);
    });

    it('should fail login with non-existent user', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                identifier: 'nonexistent@university.edu',
                password: 'securepassword'
            });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/Invalid email\/roll number or password/);
    });
});