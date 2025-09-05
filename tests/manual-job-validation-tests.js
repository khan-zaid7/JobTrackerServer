/**
 * Manual Job Controller - Input Validation Examples
 * 
 * Test cases for various input scenarios
 */

// Minimal valid request (only required fields)
export const minimalValidRequest = {
  title: "Software Engineer",
  url: "https://company.com/job",
  companyName: "Example Corp",
  resumeId: "valid-resume-id",
  // Optional fields will be set to defaults
  forceTailoring: false
};

// Full featured request (all optional fields included)
export const fullFeaturedRequest = {
  title: "Senior Full Stack Developer",
  url: "https://techstartup.com/careers/senior-fullstack",
  companyName: "Tech Startup Inc",
  location: "Remote - US",
  postedTime: "1 week ago",
  description: {
    roleOverview: {
      title: "Senior Full Stack Developer",
      company: "Tech Startup Inc",
      summary: "Join our innovative team building the next generation of web applications.",
      work_model: "Hybrid"
    },
    responsibilities: [
      "Develop full-stack web applications",
      "Collaborate with product team on feature design",
      "Optimize application performance"
    ],
    qualifications: {
      required: [
        "3+ years full-stack development",
        "React and Node.js experience",
        "Database design knowledge"
      ],
      desired: [
        "TypeScript experience",
        "AWS deployment experience",
        "Agile/Scrum methodology"
      ]
    },
    benefits: [
      "Equity participation",
      "Flexible PTO",
      "Learning budget"
    ]
  },
  relatedReferences: {
    email: "hiring@techstartup.com",
    linkedin: "https://linkedin.com/in/hiring-manager"
  },
  forceTailoring: true,
  resumeId: "valid-resume-id"
};

// Invalid requests for testing error handling
export const invalidRequests = {
  missingTitle: {
    url: "https://company.com/job",
    companyName: "Example Corp",
    resumeId: "valid-resume-id"
  },
  
  missingUrl: {
    title: "Software Engineer",
    companyName: "Example Corp", 
    resumeId: "valid-resume-id"
  },
  
  missingCompany: {
    title: "Software Engineer",
    url: "https://company.com/job",
    resumeId: "valid-resume-id"
  },
  
  missingResumeId: {
    title: "Software Engineer",
    url: "https://company.com/job",
    companyName: "Example Corp"
  },
  
  invalidResumeId: {
    title: "Software Engineer",
    url: "https://company.com/job", 
    companyName: "Example Corp",
    resumeId: "non-existent-resume-id"
  },
  
  duplicateUrl: {
    // Same URL as previously created job
    title: "Another Job",
    url: "https://company.com/job", // Same URL
    companyName: "Another Corp",
    resumeId: "valid-resume-id"
  }
};

// Expected behavior for each test case
export const testExpectations = {
  minimalValid: {
    status: 201,
    shouldCreateJob: true,
    shouldCreateDefaultCampaign: true,
    shouldQueueMessage: true
  },
  
  fullFeatured: {
    status: 201,
    shouldCreateJob: true,
    shouldUseExistingCampaign: true, // If default campaign already exists
    shouldQueueMessage: true
  },
  
  missingFields: {
    status: 400,
    shouldCreateJob: false,
    errorMessage: "Missing required fields"
  },
  
  invalidResume: {
    status: 404,
    shouldCreateJob: false,
    errorMessage: "Resume not found or does not belong to user"
  },
  
  duplicate: {
    status: 409,
    shouldCreateJob: false,
    errorMessage: "Job with this URL already exists for this user"
  }
};
