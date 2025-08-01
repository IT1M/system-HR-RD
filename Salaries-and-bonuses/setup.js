const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// تحميل متغيرات البيئة
dotenv.config();

// إعدادات قاعدة البيانات
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
});

// نماذج البيانات
const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6
    },
    name: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 100
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },
    role: { 
        type: String, 
        enum: ['admin', 'manager', 'employee'], 
        default: 'employee' 
    },
    permissions: [String],
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const employeeSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 100
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },
    department: { 
        type: String, 
        required: true,
        enum: ['Technology', 'Sales', 'HR', 'Finance', 'Marketing', 'Operations']
    },
    position: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 100
    },
    baseSalary: { 
        type: Number, 
        required: true,
        min: 0
    },
    bankAccount: { 
        type: String, 
        required: true,
        trim: true
    },
    taxInfo: {
        taxId: String,
        taxRate: { type: Number, min: 0, max: 1, default: 0.15 }
    },
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'on_leave', 'terminated'], 
        default: 'active' 
    },
    hireDate: { 
        type: Date, 
        required: true,
        default: Date.now
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Employee = mongoose.model('Employee', employeeSchema);

// إنشاء المجلدات الضرورية
const createDirectories = () => {
    const directories = [
        'uploads',
        'uploads/employees',
        'uploads/documents',
        'uploads/reports',
        'logs',
        'backups',
        'temp'
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
};

// إنشاء المستخدم الافتراضي
const createDefaultUser = async () => {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', parseInt(process.env.BCRYPT_ROUNDS) || 12);
            
            const admin = new User({
                username: 'admin',
                password: hashedPassword,
                name: 'مدير النظام',
                email: 'admin@payrollpro.com',
                role: 'admin',
                permissions: ['all']
            });
            
            await admin.save();
            console.log('✅ Default admin user created successfully');
            console.log('   Username: admin');
            console.log('   Password: admin123');
            console.log('   ⚠️  Please change the default password after first login');
        } else {
            console.log('ℹ️  Default admin user already exists');
        }
    } catch (error) {
        console.error('❌ Error creating default user:', error);
    }
};

// إنشاء بيانات تجريبية للموظفين
const createSampleEmployees = async () => {
    try {
        const employeeCount = await Employee.countDocuments();
        
        if (employeeCount === 0) {
            const sampleEmployees = [
                {
                    name: 'أحمد محمد السعيد',
                    email: 'ahmed.saeed@company.com',
                    department: 'Technology',
                    position: 'مطور برمجيات أول',
                    baseSalary: 15000,
                    bankAccount: 'SA1234567890',
                    taxInfo: { taxId: 'TAX001', taxRate: 0.15 }
                },
                {
                    name: 'فاطمة عبد الله',
                    email: 'fatima.abdullah@company.com',
                    department: 'Sales',
                    position: 'مديرة مبيعات',
                    baseSalary: 12000,
                    bankAccount: 'SA0987654321',
                    taxInfo: { taxId: 'TAX002', taxRate: 0.15 }
                },
                {
                    name: 'محمد خالد العتيبي',
                    email: 'mohammed.otaibi@company.com',
                    department: 'HR',
                    position: 'موظف موارد بشرية',
                    baseSalary: 8000,
                    bankAccount: 'SA1122334455',
                    taxInfo: { taxId: 'TAX003', taxRate: 0.12 }
                },
                {
                    name: 'سارة أحمد الحربي',
                    email: 'sara.harbi@company.com',
                    department: 'Finance',
                    position: 'محاسبة أولى',
                    baseSalary: 10000,
                    bankAccount: 'SA5544332211',
                    taxInfo: { taxId: 'TAX004', taxRate: 0.15 }
                },
                {
                    name: 'عبدالله سالم القحطاني',
                    email: 'abdullah.qahtani@company.com',
                    department: 'Marketing',
                    position: 'مسوق رقمي',
                    baseSalary: 9000,
                    bankAccount: 'SA6677889900',
                    taxInfo: { taxId: 'TAX005', taxRate: 0.13 }
                }
            ];

            await Employee.insertMany(sampleEmployees);
            console.log(`✅ Created ${sampleEmployees.length} sample employees`);
        } else {
            console.log(`ℹ️  Found ${employeeCount} existing employees`);
        }
    } catch (error) {
        console.error('❌ Error creating sample employees:', error);
    }
};

// إنشاء المستخدمين الإضافيين
const createAdditionalUsers = async () => {
    try {
        const users = [
            {
                username: 'manager',
                password: await bcrypt.hash('manager123', parseInt(process.env.BCRYPT_ROUNDS) || 12),
                name: 'مدير الموارد البشرية',
                email: 'hr.manager@company.com',
                role: 'manager',
                permissions: ['employees', 'payroll', 'reports']
            },
            {
                username: 'finance',
                password: await bcrypt.hash('finance123', parseInt(process.env.BCRYPT_ROUNDS) || 12),
                name: 'مدير المالية',
                email: 'finance.manager@company.com',
                role: 'manager',
                permissions: ['payroll', 'compliance', 'reports']
            }
        ];

        for (const userData of users) {
            const exists = await User.findOne({ username: userData.username });
            if (!exists) {
                const user = new User(userData);
                await user.save();
                console.log(`✅ Created user: ${userData.username}`);
            }
        }
    } catch (error) {
        console.error('❌ Error creating additional users:', error);
    }
};

// التحقق من اتصال قاعدة البيانات
const checkDatabaseConnection = async () => {
    try {
        await mongoose.connection.db.admin().ping();
        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
};

// الدالة الرئيسية للإعداد
const setup = async () => {
    console.log('🚀 Starting Payroll System Setup...');
    console.log('=====================================');
    
    try {
        // التحقق من اتصال قاعدة البيانات
        const dbConnected = await checkDatabaseConnection();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }
        
        // إنشاء المجلدات الضرورية
        console.log('\n📁 Creating directories...');
        createDirectories();
        
        // إنشاء المستخدم الافتراضي
        console.log('\n👤 Creating default users...');
        await createDefaultUser();
        await createAdditionalUsers();
        
        // إنشاء بيانات تجريبية
        console.log('\n👥 Creating sample employees...');
        await createSampleEmployees();
        
        console.log('\n✅ Setup completed successfully!');
        console.log('=====================================');
        console.log('\n📋 Next steps:');
        console.log('1. Start the server: npm start');
        console.log('2. Login with default admin credentials');
        console.log('3. Change the default password');
        console.log('4. Configure your bank API keys');
        console.log('5. Set up your Gemini API key');
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error);
        process.exit(1);
    } finally {
        // إغلاق اتصال قاعدة البيانات
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
};

// تشغيل الإعداد
if (require.main === module) {
    setup();
}

module.exports = { setup };