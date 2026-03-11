/**
 * Phase 2 Testing: Matcher Logic Enhancement
 * Tests for forced tailoring functionality
 */

// Test message structures for matcher
export const testMessages = {
  
  // Normal scraped job (existing behavior should remain unchanged)
  normalScrapedJob: {
    jobId: "scraped-job-id-123",
    campaignId: "campaign-id-456", 
    resumeId: "resume-id-789",
    // No isManualJob or forceTailoring flags
    title: "Software Engineer",
    companyName: "Tech Corp"
  },

  // Manual job with force tailoring enabled
  manualJobWithForceTailoring: {
    jobId: "manual-job-id-123",
    campaignId: "default-campaign-id-456",
    resumeId: "resume-id-789",
    isManualJob: true,
    forceTailoring: true,
    title: "Senior Backend Engineer",
    companyName: "Startup Inc"
  },

  // Manual job with force tailoring disabled
  manualJobWithoutForceTailoring: {
    jobId: "manual-job-id-456", 
    campaignId: "default-campaign-id-456",
    resumeId: "resume-id-789",
    isManualJob: true,
    forceTailoring: false,
    title: "Frontend Developer",
    companyName: "Design Co"
  }
};

// Expected behaviors for each test case
export const expectedBehaviors = {
  
  normalScrapedJob: {
    description: "Normal scraped job should follow existing AI decision logic",
    shouldLogManualJob: false,
    shouldLogForceTailoring: false,
    tailoringDecision: "Based on AI analysis only",
    expectedLogPatterns: [
      "[Matcher Service] Starting match for Job ID:",
      // Should NOT see manual job logs
    ],
    shouldNotSeeLogPatterns: [
      "[Manual Job] Processing manual job",
      "[Manual Job] Forcing tailoring"
    ]
  },

  manualJobWithForceTailoring: {
    description: "Manual job with force tailoring should override AI decision",
    shouldLogManualJob: true,
    shouldLogForceTailoring: true,
    tailoringDecision: "Always tailor (override AI)",
    expectedLogPatterns: [
      "[Matcher Service] Starting match for Job ID:",
      "[Manual Job] Processing manual job. Force tailoring: true",
      "[Manual Job] Forcing tailoring for job",
      "Manual job with user-requested tailoring (AI decision overridden)",
      "[Matcher Service] Publishing for tailoring"
    ]
  },

  manualJobWithoutForceTailoring: {
    description: "Manual job without force tailoring should follow AI decision",
    shouldLogManualJob: true,
    shouldLogForceTailoring: false,
    tailoringDecision: "Based on AI analysis",
    expectedLogPatterns: [
      "[Matcher Service] Starting match for Job ID:",
      "[Manual Job] Processing manual job. Force tailoring: false",
    ],
    conditionalBehavior: {
      ifAiSaysNo: [
        "[Manual Job] User chose not to force tailoring"
      ],
      ifAiSaysYes: [
        "[Matcher Service] AI decision is positive"
      ]
    }
  }
};

// Test scenarios with different AI responses
export const aiResponseScenarios = {
  
  strongFit: {
    action_plan: {
      application_strategy: "STRONG FIT - APPLY NOW"
    },
    shouldTailorWithoutForce: true,
    description: "AI recommends strong fit - should tailor normally"
  },

  goodFit: {
    action_plan: {
      application_strategy: "GOOD FIT - TAILOR & APPLY"
    },
    shouldTailorWithoutForce: true,
    description: "AI recommends good fit - should tailor normally"
  },

  reach: {
    action_plan: {
      application_strategy: "REACH - REQUIRES SIGNIFICANT TAILORING"
    },
    shouldTailorWithoutForce: false,
    description: "AI recommends reach - should NOT tailor normally"
  },

  poorFit: {
    action_plan: {
      application_strategy: "POOR FIT - RECONSIDER"
    },
    shouldTailorWithoutForce: false,
    description: "AI recommends poor fit - should NOT tailor normally"
  }
};

// Decision matrix for comprehensive testing
export const decisionMatrix = [
  // [Job Type, Force Tailoring, AI Decision, Expected Outcome, Should Send to Tailor Queue]
  
  // Normal scraped jobs (existing behavior)
  ["scraped", false, "STRONG FIT - APPLY NOW", "AI decision followed", true],
  ["scraped", false, "GOOD FIT - TAILOR & APPLY", "AI decision followed", true],
  ["scraped", false, "REACH - REQUIRES SIGNIFICANT TAILORING", "AI decision followed", false],
  ["scraped", false, "POOR FIT - RECONSIDER", "AI decision followed", false],
  
  // Manual jobs with force tailoring OFF (should follow AI)
  ["manual", false, "STRONG FIT - APPLY NOW", "AI decision followed", true],
  ["manual", false, "GOOD FIT - TAILOR & APPLY", "AI decision followed", true], 
  ["manual", false, "REACH - REQUIRES SIGNIFICANT TAILORING", "AI decision followed", false],
  ["manual", false, "POOR FIT - RECONSIDER", "AI decision followed", false],
  
  // Manual jobs with force tailoring ON (should always tailor)
  ["manual", true, "STRONG FIT - APPLY NOW", "User override - forced tailoring", true],
  ["manual", true, "GOOD FIT - TAILOR & APPLY", "User override - forced tailoring", true],
  ["manual", true, "REACH - REQUIRES SIGNIFICANT TAILORING", "User override - forced tailoring", true],
  ["manual", true, "POOR FIT - RECONSIDER", "User override - forced tailoring", true]
];

// Test runner logic
export const validateDecisionLogic = () => {
  console.log("🧪 Testing Phase 2: Matcher Logic Enhancement");
  console.log("=" .repeat(60));
  
  console.log("\n📋 Decision Matrix Validation:");
  console.log("Format: [Job Type, Force Tailoring, AI Decision, Expected Outcome, Should Queue]");
  console.log("-" .repeat(60));
  
  decisionMatrix.forEach(([jobType, forceTailoring, aiDecision, expectedOutcome, shouldQueue], index) => {
    const isManualJob = jobType === "manual";
    
    // Simulate our logic
    const positiveStrategies = ['STRONG FIT - APPLY NOW', 'GOOD FIT - TAILOR & APPLY'];
    const aiWouldTailor = positiveStrategies.includes(aiDecision);
    
    let actualShouldQueue;
    let actualReason;
    
    if (isManualJob && forceTailoring) {
      // Force tailoring for manual jobs
      actualShouldQueue = true;
      actualReason = "User override - forced tailoring";
    } else if (aiWouldTailor) {
      // AI recommends tailoring
      actualShouldQueue = true;
      actualReason = "AI decision followed";
    } else {
      // AI recommends no tailoring
      actualShouldQueue = false;
      actualReason = "AI decision followed";
    }
    
    const testPassed = (actualShouldQueue === shouldQueue) && (actualReason === expectedOutcome);
    const status = testPassed ? "✅ PASS" : "❌ FAIL";
    
    console.log(`${(index + 1).toString().padStart(2)}. ${status} [${jobType}, force:${forceTailoring}, ${aiDecision.slice(0, 10)}...] → ${actualReason}`);
    
    if (!testPassed) {
      console.log(`    Expected: queue=${shouldQueue}, reason="${expectedOutcome}"`);
      console.log(`    Actual:   queue=${actualShouldQueue}, reason="${actualReason}"`);
    }
  });
  
  console.log("\n" + "=".repeat(60));
  console.log("🏁 Phase 2 logic validation complete!");
};

// Message format validation
export const validateMessageFormat = () => {
  console.log("\n🔍 Testing Queue Message Format");
  console.log("=" .repeat(40));
  
  Object.entries(testMessages).forEach(([messageType, message]) => {
    console.log(`\n📤 ${messageType}:`);
    console.log(`   Required fields: jobId=${!!message.jobId}, campaignId=${!!message.campaignId}, resumeId=${!!message.resumeId}`);
    console.log(`   Manual job flags: isManualJob=${message.isManualJob || false}, forceTailoring=${message.forceTailoring || false}`);
    
    // Validate required fields
    const hasRequired = message.jobId && message.campaignId && message.resumeId;
    console.log(`   ✅ Message structure: ${hasRequired ? 'VALID' : 'INVALID'}`);
  });
};

// Run validation if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  validateDecisionLogic();
  validateMessageFormat();
}
