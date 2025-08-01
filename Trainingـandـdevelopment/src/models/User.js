const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
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
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'employee', 'trainer'],
        default: 'employee'
    },
    department: {
        type: String,
        required: true,
        trim: true
    },
    position: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        default: 'default-avatar.png'
    },
    skills: [{
        name: {
            type: String,
            required: true
        },
        level: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced', 'expert'],
            required: true
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    }],
    trainingPaths: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Training'
    }],
    certificates: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Certificate'
    }],
    mentorships: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mentorship'
    }],
    xiXuScores: [{
        date: {
            type: Date,
            default: Date.now
        },
        xiScore: {
            type: Number,
            min: 0,
            max: 5
        },
        xuScore: {
            type: Number,
            min: 0,
            max: 5
        },
        deltaX: {
            type: Number
        },
        trainingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Training'
        },
        evaluatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    preferences: {
        language: {
            type: String,
            enum: ['ar', 'en'],
            default: 'ar'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            sms: {
                type: Boolean,
                default: false
            },
            push: {
                type: Boolean,
                default: true
            }
        },
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'light'
        }
    },
    deviceTokens: [{
        token: String,
        platform: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: Date,
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

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.deviceTokens;
    return userObject;
};

// Static method to find active users
userSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Static method to find users by role
userSchema.statics.findByRole = function(role) {
    return this.find({ role, isActive: true });
};

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ department: 1, role: 1 });
userSchema.index({ 'skills.name': 1 });

const User = mongoose.model('User', userSchema);
module.exports = User;