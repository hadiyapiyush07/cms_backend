// test-api.js
const axios = require('axios');

const testBackend = async () => {
  try {
    // Test 1: Check if server is running
    console.log('🧪 Testing server connection...');
    const testResponse = await axios.get('http://localhost:5000/api/test');
    console.log('✅ Server is running:', testResponse.data);
    
    // Test 2: Test auth routes
    console.log('\n🧪 Testing auth routes...');
    const authTest = await axios.get('http://localhost:5000/api/auth/test');
    console.log('✅ Auth routes are working:', authTest.data);
    
    // Test 3: Test student login with test credentials
    console.log('\n🧪 Testing student login...');
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/student/login', {
        enrollmentId: '202401000001',
        password: 'Student@2024'
      });
      console.log('✅ Login successful:', loginResponse.data);
    } catch (loginError) {
      if (loginError.response?.status === 401) {
        console.log('ℹ️ Login test failed (expected if no test user):', loginError.response.data);
      } else {
        console.log('❌ Login error:', loginError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure backend server is running on port 5000');
    console.log('2. Check if MongoDB is connected');
    console.log('3. Verify routes in server.js');
    console.log('4. Check CORS configuration');
  }
};

testBackend();