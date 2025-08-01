const EventEmitter = require('events');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const User = require('../models/User');
const Training = require('../models/Training');
const Certificate = require('../models/Certificate');
const Mentorship = require('../models/Mentorship');

class NotificationService extends EventEmitter {
    constructor() {
        super();
        this.emailTransporter = null;
        this.templates = this.loadTemplates();
        this.scheduledJobs = new Map();
        this.initialize();
    }

    async initialize() {
        try {
            this.emailTransporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await this.emailTransporter.verify();
            console.log('Email service initialized successfully');
            
            this.setupScheduledTasks();
        } catch (error) {
            console.error('Failed to initialize notification service:', error);
        }
    }

    loadTemplates() {
        return {
            WELCOME: {
                subject: 'مرحباً بك في نظام Xi/Xu للتدريب والتطوير',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 24px;">نظام Xi/Xu للتدريب والتطوير</h1>
                        </div>
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #2c3e50; margin-top: 0;">مرحباً {name}،</h2>
                            <p style="color: #34495e; line-height: 1.6;">
                                نشكرك على انضمامك إلى نظام Xi/Xu للتدريب والتطوير. نحن متحمسون لمساعدتك في رحلتك التطويرية.
                            </p>
                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #2c3e50; margin-top: 0;">ماذا يمكنك فعله؟</h3>
                                <ul style="color: #34495e; line-height: 1.8;">
                                    <li>تحليل الفجوات المعرفية</li>
                                    <li>إنشاء مسارات تدريبية مخصصة</li>
                                    <li>توليد محتوى تدريبي ذكي</li>
                                    <li>تقييم الأداء بنظام Xi/Xu</li>
                                    <li>الحصول على شهادات معتمدة</li>
                                </ul>
                            </div>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="{loginUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">ابدأ الآن</a>
                            </div>
                        </div>
                        <div style="text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px;">
                            <p>هذه رسالة آلية من نظام Xi/Xu للتدريب والتطوير</p>
                            <p>© 2024 Xi/Xu. جميع الحقوق محفوظة.</p>
                        </div>
                    </div>
                `
            },
            TRAINING_REMINDER: {
                subject: 'تذكير بالتدريب: {trainingTitle}',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 24px;">تذكير بالتدريب</h1>
                        </div>
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #2c3e50; margin-top: 0;">عزيزي {name}،</h2>
                            <p style="color: #34495e; line-height: 1.6;">
                                هذا تذكير بالتدريب القادم:
                            </p>
                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #2c3e50; margin-top: 0;">{trainingTitle}</h3>
                                <p style="color: #34495e; margin: 5px 0;"><strong>التاريخ:</strong> {date}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>الوقت:</strong> {time}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>المكان:</strong> {location}</p>
                                {meetingLink}
                            </div>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="{trainingUrl}" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">عرض التفاصيل</a>
                            </div>
                        </div>
                        <div style="text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px;">
                            <p>هذه رسالة آلية من نظام Xi/Xu للتدريب والتطوير</p>
                            <p>© 2024 Xi/Xu. جميع الحقوق محفوظة.</p>
                        </div>
                    </div>
                `
            },
            CERTIFICATE_EXPIRY: {
                subject: 'تنبيه انتهاء الشهادة: {certificateName}',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 24px;">تنبيه انتهاء الشهادة</h1>
                        </div>
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #2c3e50; margin-top: 0;">عزيزي {name}،</h2>
                            <p style="color: #34495e; line-height: 1.6;">
                                نود إعلامك بأن شهادتك "{certificateName}" ستنتهي خلال {daysLeft} يوم.
                            </p>
                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #2c3e50; margin-top: 0;">تفاصيل الشهادة</h3>
                                <p style="color: #34495e; margin: 5px 0;"><strong>اسم الشهادة:</strong> {certificateName}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>تاريخ الانتهاء:</strong> {expiryDate}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>الجهة المانحة:</strong> {issuer}</p>
                            </div>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="{renewalUrl}" style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">تجديد الشهادة</a>
                            </div>
                        </div>
                        <div style="text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px;">
                            <p>هذه رسالة آلية من نظام Xi/Xu للتدريب والتطوير</p>
                            <p>© 2024 Xi/Xu. جميع الحقوق محفوظة.</p>
                        </div>
                    </div>
                `
            },
            TRAINING_COMPLETION: {
                subject: 'تهانينا! إكمال التدريب: {trainingTitle}',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 24px;">تهانينا على الإكمال!</h1>
                        </div>
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #2c3e50; margin-top: 0;">عزيزي {name}،</h2>
                            <p style="color: #34495e; line-height: 1.6;">
                                تهانينا على إكمالك بنجاح تدريب "{trainingTitle}".
                            </p>
                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #2c3e50; margin-top: 0;">تفاصيل الإنجاز</h3>
                                <p style="color: #34495e; margin: 5px 0;"><strong>التدريب:</strong> {trainingTitle}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>تاريخ الإكمال:</strong> {completionDate}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>الدرجة:</strong> {score}%</p>
                                {certificateHtml}
                            </div>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="{profileUrl}" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">عرض الملف الشخصي</a>
                            </div>
                        </div>
                        <div style="text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px;">
                            <p>هذه رسالة آلية من نظام Xi/Xu للتدريب والتطوير</p>
                            <p>© 2024 Xi/Xu. جميع الحقوق محفوظة.</p>
                        </div>
                    </div>
                `
            },
            MENTORSHIP_SESSION: {
                subject: 'تذكير بجلسة الإرشاد',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #d299c2 0%, #fef9d7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 24px;">تذكير بجلسة الإرشاد</h1>
                        </div>
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2 style="color: #2c3e50; margin-top: 0;">عزيزي {name}،</h2>
                            <p style="color: #34495e; line-height: 1.6;">
                                هذا تذكير بجلسة الإرشاد القادمة:
                            </p>
                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="color: #2c3e50; margin-top: 0;">تفاصيل الجلسة</h3>
                                <p style="color: #34495e; margin: 5px 0;"><strong>المرشد:</strong> {mentorName}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>الموضوع:</strong> {topic}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>التاريخ:</strong> {date}</p>
                                <p style="color: #34495e; margin: 5px 0;"><strong>الوقت:</strong> {time}</p>
                                {meetingLink}
                            </div>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="{sessionUrl}" style="background: linear-gradient(135deg, #d299c2 0%, #fef9d7 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">عرض التفاصيل</a>
                            </div>
                        </div>
                        <div style="text-align: center; padding: 20px; color: #7f8c8d; font-size: 12px;">
                            <p>هذه رسالة آلية من نظام Xi/Xu للتدريب والتطوير</p>
                            <p>© 2024 Xi/Xu. جميع الحقوق محفوظة.</p>
                        </div>
                    </div>
                `
            }
        };
    }

    setupScheduledTasks() {
        // Check certificate expiry daily at 9 AM
        this.scheduledJobs.set('certificate-expiry', cron.schedule('0 9 * * *', async () => {
            await this.checkCertificateExpiry();
        }));

        // Send training reminders daily at 8 AM
        this.scheduledJobs.set('training-reminders', cron.schedule('0 8 * * *', async () => {
            await this.sendTrainingReminders();
        }));

        // Send mentorship session reminders daily at 7 AM
        this.scheduledJobs.set('mentorship-reminders', cron.schedule('0 7 * * *', async () => {
            await this.sendMentorshipReminders();
        }));

        // Weekly analytics report every Monday at 6 AM
        this.scheduledJobs.set('weekly-report', cron.schedule('0 6 * * 1', async () => {
            await this.sendWeeklyAnalyticsReport();
        }));
    }

    async sendNotification(type, recipient, data, options = {}) {
        try {
            const template = this.templates[type];
            if (!template) {
                throw new Error(`Notification template not found: ${type}`);
            }

            const personalizedData = this.personalizeTemplate(template, data);
            
            // Send email notification
            if (recipient.preferences?.notifications?.email !== false) {
                await this.sendEmailNotification(recipient.email, personalizedData);
            }
            
            // Send push notification if device token is available
            if (recipient.deviceTokens && recipient.preferences?.notifications?.push !== false) {
                await this.sendPushNotification(recipient.deviceTokens, personalizedData.subject, personalizedData.message);
            }
            
            // Emit real-time notification
            this.emit('notificationSent', {
                type,
                recipient: recipient._id,
                data: personalizedData,
                timestamp: new Date()
            });
            
            // Log notification
            await this.logNotification(type, recipient._id, personalizedData);
            
            return { success: true, message: 'Notification sent successfully' };
        } catch (error) {
            console.error('Error sending notification:', error);
            throw error;
        }
    }

    personalizeTemplate(template, data) {
        let subject = template.subject;
        let html = template.html;

        // Special handling for certificateHtml placeholder
        if ('certificateUrl' in data) {
            data.certificateHtml = data.certificateUrl
                ? `<p style="color: #34495e; margin: 5px 0;"><strong>الشهادة:</strong> <a href="${data.certificateUrl}">تحميل الشهادة</a></p>`
                : '';
        }

        // Replace placeholders with actual data
        Object.keys(data).forEach(key => {
            const placeholder = `{${key}}`;
            const value = data[key];
            subject = subject.replace(new RegExp(placeholder, 'g'), value);
            html = html.replace(new RegExp(placeholder, 'g'), value);
        });

        // Extract plain text from HTML
        const message = html.replace(/<[^>]*>/g, '').trim();

        return { subject, html, message };
    }

    async sendEmailNotification(email, data) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: data.subject,
                html: data.html
            };
            
            await this.emailTransporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Error sending email notification:', error);
            throw error;
        }
    }

    async sendPushNotification(deviceTokens, title, message) {
        // Implementation for push notifications
        // This would integrate with services like Firebase Cloud Messaging
        console.log(`Push notification sent to ${deviceTokens.length} devices: ${title} - ${message}`);
    }

    async checkCertificateExpiry() {
        try {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            
            const expiringCertificates = await Certificate.find({
                expiryDate: { $lte: thirtyDaysFromNow, $gte: new Date() },
                status: 'active'
            }).populate('user', 'name email preferences deviceTokens');
            
            for (const cert of expiringCertificates) {
                const daysLeft = Math.ceil((cert.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                
                await this.sendNotification('CERTIFICATE_EXPIRY', cert.user, {
                    name: cert.user.name,
                    certificateName: cert.name,
                    daysLeft: daysLeft,
                    expiryDate: cert.expiryDate.toLocaleDateString('ar-SA'),
                    issuer: cert.issuer,
                    renewalUrl: `${process.env.FRONTEND_URL}/certificates/${cert._id}`
                });
            }
        } catch (error) {
            console.error('Error checking certificate expiry:', error);
        }
    }

    async sendTrainingReminders() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const upcomingTrainings = await Training.find({
                'schedule.startDate': {
                    $lte: tomorrow,
                    $gte: new Date()
                },
                status: 'active'
            }).populate('participants.user', 'name email preferences deviceTokens');
            
            for (const training of upcomingTrainings) {
                for (const participant of training.participants) {
                    if (participant.user.preferences?.notifications?.email !== false) {
                        await this.sendNotification('TRAINING_REMINDER', participant.user, {
                            name: participant.user.name,
                            trainingTitle: training.title,
                            date: training.schedule.startDate.toLocaleDateString('ar-SA'),
                            time: training.schedule.sessions[0]?.startTime || '09:00',
                            location: training.schedule.sessions[0]?.location || 'عنوان التدريب',
                            meetingLink: training.schedule.sessions[0]?.meetingLink,
                            trainingUrl: `${process.env.FRONTEND_URL}/trainings/${training._id}`
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error sending training reminders:', error);
        }
    }

    async sendMentorshipReminders() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const upcomingSessions = await Mentorship.find({
                'sessions.date': {
                    $lte: tomorrow,
                    $gte: new Date()
                },
                status: 'active'
            }).populate('mentor mentee', 'name email preferences deviceTokens');
            
            for (const mentorship of upcomingSessions) {
                const session = mentorship.sessions.find(s => 
                    s.date >= new Date() && s.date <= tomorrow
                );
                
                if (session) {
                    // Notify mentee
                    await this.sendNotification('MENTORSHIP_SESSION', mentorship.mentee, {
                        name: mentorship.mentee.name,
                        mentorName: mentorship.mentor.name,
                        topic: session.topic,
                        date: session.date.toLocaleDateString('ar-SA'),
                        time: session.time,
                        meetingLink: session.meetingLink,
                        sessionUrl: `${process.env.FRONTEND_URL}/mentorships/${mentorship._id}`
                    });
                    
                    // Notify mentor
                    await this.sendNotification('MENTORSHIP_SESSION', mentorship.mentor, {
                        name: mentorship.mentor.name,
                        mentorName: mentorship.mentee.name,
                        topic: session.topic,
                        date: session.date.toLocaleDateString('ar-SA'),
                        time: session.time,
                        meetingLink: session.meetingLink,
                        sessionUrl: `${process.env.FRONTEND_URL}/mentorships/${mentorship._id}`
                    });
                }
            }
        } catch (error) {
            console.error('Error sending mentorship reminders:', error);
        }
    }

    async sendWeeklyAnalyticsReport() {
        try {
            const managers = await User.find({ role: 'manager', isActive: true });
            
            for (const manager of managers) {
                const reportData = await this.generateWeeklyReport(manager.department);
                
                await this.sendNotification('WEEKLY_REPORT', manager, {
                    name: manager.name,
                    reportData: reportData,
                    reportUrl: `${process.env.FRONTEND_URL}/analytics/weekly`
                });
            }
        } catch (error) {
            console.error('Error sending weekly analytics report:', error);
        }
    }

    async generateWeeklyReport(department) {
        // This would generate weekly analytics report data
        return {
            department,
            totalTrainings: 0,
            completedTrainings: 0,
            averageRating: 0,
            activeParticipants: 0,
            expiringCertificates: 0
        };
    }

    async logNotification(type, recipientId, data) {
        // Log notification to database for tracking
        console.log(`Notification logged: ${type} to ${recipientId}`);
    }

    // Stop all scheduled jobs
    stopScheduledTasks() {
        this.scheduledJobs.forEach(job => job.stop());
        this.scheduledJobs.clear();
    }
}

module.exports = new NotificationService();