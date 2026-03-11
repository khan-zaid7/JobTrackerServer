/**
 * Manual Job Controller - Phase 1 Testing Guide
 * 
 * This file documents how to test the manual job creation functionality
 */

// Example API Request
const exampleRequest = {
  method: 'POST',
  url: '/api/manual-jobs',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-jwt-token>'
  },
  body: {
    title: "Senior Backend Engineer",
    url: "https://example.com/job/senior-backend-engineer",
    companyName: "Tech Corp",
    location: "San Francisco, CA",
    postedTime: "2 days ago",
    description: {
      roleOverview: {
        title: "Senior Backend Engineer",
        company: "Tech Corp",
        summary: "We are looking for an experienced backend engineer to join our growing team.",
        work_model: "Remote"
      },
      responsibilities: [
        "Design and implement scalable backend systems",
        "Lead technical decision making",
        "Mentor junior developers"
      ],
      qualifications: {
        required: [
          "5+ years of backend development experience",
          "Strong experience with Node.js",
          "Experience with databases (SQL/NoSQL)"
        ],
        desired: [
          "AWS cloud experience",
          "Team leadership experience",
          "Microservices architecture knowledge"
        ]
      },
      benefits: [
        "Competitive salary",
        "Health insurance",
        "401k matching",
        "Remote work flexibility"
      ]
    },
    relatedReferences: {
      email: "recruiter@techcorp.com",
      phone: "+1-555-0123",
      linkedin: "https://linkedin.com/in/recruiter-name"
    },
    forceTailoring: true,
    resumeId: "your-resume-id-here"
  }
};

// Expected Response (Success)
const expectedSuccessResponse = {
  status: 201,
  body: {
    message: "Manual job created successfully",
    jobId: "generated-job-id",
    campaignId: "default-campaign-id",
    queuedForMatching: true
  }
};

// Expected Response (Error - Missing fields)
const expectedErrorResponse = {
  status: 400,
  body: {
    error: "Missing required fields: title, url, companyName, resumeId"
  }
};

// Testing Steps:
// 1. Start the server
// 2. Authenticate and get JWT token
// 3. Get a valid resumeId from /api/resumes
// 4. Send POST request to /api/manual-jobs with example payload
// 5. Check database for created job in ScrapedJob collection
// 6. Check database for default campaign creation
// 7. Monitor queue logs for match queue message

export { exampleRequest, expectedSuccessResponse, expectedErrorResponse };
