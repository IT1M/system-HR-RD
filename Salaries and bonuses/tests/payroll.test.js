const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');

// بيانات الاختبار
const testUser = {
    username: 'testuser',
    password: 'test123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin'
};

const testEmployee = {
    name: 'Test Employee',
    email: 'test.employee@company.com',
    department: 'Technology',
    position: 'Developer',
    baseSalary: 10000,
    bankAccount: 'SA1234567890'
};

describe('Payroll System API', () => {
    let authToken;
    let userId;
    let employeeId;

    // قبل جميع الاختبارات
    beforeAll(async () => {
        // الاتصال بقاعدة بيانات الاختبار
        await mongoose.connect(process.env.MONGODB_TEST_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    });

    // بعد جميع الاختبارات
    afterAll(async () => {
        // تنظيف قاعدة البيانات
        await mongoose.connection.db.dropDatabase();
        await mongoose.connection.close();
    });

    // قبل كل اختبار
    beforeEach(async () => {
        // تنظيف المجموعات
        await User.deleteMany({});
        await Employee.deleteMany({});
        await Payroll.deleteMany({});
    });

    describe('Authentication', () => {
        test('should register a new user', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.user.username).toBe(testUser.username);
            expect(response.body.user.password).toBeUndefined();
        });

        test('should login with valid credentials', async () => {
            // تسجيل المستخدم أولاً
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            authToken = response.body.token;
            userId = response.body.user._id;
        });

        test('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        test('should validate token', async () => {
            // تسجيل الدخول أولاً
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            const token = loginResponse.body.token;

            const response = await request(app)
                .get('/api/auth/validate')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.valid).toBe(true);
        });
    });

    describe('Employees', () => {
        beforeEach(async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            authToken = loginResponse.body.token;
            userId = loginResponse.body.user._id;
        });

        test('should create a new employee', async () => {
            const response = await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.employee.name).toBe(testEmployee.name);
            expect(response.body.employee.email).toBe(testEmployee.email);
            employeeId = response.body.employee._id;
        });

        test('should get employees list', async () => {
            // إنشاء موظف أولاً
            await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);

            const response = await request(app)
                .get('/api/employees')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.employees)).toBe(true);
            expect(response.body.employees.length).toBe(1);
        });

        test('should get employee by ID', async () => {
            // إنشاء موظف أولاً
            const createResponse = await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);

            employeeId = createResponse.body.employee._id;

            const response = await request(app)
                .get(`/api/employees/${employeeId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.employee._id).toBe(employeeId);
        });

        test('should update employee', async () => {
            // إنشاء موظف أولاً
            const createResponse = await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);

            employeeId = createResponse.body.employee._id;

            const updateData = {
                position: 'Senior Developer',
                baseSalary: 12000
            };

            const response = await request(app)
                .put(`/api/employees/${employeeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.employee.position).toBe(updateData.position);
            expect(response.body.employee.baseSalary).toBe(updateData.baseSalary);
        });

        test('should delete employee', async () => {
            // إنشاء موظف أولاً
            const createResponse = await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);

            employeeId = createResponse.body.employee._id;

            const response = await request(app)
                .delete(`/api/employees/${employeeId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // التحقق من الحذف
            const getResponse = await request(app)
                .get(`/api/employees/${employeeId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.status).toBe(404);
        });

        test('should export employees', async () => {
            // إنشاء موظف أولاً
            await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);

            const response = await request(app)
                .get('/api/employees/export')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toBe('text/csv');
            expect(response.headers['content-disposition']).toContain('attachment');
        });
    });

    describe('Payroll', () => {
        beforeEach(async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            authToken = loginResponse.body.token;
            userId = loginResponse.body.user._id;

            // إنشاء موظف
            const employeeResponse = await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);

            employeeId = employeeResponse.body.employee._id;
        });

        test('should get payroll total', async () => {
            const response = await request(app)
                .get('/api/payroll/total')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(typeof response.body.total).toBe('number');
            expect(typeof response.body.growth).toBe('number');
        });

        test('should process payroll', async () => {
            const response = await request(app)
                .post('/api/payroll/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    month: 1,
                    year: 2024
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.payrollRecords)).toBe(true);
        });

        test('should get payroll records', async () => {
            // معالجة الرواتب أولاً
            await request(app)
                .post('/api/payroll/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    month: 1,
                    year: 2024
                });

            const response = await request(app)
                .get('/api/payroll/1/2024')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.payrollRecords)).toBe(true);
        });
    });

    describe('AI Recommendations', () => {
        beforeEach(async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            authToken = loginResponse.body.token;
        });

        test('should get AI recommendations', async () => {
            const response = await request(app)
                .get('/api/ai/recommendations')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('should get AI insights', async () => {
            const response = await request(app)
                .get('/api/ai/insights')
                .query({ type: 'payroll' })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.insights)).toBe(true);
        });
    });

    describe('Compliance', () => {
        beforeEach(async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            authToken = loginResponse.body.token;
        });

        test('should get compliance alerts', async () => {
            const response = await request(app)
                .get('/api/compliance/alerts')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('should get compliance status', async () => {
            const response = await request(app)
                .get('/api/compliance/status')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(typeof response.body.complianceScore).toBe('number');
        });

        test('should get tax report', async () => {
            const response = await request(app)
                .get('/api/compliance/tax-report')
                .query({ month: 1, year: 2024 })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.period).toBe('1/2024');
        });
    });

    describe('Incentives', () => {
        beforeEach(async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            authToken = loginResponse.body.token;
            userId = loginResponse.body.user._id;
        });

        test('should create incentive', async () => {
            const incentiveData = {
                name: 'Test Incentive',
                description: 'Test incentive description',
                type: 'performance',
                budget: 10000,
                criteria: {
                    targetType: 'individual',
                    conditions: [
                        { metric: 'rating', operator: '>=', value: 4, weight: 1 }
                    ],
                    calculation: 'percentage'
                },
                startDate: new Date(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            };

            const response = await request(app)
                .post('/api/incentives')
                .set('Authorization', `Bearer ${authToken}`)
                .send(incentiveData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.incentive.name).toBe(incentiveData.name);
        });

        test('should get incentives', async () => {
            const response = await request(app)
                .get('/api/incentives')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('should get incentive summary', async () => {
            const response = await request(app)
                .get('/api/incentives/summary')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(typeof response.body.totalBudget).toBe('number');
        });
    });

    describe('Reports', () => {
        beforeEach(async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            authToken = loginResponse.body.token;
            userId = loginResponse.body.user._id;

            // إنشاء موظف
            await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);
        });

        test('should generate payroll summary report', async () => {
            const reportData = {
                type: 'payroll_summary',
                parameters: {
                    month: 1,
                    year: 2024
                }
            };

            const response = await request(app)
                .post('/api/reports/generate')
                .set('Authorization', `Bearer ${authToken}`)
                .send(reportData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.type).toBe('payroll_summary');
        });

        test('should get report templates', async () => {
            const response = await request(app)
                .get('/api/reports/templates')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('Activities', () => {
        beforeEach(async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            authToken = loginResponse.body.token;
            userId = loginResponse.body.user._id;
        });

        test('should get recent activities', async () => {
            const response = await request(app)
                .get('/api/activities/recent')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('should create activity', async () => {
            const activityData = {
                type: 'test_activity',
                title: 'Test Activity',
                description: 'Test activity description',
                category: 'info'
            };

            const response = await request(app)
                .post('/api/activities')
                .set('Authorization', `Bearer ${authToken}`)
                .send(activityData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.activity.type).toBe(activityData.type);
        });

        test('should get activity stats', async () => {
            const response = await request(app)
                .get('/api/activities/stats')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('Search', () => {
        beforeEach(async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            authToken = loginResponse.body.token;
            userId = loginResponse.body.user._id;

            // إنشاء موظف
            await request(app)
                .post('/api/employees')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testEmployee);
        });

        test('should search employees', async () => {
            const response = await request(app)
                .get('/api/search')
                .query({ q: 'Test', type: 'employees' })
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.results.employees)).toBe(true);
        });

        test('should validate search query', async () => {
            const response = await request(app)
                .get('/api/search')
                .query({ q: 'a' }) // query too short
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle 404 for unknown endpoints', async () => {
            const response = await request(app)
                .get('/api/unknown-endpoint');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });

        test('should handle unauthorized access', async () => {
            const response = await request(app)
                .get('/api/employees');

            expect(response.status).toBe(401);
        });

        test('should handle invalid employee ID', async () => {
            // تسجيل المستخدم وتسجيل الدخول
            await request(app)
                .post('/api/auth/register')
                .send(testUser);

            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            const invalidId = '507f1f77bcf86cd799439011'; // valid ObjectId but doesn't exist

            const response = await request(app)
                .get(`/api/employees/${invalidId}`)
                .set('Authorization', `Bearer ${loginResponse.body.token}`);

            expect(response.status).toBe(404);
        });
    });
});