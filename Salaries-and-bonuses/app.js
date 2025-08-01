// إعدادات النظام
const API_BASE_URL = 'http://localhost:3000/api';
let currentUser = null;
let authToken = null;

// فئة النظام الرئيسي
class PayrollSystem {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.initializeCharts();
    }

    setupEventListeners() {
        // تسجيل الدخول
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // تسجيل الخروج
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // التنقل بين الأقسام
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleNavigation(link);
            });
        });

        // حفظ موظف جديد
        document.getElementById('saveEmployeeBtn').addEventListener('click', () => {
            this.handleSaveEmployee();
        });
    }

    async checkAuthStatus() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('currentUser');

        if (token && user) {
            authToken = token;
            currentUser = JSON.parse(user);
            this.showMainSystem();
            this.loadDashboardData();
        } else {
            this.showAuthForm();
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            this.showLoading();
            
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                authToken = data.token;
                currentUser = data.user;
                
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                this.showMainSystem();
                this.loadDashboardData();
                this.showToast('تم تسجيل الدخول بنجاح', 'success');
            } else {
                this.showLoginError(data.message);
            }
        } catch (error) {
            this.showLoginError('فشل الاتصال بالخادم');
        } finally {
            this.hideLoading();
        }
    }

    handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        authToken = null;
        currentUser = null;
        this.showAuthForm();
        this.showToast('تم تسجيل الخروج بنجاح', 'info');
    }

    showAuthForm() {
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('mainSystem').style.display = 'none';
    }

    showMainSystem() {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('mainSystem').style.display = 'block';
        document.getElementById('currentUser').textContent = currentUser.name;
    }

    showLoginError(message) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    handleNavigation(link) {
        // إزالة الفئة النشطة من جميع الروابط
        document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));
        
        // إضافة الفئة النشطة للرابط المضغوط
        link.classList.add('active');
        
        // إخفاء جميع الأقسام
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // إظهار القسم المحدد
        const sectionId = link.getAttribute('data-section');
        document.getElementById(sectionId).style.display = 'block';
        
        // تحميل بيانات القسم
        this.loadSectionData(sectionId);
    }

    async loadDashboardData() {
        try {
            this.showLoading();
            
            // جلب بيانات لوحة التحكم
            const [employees, payroll, alerts] = await Promise.all([
                this.fetchData('/employees/count'),
                this.fetchData('/payroll/total'),
                this.fetchData('/compliance/alerts')
            ]);

            // تحديث الإحصائيات
            document.getElementById('totalEmployees').textContent = employees.count;
            document.getElementById('totalPayroll').textContent = this.formatNumber(payroll.total);
            document.getElementById('growthRate').textContent = payroll.growth + '%';
            document.getElementById('complianceAlerts').textContent = alerts.length;

            // تحديث الرسوم البيانية
            this.updateDepartmentChart();
            
            // جلب التوصيات الذكية
            await this.loadRecommendations();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showToast('فشل تحميل بيانات لوحة التحكم', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadSectionData(sectionId) {
        switch(sectionId) {
            case 'employees':
                await this.loadEmployeesData();
                break;
            case 'analysis':
                await this.loadAnalysisData();
                break;
            case 'forecasting':
                await this.loadForecastingData();
                break;
            case 'compliance':
                await this.loadComplianceData();
                break;
            case 'incentives':
                await this.loadIncentivesData();
                break;
        }
    }

    async loadEmployeesData() {
        try {
            this.showLoading();
            const employees = await this.fetchData('/employees');
            
            const tbody = document.querySelector('#employeesTable tbody');
            tbody.innerHTML = '';
            
            employees.forEach(employee => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${employee.id}</td>
                    <td>${employee.name}</td>
                    <td>${this.getDepartmentName(employee.department)}</td>
                    <td>${employee.position}</td>
                    <td>${this.formatNumber(employee.salary)}</td>
                    <td><span class="badge bg-success">نشط</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="editEmployee(${employee.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteEmployee(${employee.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading employees:', error);
            this.showToast('فشل تحميل بيانات الموظفين', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadRecommendations() {
        try {
            const recommendations = await this.fetchData('/ai/recommendations');
            const container = document.getElementById('recommendationsContainer');
            
            container.innerHTML = '';
            
            recommendations.forEach(rec => {
                const card = document.createElement('div');
                card.className = 'recommendation-card';
                card.innerHTML = `
                    <div class="recommendation-title">${rec.title}</div>
                    <div class="recommendation-text">${rec.description}</div>
                    <div class="recommendation-impact">${rec.impact}</div>
                `;
                container.appendChild(card);
            });
            
        } catch (error) {
            console.error('Error loading recommendations:', error);
        }
    }

    async handleSaveEmployee() {
        const formData = {
            name: document.getElementById('employeeName').value,
            email: document.getElementById('employeeEmail').value,
            department: document.getElementById('employeeDepartment').value,
            position: document.getElementById('employeePosition').value,
            salary: parseFloat(document.getElementById('employeeSalary').value),
            bankAccount: document.getElementById('employeeBankAccount').value
        };

        try {
            this.showLoading();
            
            const response = await fetch(`${API_BASE_URL}/employees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('تم إضافة الموظف بنجاح', 'success');
                bootstrap.Modal.getInstance(document.getElementById('addEmployeeModal')).hide();
                document.getElementById('addEmployeeForm').reset();
                this.loadEmployeesData();
            } else {
                this.showToast(data.message, 'error');
            }
            
        } catch (error) {
            console.error('Error saving employee:', error);
            this.showToast('فشل حفظ بيانات الموظف', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async fetchData(endpoint) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }

    initializeCharts() {
        // تهيئة الرسوم البيانية
        this.charts = {};
    }

    updateDepartmentChart() {
        const ctx = document.getElementById('departmentChart');
        if (!ctx) return;

        if (this.charts.department) {
            this.charts.department.destroy();
        }

        this.charts.department = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['التكنولوجيا', 'المبيعات', 'الموارد البشرية', 'المالية', 'التسويق'],
                datasets: [{
                    label: 'إجمالي الرواتب (ريال)',
                    data: [850000, 650000, 350000, 420000, 380000],
                    backgroundColor: [
                        'rgba(52, 152, 219, 0.7)',
                        'rgba(46, 204, 113, 0.7)',
                        'rgba(155, 89, 182, 0.7)',
                        'rgba(241, 196, 15, 0.7)',
                        'rgba(231, 76, 60, 0.7)'
                    ],
                    borderColor: [
                        'rgba(52, 152, 219, 1)',
                        'rgba(46, 204, 113, 1)',
                        'rgba(155, 89, 182, 1)',
                        'rgba(241, 196, 15, 1)',
                        'rgba(231, 76, 60, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    formatNumber(num) {
        return new Intl.NumberFormat('ar-SA').format(num);
    }

    getDepartmentName(dept) {
        const departments = {
            'Technology': 'التكنولوجيا',
            'Sales': 'المبيعات',
            'HR': 'الموارد البشرية',
            'Finance': 'المالية',
            'Marketing': 'التسويق'
        };
        return departments[dept] || dept;
    }
}

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.payrollSystem = new PayrollSystem();
});

// وظائف مساعدة
function editEmployee(id) {
    console.log('Edit employee:', id);
    // سيتم تنفيذها لاحقاً
}

function deleteEmployee(id) {
    if (confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
        console.log('Delete employee:', id);
        // سيتم تنفيذها لاحقاً
    }
}