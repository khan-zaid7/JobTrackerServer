import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema({
    originalName: { type: String },
    filePath: { type: String },
    textContent: { type: String },
    isMaster: { type: Boolean, default: false },
    summary: {
        type: {
            candidate: {
                name: { type: String, default: "" },
                contact: {
                    email: { type: String, default: "" },
                    phone: { type: String, default: "" },
                    linkedin: { type: String, default: "" },
                    github: { type: String, default: "" }
                },
                headline: { type: String, default: "" },
                summary: { type: String, default: "" },
                core_themes: { type: [String], default: [] },
                technical_skills: {
                    languages: { type: [String], default: [] },
                    backend: { type: [String], default: [] },
                    frontend: { type: [String], default: [] },
                    databases: { type: [String], default: [] },
                    cloud_devops: { type: [String], default: [] },
                    ai_automation: { type: [String], default: [] }
                },
                projects: [{
                    name: { type: String, default: "" },
                    problem_solved: { type: String, default: "" },
                    architecture: { type: String, default: "" },
                    ai_role: { type: String, default: "" },
                    stack: { type: [String], default: [] },
                    highlights: { type: [String], default: [] }
                }],
                experience: [{
                    title: { type: String, default: "" },
                    company: { type: String, default: "" },
                    location: { type: String, default: "" },
                    dates: { type: String, default: "" },
                    achievements: { type: [String], default: [] }
                }],
                education: [{
                    institution: { type: String, default: "" },
                    credential: { type: String, default: "" },
                    dates: { type: String, default: "" },
                    coursework: { type: [String], default: [] }
                }],
                soft_skills: { type: [String], default: [] },
                role_fit_indicators: {
                    best_suited_for: { type: [String], default: [] },
                    likely_to_excel_in: { type: [String], default: [] }
                },
                overall_vibe: { type: String, default: "" }
            }
        },
        default: null
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const Resume = mongoose.model('Resume', resumeSchema);

export default Resume;