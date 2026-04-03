const ioredisMock = jest.fn().mockImplementation(() => {
    return {
        on: jest.fn(),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue('OK'),
        scan: jest.fn().mockResolvedValue(['0', []])
    };
});

module.exports = ioredisMock;