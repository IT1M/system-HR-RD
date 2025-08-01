const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// إعدادات قاعدة البيانات
mongoose.connect('mongodb://localhost:27017/payroll_system', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// إعدادات Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// نماذج البيانات
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee' },
    permissions: [String]
});

const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    department: { type: String, required: true },
    position: { type: String, required: true },
    baseSalary: { type: Number, required: true },
    bankAccount: { type: String, required: true },
    taxInfo: {
        taxId: String,
        taxRate: Number
    },
    performance: {
        rating: Number,
        goals: [String],
        achievements: [String]
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    hireDate: { type: Date, default: Date.now }
});

const payrollSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    month: Number,
    year: Number,
    baseSalary: Number,
    allowances: Number,
    deductions: {
        tax: Number,
        insurance: Number,
        other: Number
    },
    netSalary: Number,
    status: { type: String, enum: ['pending', 'processed', 'paid'], default: 'pending' },
    processedAt: Date,
    paidAt: Date
});

const incentiveSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['sales', 'performance', 'attendance', 'innovation'], required: true },
    budget: { type: Number, required: true },
    used: { type: Number, default: 0 },
    criteria: Object,
    status: { type: String, enum: ['active', 'inactive', 'completed'], default: 'active' },
    startDate: Date,
    endDate: Date
});

const User = mongoose.model('User', userSchema);
const Employee = mongoose.model('Employee', employeeSchema);
const Payroll = mongoose.model('Payroll', payrollSchema);
const Incentive = mongoose.model('Incentive', incentiveSchema);

// نظام المصادقة
class AuthSystem {
    async login(username, password) {
        const user = await User.findOne({ username });
        if (!user) throw new Error('User not found');
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) throw new Error('Invalid password');
        
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        return { token, user };
    }

    authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) return res.sendStatus(401);
        
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    }

    checkPermission(requiredRole) {
        return (req, res, next) => {
            if (req.user.role !== requiredRole) {
                return res.status(403).json({ success: false, error: 'Insufficient permissions' });
            }
            next();
        };
    }
}

const authSystem = new AuthSystem();

// نظام الرواتب
class PayrollSystem {
    async calculatePayroll(employee, month, year) {
        const baseSalary = employee.baseSalary;
        const allowances = await this.calculateAllowances(employee);
        const deductions = await this.calculateDeductions(employee, baseSalary);
        const netSalary = baseSalary + allowances - (deductions.tax + deductions.insurance + deductions.other);

        return {
            employee: employee._id,
            month,
            year,
            baseSalary,
            allowances,
            deductions,
            netSalary
        };
    }

    async calculateAllowances(employee) {
        // حساب البدلات المختلفة
        let allowances = 0;
        
        // بدل نقل
        allowances += 500;
        
        // بدل سكن
        if (employee.department === 'Technology') {
            allowances += 1000;
        }
        
        // بدل وجبات
        allowances += 300;
        
        return allowances;
    }

    async calculateDeductions(employee, baseSalary) {
        // حساب الضرائب
        const taxRate = employee.taxInfo?.taxRate || 0.15;
        const tax = baseSalary * taxRate;
        
        // حساب التأمينات
        const insurance = baseSalary * 0.11;
        
        // استقطاعات أخرى
        const other = 0;
        
        return { tax, insurance, other };
    }

    async processMonthlyPayroll(month, year) {
        const employees = await Employee.find({ status: 'active' });
        const payrollRecords = [];

        for (const employee of employees) {
            const payrollData = await this.calculatePayroll(employee, month, year);
            const payroll = new Payroll(payrollData);
            await payroll.save();
            payrollRecords.push(payroll);
        }

        return payrollRecords;
    }
}

const payrollSystem = new PayrollSystem();

// نظام التكامل المصرفي
class BankingSystem {
    async processTransfer(amount, fromAccount, toAccount, description) {
        try {
            // هنا سيتم التكامل الحقيقي مع البنوك
            // هذا مثال محاكاة
            
            const response = await axios.post('https://api.bank.com/transfers', {
                amount,
                fromAccount,
                toAccount,
                description,
                apiKey: process.env.BANK_API_KEY
            });

            return {
                success: true,
                transactionId: response.data.transactionId,
                status: 'completed'
            };
        } catch (error) {
            console.error('Bank transfer failed:', error);
            throw new Error('Transfer processing failed');
        }
    }

    async processPayrollTransfers(payrollRecords) {
        const transfers = [];

        for (const record of payrollRecords) {
            const employee = await Employee.findById(record.employee);
            
            try {
                const transfer = await this.processTransfer(
                    record.netSalary,
                    process.env.COMPANY_ACCOUNT,
                    employee.bankAccount,
                    `Payroll ${record.month}/${record.year}`
                );

                transfers.push({
                    payrollId: record._id,
                    ...transfer
                });

                // تحديث حالة الراتب
                record.status = 'paid';
                record.paidAt = new Date();
                await record.save();

            } catch (error) {
                transfers.push({
                    payrollId: record._id,
                    success: false,
                    error: error.message
                });
            }
        }

        return transfers;
    }
}

const bankingSystem = new BankingSystem();

// نظام الذكاء الاصطناعي
class AISystem {
    async analyzeSalaryStructure() {
        try {
            const employees = await Employee.find();
            const salaryData = employees.map(emp => ({
                department: emp.department,
                position: emp.position,
                salary: emp.baseSalary
            }));

            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const prompt = `
                قم بتحليل بيانات الرواتب التالية وقدم توصيات لتحسين هيكل الرواتب:
                ${JSON.stringify(salaryData)}
                
                قدم التوصيات في شكل JSON مع الحقول التالية:
                - title: عنوان التوصية
                - description: وصف التوصية
                - impact: الأثر المتوقع
                - priority: الأولوية (high, medium, low)
            `;

            const result = await model.generateContent(prompt);
            const response = result.response.text();
            
            // استخراج JSON من الاستجابة
            const jsonMatch = response.match(/\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return [];
        } catch (error) {
            console.error('AI analysis failed:', error);
            return [];
        }
    }

    async forecastPayrollCosts(historicalData, parameters) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const prompt = `
                بناءً على البيانات التاريخية التالية والمعلمات المحددة، قم بالتنبؤ بتكاليف الرواتب للفترات المستقبلية:
                
                البيانات التاريخية: ${JSON.stringify(historicalData)}
                المعلمات: ${JSON.stringify(parameters)}
                
                قدم التنبؤات في شكل JSON مع الحقول التالية:
                - period: الفترة الزمنية
                - predictedCost: التكلفة المتوقعة
                - confidence: مستوى الثقة (0-1)
            `;

            const result = await model.generateContent(prompt);
            const response = result.response.text();
            
            const jsonMatch = response.match(/\[.*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return [];
        } catch (error) {
            console.error('AI forecasting failed:', error);
            return [];
        }
    }
}

const aiSystem = new AISystem();

// نظام الامتثال الضريبي
class TaxComplianceSystem {
    async calculateTaxes(salary, taxRate = 0.15) {
        const incomeTax = salary * taxRate;
        const socialSecurity = salary * 0.11;
        
        return {
            incomeTax,
            socialSecurity,
            total: incomeTax + socialSecurity
        };
    }

    async checkCompliance() {
        const issues = [];
        
        // التحقق من الضرائب
        const employees = await Employee.find();
        for (const employee of employees) {
            if (!employee.taxInfo || !employee.taxInfo.taxId) {
                issues.push({
                    type: 'missing_tax_info',
                    employeeId: employee._id,
                    message: 'Missing tax information for employee'
                });
            }
        }
        
        // التحقق من المواعيد النهائية
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        if (currentMonth === 0) { // يناير
            issues.push({
                type: 'annual_tax_deadline',
                message: 'Annual tax return deadline approaching'
            });
        }
        
        return issues;
    }

    async generateTaxReport(month, year) {
        const payrollRecords = await Payroll.find({ month, year });
        
        const report = {
            period: `${month}/${year}`,
            totalPayroll: payrollRecords.reduce((sum, record) => sum + record.baseSalary, 0),
            totalTaxes: payrollRecords.reduce((sum, record) => sum + record.deductions.tax, 0),
            totalInsurance: payrollRecords.reduce((sum, record) => sum + record.deductions.insurance, 0),
            employeeCount: payrollRecords.length,
            generatedAt: new Date()
        };
        
        return report;
    }
}

const taxComplianceSystem = new TaxComplianceSystem();

// نظام الحوافز
class IncentiveSystem {
    async calculateIncentives(employee, performanceData) {
        const incentives = [];
        
        // حوافز المبيعات
        if (employee.department === 'Sales' && performanceData.salesTarget) {
            const achievementRate = performanceData.salesActual / performanceData.salesTarget;
            if (achievementRate > 1.2) {
                incentives.push({
                    type: 'sales_bonus',
                    amount: employee.baseSalary * 0.2,
                    description: 'Sales target exceeded by 20%+'
                });
            }
        }
        
        // حوافز الأداء
        if (performanceData.rating >= 4.5) {
            incentives.push({
                type: 'performance_bonus',
                amount: employee.baseSalary * 0.15,
                description: 'Excellent performance rating'
            });
        }
        
        // حوافز الحضور
        if (performanceData.attendanceRate >= 0.95) {
            incentives.push({
                type: 'attendance_bonus',
                amount: 500,
                description: 'Perfect attendance bonus'
            });
        }
        
        return incentives;
    }

    async processIncentives(month, year) {
        const employees = await Employee.find({ status: 'active' });
        const incentiveResults = [];
        
        for (const employee of employees) {
            const performanceData = await this.getPerformanceData(employee._id, month, year);
            const incentives = await this.calculateIncentives(employee, performanceData);
            
            if (incentives.length > 0) {
                const totalIncentive = incentives.reduce((sum, incentive) => sum + incentive.amount, 0);
                
                incentiveResults.push({
                    employeeId: employee._id,
                    totalIncentive,
                    incentives
                });
            }
        }
        
        return incentiveResults;
    }

    async getPerformanceData(employeeId, month, year) {
        // هنا سيتم جلب بيانات الأداء من نظام إدارة الأداء
        // هذا مثال محاكاة
        
        return {
            salesTarget: 100000,
            salesActual: 120000,
            rating: 4.7,
            attendanceRate: 0.98
        };
    }
}

const incentiveSystem = new IncentiveSystem();

// واجهات برمجية (APIs)

// المصادقة
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await authSystem.login(username, password);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(401).json({ success: false, message: error.message });
    }
});

// الموظفون
app.get('/api/employees', authSystem.authenticateToken, async (req, res) => {
    try {
        const employees = await Employee.find();
        res.json(employees);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/employees/count', authSystem.authenticateToken, async (req, res) => {
    try {
        const count = await Employee.countDocuments({ status: 'active' });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/employees', authSystem.authenticateToken, async (req, res) => {
    try {
        const employee = new Employee(req.body);
        await employee.save();
        res.json({ success: true, employee });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// الرواتب
app.get('/api/payroll/total', authSystem.authenticateToken, async (req, res) => {
    try {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const payrollRecords = await Payroll.find({ month: currentMonth, year: currentYear });
        const total = payrollRecords.reduce((sum, record) => sum + record.netSalary, 0);
        const growth = 12; // نسبة النمو (سيتم حسابها بشكل ديناميكي)
        
        res.json({ total, growth });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/payroll/process', authSystem.authenticateToken, async (req, res) => {
    try {
        const { month, year } = req.body;
        const payrollRecords = await payrollSystem.processMonthlyPayroll(month, year);
        
        // معالجة التحويلات المصرفية
        const transfers = await bankingSystem.processPayrollTransfers(payrollRecords);
        
        res.json({ success: true, payrollRecords, transfers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// التحليلات والتوصيات
app.get('/api/ai/recommendations', authSystem.authenticateToken, async (req, res) => {
    try {
        const recommendations = await aiSystem.analyzeSalaryStructure();
        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/ai/forecast', authSystem.authenticateToken, async (req, res) => {
    try {
        const { historicalData, parameters } = req.body;
        const forecast = await aiSystem.forecastPayrollCosts(historicalData, parameters);
        res.json({ success: true, forecast });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// الامتثال الضريبي
app.get('/api/compliance/alerts', authSystem.authenticateToken, async (req, res) => {
    try {
        const issues = await taxComplianceSystem.checkCompliance();
        res.json(issues);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/compliance/tax-report', authSystem.authenticateToken, async (req, res) => {
    try {
        const { month, year } = req.query;
        const report = await taxComplianceSystem.generateTaxReport(
            parseInt(month), 
            parseInt(year)
        );
        res.json(report);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// الحوافز
app.get('/api/incentives', authSystem.authenticateToken, async (req, res) => {
    try {
        const incentives = await Incentive.find({ status: 'active' });
        res.json(incentives);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/incentives/process', authSystem.authenticateToken, async (req, res) => {
    try {
        const { month, year } = req.body;
        const results = await incentiveSystem.processIncentives(month, year);
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// المهام المجدولة
cron.schedule('0 0 1 * *', async () => {
    // معالجة الرواتب الشهرية
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    try {
        await payrollSystem.processMonthlyPayroll(month, year);
        console.log(`Monthly payroll processed for ${month}/${year}`);
    } catch (error) {
        console.error('Monthly payroll processing failed:', error);
    }
});

cron.schedule('0 9 * * *', async () => {
    // التحقق من الامتثال يومياً
    try {
        const issues = await taxComplianceSystem.checkCompliance();
        if (issues.length > 0) {
            console.log('Compliance issues found:', issues);
            // إرسال إشعارات للمسؤولين
        }
    } catch (error) {
        console.error('Compliance check failed:', error);
    }
});

// بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Payroll System Server running on port ${PORT}`);
    
    // إنشاء المستخدم الافتراضي إذا لم يكن موجوداً
    User.findOne({ username: 'admin' }).then(user => {
        if (!user) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            const admin = new User({
                username: 'admin',
                password: hashedPassword,
                name: 'مدير النظام',
                role: 'admin',
                permissions: ['all']
            });
            admin.save();
            console.log('Default admin user created');
        }
    });
});