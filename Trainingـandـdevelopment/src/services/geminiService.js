const { GoogleGenerativeAI } = require('@google/generative-ai');
const monitoringService = require('./monitoringService');

class GeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    async generateContent(prompt, options = {}) {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(prompt, options);
        
        try {
            // Check cache first
            if (options.useCache !== false && this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    monitoringService.trackGeminiApiCall('cache', 'hit', 0);
                    return cached.response;
                }
            }
            
            // Generate content
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Cache the response
            if (options.useCache !== false) {
                this.cache.set(cacheKey, {
                    response: text,
                    timestamp: Date.now()
                });
            }
            
            const duration = (Date.now() - startTime) / 1000;
            monitoringService.trackGeminiApiCall('generate', 'success', duration);
            
            return text;
        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            monitoringService.trackGeminiApiCall('generate', 'error', duration);
            
            console.error('Gemini API Error:', error);
            throw new Error(`Failed to generate content: ${error.message}`);
        }
    }

    async analyzeSkillGaps(employeeSkills, requiredSkills, jobRole) {
        const prompt = `
        كخبير في تحليل المهارات وتطوير الموارد البشرية، قم بتحليل الفجوات المعرفية التالية:
        
        بيانات الموظف:
        - المهارات الحالية: ${employeeSkills.map(s => `${s.name}: ${s.level}`).join(', ')}
        - الوظيفة: ${jobRole}
        
        المهارات المطلوبة للوظيفة:
        ${requiredSkills.map(skill => `- ${skill.name}: ${skill.level}`).join('\n')}
        
        قدم تحليلاً شاملاً يتضمن:
        1. تحديد الفجوات المحددة بين المهارات الحالية والمطلوبة
        2. تقييم مستوى كل فجوة (منخفض، متوسط، عالي، حرج)
        3. توصيات بالدورات التدريبية المناسبة لكل فجوة
        4. أولوية معالجة كل فجوة بناءً على تأثيرها على الأداء الوظيفي
        5. الجدول الزمني المقترح لسد الفجوات
        
        قدم النتائج بتنسيق JSON واضح مع الحقول التالية:
        {
            "gaps": [
                {
                    "skill": "اسم المهارة",
                    "currentLevel": "المستوى الحالي",
                    "requiredLevel": "المستوى المطلوب",
                    "gapLevel": "مستوى الفجوة",
                    "priority": "الأولوية",
                    "recommendedCourses": ["دورات مقترحة"],
                    "timeline": "الجدول الزمني"
                }
            ],
            "overallAssessment": "تقييم شامل",
            "recommendations": ["توصيات عامة"]
        }
        `;
        
        try {
            const response = await this.generateContent(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Invalid response format from Gemini API');
        } catch (error) {
            console.error('Error analyzing skill gaps:', error);
            throw error;
        }
    }

    async generateTrainingContent(params) {
        const prompt = `
        قم بإنشاء محتوى تدريبي احترافي بالمواصفات التالية:
        
        العنوان: ${params.title}
        نوع المحتوى: ${params.contentType}
        الفئة المستهدفة: ${params.targetAudience}
        مستوى الصعوبة: ${params.difficultyLevel}
        المدة التقديرية: ${params.duration}
        المواضيع الرئيسية: ${params.topics.join(', ')}
        
        المتطلبات:
        - المحتوى يجب أن يكون تفاعلي وجذاب
        - يجب أن يتضمن أمثلة عملية وتطبيقات واقعية
        - يجب أن يكون مناسباً لمستوى الصعوبة المحدد
        - يجب أن يغطي جميع المواضيع الرئيسية المذكورة
        
        قدم المحتوى بتنسيق منظم يتضمن:
        1. مقدمة وأهداف التدريب
        2. المحتوى الرئيسي مقسم إلى أقسام
        3. أنشطة تفاعلية وتمارين
        4. تقييم واختبار نهائي
        5. مصادر إضافية
        
        قدم النتائج بتنسيق JSON واضح.
        `;
        
        try {
            const response = await this.generateContent(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Invalid response format from Gemini API');
        } catch (error) {
            console.error('Error generating training content:', error);
            throw error;
        }
    }

    async evaluateEmployeePerformance(employeeData, trainingData) {
        const prompt = `
        كخبير في تقييم الأداء وتطوير المهارات، قم بتقييم أداء الموظف التالي:
        
        بيانات الموظف:
        - الاسم: ${employeeData.name}
        - الوظيفة: ${employeeData.position}
        - القسم: ${employeeData.department}
        - المهارات: ${employeeData.skills.map(s => `${s.name}: ${s.level}`).join(', ')}
        
        بيانات التدريب:
        - الدورات المكتملة: ${trainingData.completedTrainings.length}
        - الدورات قيد التقدم: ${trainingData.ongoingTrainings.length}
        - متوسط التقييم: ${trainingData.averageRating}
        
        قم بتقييم الأداء باستخدام نظام Xi/Xu حيث:
        - Xi: مؤشر الأداء الأولي (قبل التدريب)
        - Xu: مؤشر الأداء النهائي (بعد التدريب)
        - ΔX: نسبة التحسن
        
        قدم تحليلاً شاملاً يتضمن:
        1. تقييم Xi (1-5) لكل مجال من المجالات التالية:
           - المهارات التقنية
           - المهارات القيادية
           - التواصل الفعال
           - حل المشكلات
           - الابتكار والإبداع
        
        2. تقييم Xu (1-5) لنفس المجالات
        3. حساب ΔX لكل مجال
        4. تقييم شامل للتحسن العام
        5. توصيات لتحسين الأداء المستقبلي
        
        قدم النتائج بتنسيق JSON واضح.
        `;
        
        try {
            const response = await this.generateContent(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Invalid response format from Gemini API');
        } catch (error) {
            console.error('Error evaluating employee performance:', error);
            throw error;
        }
    }

    async generatePersonalizedLearningPath(employeeData, careerGoals) {
        const prompt = `
        كخبير في تطوير المسارات التعليمية، قم بإنشاء مسار تعليمي مخصص للموظف التالي:
        
        بيانات الموظف:
        - الاسم: ${employeeData.name}
        - الوظيفة: ${employeeData.position}
        - القسم: ${employeeData.department}
        - المهارات الحالية: ${employeeData.skills.map(s => `${s.name}: ${s.level}`).join(', ')}
        - الأهداف المهنية: ${careerGoals.join(', ')}
        
        قم بإنشاء مسار تعليمي مخصص يتضمن:
        1. تحليل الفجوات بين المهارات الحالية والأهداف المهنية
        2. توصية بالدورات التدريبية المناسبة
        3. ترتيب الدورات حسب الأولوية والتبعية
        4. الجدول الزمني المقترح
        5. معايير النجاح والتقييم
        
        قدم النتائج بتنسيق JSON واضح.
        `;
        
        try {
            const response = await this.generateContent(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            throw new Error('Invalid response format from Gemini API');
        } catch (error) {
            console.error('Error generating personalized learning path:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            const result = await this.model.generateContent('Test');
            return { status: 'healthy', response: 'OK' };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }

    generateCacheKey(prompt, options) {
        const key = `${prompt}-${JSON.stringify(options)}`;
        return require('crypto').createHash('md5').update(key).digest('hex');
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = new GeminiService();