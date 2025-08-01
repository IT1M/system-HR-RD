// Initialize MongoDB with default data
db = db.getSiblingDB('xi-xu-training');

// Create admin user
db.createUser({
  user: 'admin',
  pwd: 'your-mongo-password',
  roles: ['readWrite']
});

// Create default departments
db.departments.insertMany([
  { name: 'تقنية المعلومات', code: 'IT', description: 'قسم تقنية المعلومات' },
  { name: 'الموارد البشرية', code: 'HR', description: 'قسم الموارد البشرية' },
  { name: 'المالية', code: 'FIN', description: 'قسم المالية' },
  { name: 'التسويق', code: 'MKT', description: 'قسم التسويق' },
  { name: 'العمليات', code: 'OPS', description: 'قسم العمليات' }
]);

// Create default training categories
db.trainingCategories.insertMany([
  { name: 'تقنية', code: 'technical', description: 'دورات تقنية' },
  { name: 'مهارات ناعمة', code: 'soft-skills', description: 'دورات المهارات الناعمة' },
  { name: 'قيادة', code: 'leadership', description: 'دورات القيادة' },
  { name: 'التزام', code: 'compliance', description: 'دورات الالتزام' },
  { name: 'أخرى', code: 'other', description: 'دورات أخرى' }
]);

print('Database initialized successfully');