const mongoose = require('mongoose');
const User = require('../../models/User');
const dbHandler = require('../setup/db');

// Connect to a new in-memory database before running any tests
beforeAll(async () => await dbHandler.connect());

// Clear all test data after every test
afterEach(async () => await dbHandler.clearDatabase());

// Remove and close the db and server
afterAll(async () => await dbHandler.closeDatabase());

describe('User Model Test', () => {

    it('should create & save user successfully', async () => {
        const validUser = new User({
            name: 'John Doe',
            email: 'john.doe@university.edu',
            password: 'Password123!',
            role: 'student',
            roll: '2100000',
        });
        const savedUser = await validUser.save();
        
        // Object Id should be defined when successfully saved to Mongoose
        expect(savedUser._id).toBeDefined();
        expect(savedUser.name).toBe(validUser.name);
        expect(savedUser.email).toBe(validUser.email);
        expect(savedUser.role).toBe(validUser.role);
    });

    it('should fail if required fields are missing', async () => {
        const userWithoutRequiredField = new User({ name: 'Jane Doe' });
        let err;
        try {
            await userWithoutRequiredField.save();
        } catch (error) {
            err = error;
        }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors.email).toBeDefined();
        expect(err.errors.password).toBeDefined();
        expect(err.errors.role).toBeDefined();
    });

    it('should hash the password before saving', async () => {
        const plainPassword = 'Password123!';
        const user = new User({
            name: 'Alice Hash',
            email: 'alice@university.edu',
            password: plainPassword,
            role: 'teacher'
        });
        const savedUser = await user.save();
        
        expect(savedUser.password).toBeDefined();
        expect(savedUser.password).not.toBe(plainPassword);
    });

    it('canAccessSystem should return correctly based on status', () => {
        const adminUser = new User({
            role: 'admin',
            isActive: true
        });
        expect(adminUser.canAccessSystem()).toBe(true);

        const inactiveAdminUser = new User({
            role: 'admin',
            isActive: false
        });
        expect(inactiveAdminUser.canAccessSystem()).toBe(false);

        const student = new User({
            role: 'student',
            isActive: true,
            isEmailVerified: true,
            isApprovedByAdmin: true
        });
        expect(student.canAccessSystem()).toBe(true);

        const unapprovedStudent = new User({
            role: 'student',
            isActive: true,
            isEmailVerified: true,
            isApprovedByAdmin: false
        });
        expect(unapprovedStudent.canAccessSystem()).toBe(false);
    });
});