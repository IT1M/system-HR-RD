const mongoose = require('mongoose');

const trainingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        maxlength: 2000
    },
    type: {
        type: String,
        enum: ['online', 'offline', 'hybrid'],
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['technical', 'soft-skills', 'leadership', 'compliance', 'other']
    },
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        required: true
    },
    duration: {
        type: Number,
        required: true,
        min: 1
    },
    durationUnit: {
        type: String,
        enum: ['hours', 'days', 'weeks'],
        default: 'hours'
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['invited', 'confirmed', 'in-progress', 'completed', 'cancelled'],
            default: 'invited'
        },
        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        completionDate: Date,
        score: {
            type: Number,
            min: 0,
            max: 100
        },
        feedback: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            comment: String,
            submittedAt: Date
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    schedule: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        sessions: [{
            date: Date,
            startTime: String,
            endTime: String,
            location: String,
            meetingLink: String,
            materials: [{
                type: String,
                url: String,
                title: String
            }]
        }]
    },
    curriculum: [{
        title: String,
        description: String,
        duration: Number,
        materials: [{
            type: String,
            url: String,
            title: String
        }],
        assessments: [{
            type: {
                type: String,
                enum: ['quiz', 'assignment', 'project']
            },
            title: String,
            description: String,
            dueDate: Date,
            maxScore: Number
        }]
    }],
    objectives: [String],
    prerequisites: [String],
    tags: [String],
    cost: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'SAR'
    },
    maxParticipants: {
        type: Number,
        default: 30
    },
    certificate: {
        template: String,
        autoGenerate: {
            type: Boolean,
            default: true
        }
    },
    evaluation: {
        xiXuEnabled: {
            type: Boolean,
            default: true
        },
        criteria: [{
            name: String,
            weight: {
                type: Number,
                min: 0,
                max: 100
            }
        }]
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'active', 'completed', 'cancelled'],
        default: 'draft'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    publishedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Virtual for participant count
trainingSchema.virtual('participantCount').get(function() {
    return this.participants.length;
});

// Virtual for completion rate
trainingSchema.virtual('completionRate').get(function() {
    if (this.participants.length === 0) return 0;
    const completed = this.participants.filter(p => p.status === 'completed').length;
    return (completed / this.participants.length) * 100;
});

// Virtual for average rating
trainingSchema.virtual('averageRating').get(function() {
    const feedbacks = this.participants
        .map(p => p.feedback)
        .filter(f => f && f.rating);
    
    if (feedbacks.length === 0) return 0;
    
    const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
    return sum / feedbacks.length;
});

// Method to add participant
trainingSchema.methods.addParticipant = function(userId) {
    const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
    
    if (existingParticipant) {
        throw new Error('User is already a participant');
    }
    
    if (this.participants.length >= this.maxParticipants) {
        throw new Error('Training is full');
    }
    
    this.participants.push({
        user: userId,
        status: 'invited'
    });
    
    return this.save();
};

// Method to update participant progress
trainingSchema.methods.updateProgress = function(userId, progress) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    
    if (!participant) {
        throw new Error('Participant not found');
    }
    
    participant.progress = Math.max(0, Math.min(100, progress));
    
    if (progress === 100) {
        participant.status = 'completed';
        participant.completionDate = new Date();
    } else if (progress > 0) {
        participant.status = 'in-progress';
    }
    
    return this.save();
};

// Method to submit feedback
trainingSchema.methods.submitFeedback = function(userId, feedback) {
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    
    if (!participant) {
        throw new Error('Participant not found');
    }
    
    if (participant.status !== 'completed') {
        throw new Error('Training must be completed before submitting feedback');
    }
    
    participant.feedback = {
        ...feedback,
        submittedAt: new Date()
    };
    
    return this.save();
};

// Static method to find active trainings
trainingSchema.statics.findActive = function() {
    return this.find({
        status: 'active',
        'schedule.endDate': { $gte: new Date() }
    }).populate('instructor', 'name email avatar');
};

// Static method to find upcoming trainings
trainingSchema.statics.findUpcoming = function(days = 7) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    return this.find({
        status: 'active',
        'schedule.startDate': {
            $gte: startDate,
            $lte: endDate
        }
    }).populate('instructor', 'name email avatar');
};

// Index for better query performance
trainingSchema.index({ status: 1, 'schedule.startDate': 1 });
trainingSchema.index({ category: 1, difficulty: 1 });
trainingSchema.index({ instructor: 1 });

const Training = mongoose.model('Training', trainingSchema);
module.exports = Training;