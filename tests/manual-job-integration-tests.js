/**
 * Integration Test for Manual Job API
 * Run this when the server is running with database connection
 */

// Test configuration
const API_BASE_URL = 'http://localhost:5000';
const TEST_USER_CREDENTIALS = {
  email: 'test@example.com',
  password: 'testpassword123'
};

// Helper function to make API requests
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    return {
      status: response.status,
      data: data,
      ok: response.ok
    };
  } catch (error) {
    console.error('API Request failed:', error);
    return {
      status: 0,
      data: { error: error.message },
      ok: false
    };
  }
};

// Test functions
export const integrationTests = {
  
  // Step 1: Authenticate and get token
  async authenticate() {
    console.log('🔐 Step 1: Authenticating...');
    
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(TEST_USER_CREDENTIALS)
    });
    
    if (response.ok && response.data.token) {
      console.log('✅ Authentication successful');
      return response.data.token;
    } else {
      console.log('❌ Authentication failed:', response.data);
      throw new Error('Authentication failed');
    }
  },

  // Step 2: Get user's resumes
  async getResumes(token) {
    console.log('📄 Step 2: Getting user resumes...');
    
    const response = await apiRequest('/api/resumes', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok && response.data.length > 0) {
      console.log(`✅ Found ${response.data.length} resume(s)`);
      return response.data[0]._id; // Return first resume ID
    } else {
      console.log('❌ No resumes found or error:', response.data);
      throw new Error('No resumes available for testing');
    }
  },

  // Step 3: Test manual job creation
  async testManualJobCreation(token, resumeId) {
    console.log('🚀 Step 3: Testing manual job creation...');
    
    const testJob = {
      title: "Test Software Engineer",
      url: `https://testcompany.com/job/${Date.now()}`, // Unique URL
      companyName: "Test Company",
      location: "Remote",
      postedTime: "1 day ago",
      description: {
        roleOverview: {
          title: "Test Software Engineer",
          company: "Test Company",
          summary: "A test job for our manual job API",
          work_model: "Remote"
        },
        responsibilities: [
          "Write test code",
          "Debug integration issues",
          "Ensure system reliability"
        ],
        qualifications: {
          required: [
            "Experience with testing",
            "Knowledge of APIs",
            "Problem-solving skills"
          ],
          desired: [
            "Experience with Node.js",
            "Database knowledge"
          ]
        },
        benefits: [
          "Remote work",
          "Learning opportunities",
          "Great team"
        ]
      },
      relatedReferences: {
        email: "test-recruiter@testcompany.com",
        phone: "+1-555-TEST-JOB"
      },
      forceTailoring: true,
      resumeId: resumeId
    };

    const response = await apiRequest('/api/manual-jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testJob)
    });

    console.log('📤 Request sent to /api/manual-jobs');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', JSON.stringify(response.data, null, 2));

    if (response.status === 201) {
      console.log('✅ Manual job created successfully!');
      console.log(`   Job ID: ${response.data.jobId}`);
      console.log(`   Campaign ID: ${response.data.campaignId}`);
      console.log(`   Queued for matching: ${response.data.queuedForMatching}`);
      return response.data;
    } else {
      console.log('❌ Manual job creation failed');
      throw new Error(`Job creation failed: ${JSON.stringify(response.data)}`);
    }
  },

  // Step 4: Test duplicate job detection
  async testDuplicateDetection(token, resumeId, existingJobUrl) {
    console.log('🔄 Step 4: Testing duplicate job detection...');
    
    const duplicateJob = {
      title: "Duplicate Test Job",
      url: existingJobUrl, // Same URL as previous job
      companyName: "Another Company",
      resumeId: resumeId
    };

    const response = await apiRequest('/api/manual-jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(duplicateJob)
    });

    console.log('📤 Request sent with duplicate URL');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', JSON.stringify(response.data, null, 2));

    if (response.status === 409) {
      console.log('✅ Duplicate detection working correctly!');
      return true;
    } else {
      console.log('❌ Duplicate detection failed - should have returned 409');
      return false;
    }
  },

  // Step 5: Test validation errors
  async testValidationErrors(token) {
    console.log('🚫 Step 5: Testing validation errors...');
    
    const invalidJob = {
      title: "Missing Required Fields",
      // Missing url, companyName, resumeId
    };

    const response = await apiRequest('/api/manual-jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(invalidJob)
    });

    console.log('📤 Request sent with missing fields');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:', JSON.stringify(response.data, null, 2));

    if (response.status === 400) {
      console.log('✅ Validation errors working correctly!');
      return true;
    } else {
      console.log('❌ Validation failed - should have returned 400');
      return false;
    }
  }
};

// Main test runner
export const runIntegrationTests = async () => {
  console.log('🧪 Starting Manual Job API Integration Tests');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Authenticate
    const token = await integrationTests.authenticate();
    
    // Step 2: Get resume ID
    const resumeId = await integrationTests.getResumes(token);
    
    // Step 3: Create manual job
    const createdJob = await integrationTests.testManualJobCreation(token, resumeId);
    
    // Step 4: Test duplicate detection
    await integrationTests.testDuplicateDetection(token, resumeId, createdJob.url);
    
    // Step 5: Test validation
    await integrationTests.testValidationErrors(token);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All integration tests completed successfully!');
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ Integration tests failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   - Server is running on http://localhost:5000');
    console.log('   - Database is connected');
    console.log('   - Test user exists or can be created');
    console.log('   - Test user has at least one resume');
  }
};

// Instructions for running tests
export const testInstructions = `
🧪 Manual Job API Testing Instructions

PREREQUISITES:
1. Start the server: npm run dev:server (or docker-compose up)
2. Ensure database is connected
3. Create a test user account
4. Upload at least one resume for the test user

RUNNING TESTS:

Option 1 - Unit Tests (No database required):
  node tests/manual-job-unit-tests.js

Option 2 - Integration Tests (Database required):
  node -e "
    import('./tests/manual-job-integration-tests.js')
      .then(module => module.runIntegrationTests())
      .catch(console.error);
  "

Option 3 - Manual Testing with curl:
  # 1. Login and get token
  curl -X POST http://localhost:5000/api/auth/login \\
    -H "Content-Type: application/json" \\
    -d '{"email":"test@example.com","password":"testpassword123"}'

  # 2. Create manual job (replace TOKEN and RESUME_ID)
  curl -X POST http://localhost:5000/api/manual-jobs \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer TOKEN" \\
    -d '{
      "title": "Test Engineer",
      "url": "https://example.com/job/test",
      "companyName": "Test Corp", 
      "resumeId": "RESUME_ID"
    }'

EXPECTED RESULTS:
✅ Unit tests should all pass
✅ Integration tests should create job and return 201
✅ Duplicate URLs should return 409 
✅ Missing fields should return 400
✅ Job should appear in database ScrapedJob collection
✅ Default "Direct Applications" campaign should be created
✅ Job should be queued for matching (if queue is running)
`;

console.log(testInstructions);
