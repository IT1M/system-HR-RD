const mongoose = require('mongoose');
const dotenv = require('dotenv');

// تحميل متغيرات البيئة
dotenv.config();

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// نماذج البيانات
const incentiveSchema = new mongoose.Schema({
    name: String,
    description: String,
    type: String,
    budget: Number,
    used: { type: Number, default: 0 },
    criteria: Object,
    status: { type: String, default: 'active' },
    startDate: Date,
    endDate: Date,
    createdBy: mongoose.Schema.Types.ObjectId
});

const Incentive = mongoose.model('Incentive', incentiveSchema);

// بيانات البذور
const seedData = {
    incentives: [
        {
            name: 'حافز تحقيق المبيعات',
            description: 'مكافأة شهري لمن يتجاوز أهداف المبيعات بنسبة 20% أو أكثر',
            type: 'sales',
            budget: 50000,
            criteria: {
                targetType: 'individual',
                conditions: [
                    { metric: 'target_achievement', operator: '>=', value: 120, weight: 1 }
                ],
                calculation: 'percentage'
            },
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31')
        },
        {
            name: 'برنامج الابتكار',
            description: 'مكافآت للموظفين الذين يقدمون أفكاراً مبتكرة يتم تطبيقها',
            type: 'innovation',
            budget: 30000,
            criteria: {
                targetType: 'individual',
                conditions: [
                    { metric: 'ideas_implemented', operator: '>=', value: 1, weight: 1 }
                ],
                calculation: 'fixed'
            },
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31')
        },
        {
            name: 'حافز التميز في خدمة العملاء',
            description: 'مكافأة ربع سنوية لأفضل 5 موظفين في خدمة العملاء',
            type: 'performance',
            budget: 25000,
            criteria: {
                targetType: 'individual',
                conditions: [
                    { metric: 'customer_satisfaction', operator: '>=', value: 90, weight: 0.6 },
                    { metric: 'peer_feedback', operator: '>=', value: 85, weight: 0.4 }
                ],
                calculation: 'tiered'
            },
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31')
        }
    ]
};

// دالة البذور
async function seedDatabase() {
    try {
        console.log('🌱 Seeding database...');
        
        // حذف البيانات الموجودة
        await Incentive.deleteMany({});
        console.log('🗑️  Cleared existing incentives');
        
        // إضافة بيانات جديدة
        const createdIncentives = await Incentive.insertMany(seedData.incentives);
        console.log(`✅ Created ${createdIncentives.length} incentives`);
        
        console.log('\n🎉 Database seeded successfully!');
        
    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        // إغلاق الاتصال
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// تشغيل البذور
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;