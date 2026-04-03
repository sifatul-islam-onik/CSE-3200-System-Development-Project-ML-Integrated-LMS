const bullMock = jest.fn().mockImplementation(() => {
    return {
        on: jest.fn(),
        process: jest.fn(),
        add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
        close: jest.fn(),
        getJob: jest.fn().mockResolvedValue(null)
    };
});

module.exports = bullMock;