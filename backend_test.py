#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class GridAPITester:
    def __init__(self, base_url="https://session-sync-debug.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            result = {
                "test_name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_data": None,
                "error": None
            }

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result["response_data"] = response.json()
                except:
                    result["response_data"] = response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    result["error"] = error_data
                    print(f"   Error: {error_data}")
                except:
                    result["error"] = response.text
                    print(f"   Error: {response.text}")

            self.test_results.append(result)
            return success, result.get("response_data", {})

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            result = {
                "test_name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": None,
                "success": False,
                "response_data": None,
                "error": str(e)
            }
            self.test_results.append(result)
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n=== Testing Health Endpoints ===")
        
        # Test root endpoint
        self.run_test("Root API", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_presets_crud(self):
        """Test presets CRUD operations"""
        print("\n=== Testing Presets CRUD ===")
        
        # Get all presets
        success, presets = self.run_test("Get All Presets", "GET", "presets", 200)
        
        # Create a test preset
        test_preset = {
            "name": f"Test Preset {datetime.now().strftime('%H%M%S')}",
            "description": "Test preset for API testing",
            "settings": {
                "screen_width": 1920,
                "screen_height": 1080,
                "unit_width": 66,
                "unit_height": 33,
                "grid_color": "#00F0FF",
                "line_thickness": 1.0,
                "opacity": 0.3,
                "show_subdivisions": False,
                "subdivision_count": 2
            }
        }
        
        success, created_preset = self.run_test(
            "Create Preset", "POST", "presets", 200, data=test_preset
        )
        
        if success and created_preset:
            preset_id = created_preset.get('id')
            if preset_id:
                # Get specific preset
                self.run_test(
                    "Get Specific Preset", "GET", f"presets/{preset_id}", 200
                )
                
                # Update preset
                update_data = {
                    "name": f"Updated Test Preset {datetime.now().strftime('%H%M%S')}",
                    "description": "Updated description"
                }
                self.run_test(
                    "Update Preset", "PUT", f"presets/{preset_id}", 200, data=update_data
                )
                
                # Delete preset
                self.run_test(
                    "Delete Preset", "DELETE", f"presets/{preset_id}", 200
                )
            else:
                print("❌ No preset ID returned from create operation")
        
        # Test getting non-existent preset
        self.run_test("Get Non-existent Preset", "GET", "presets/non-existent-id", 404)

    def test_measurements(self):
        """Test measurements endpoints"""
        print("\n=== Testing Measurements ===")
        
        # Get all measurements
        self.run_test("Get All Measurements", "GET", "measurements", 200)
        
        # Create a test measurement
        test_measurement = {
            "start_x": 100.0,
            "start_y": 100.0,
            "end_x": 200.0,
            "end_y": 200.0,
            "pixel_distance": 141.42,
            "unit_distance": 2.14,
            "unit_label": "units"
        }
        
        success, created_measurement = self.run_test(
            "Create Measurement", "POST", "measurements", 200, data=test_measurement
        )
        
        if success and created_measurement:
            measurement_id = created_measurement.get('id')
            if measurement_id:
                # Delete measurement
                self.run_test(
                    "Delete Measurement", "DELETE", f"measurements/{measurement_id}", 200
                )
            else:
                print("❌ No measurement ID returned from create operation")

    def test_default_settings(self):
        """Test default settings endpoint"""
        print("\n=== Testing Default Settings ===")
        self.run_test("Get Default Settings", "GET", "default-settings", 200)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting OverGrid API Tests")
        print(f"   Base URL: {self.base_url}")
        
        self.test_health_endpoints()
        self.test_presets_crud()
        self.test_measurements()
        self.test_default_settings()
        
        # Print summary
        print(f"\n📊 Test Results Summary")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Save detailed results
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump({
                "summary": {
                    "tests_run": self.tests_run,
                    "tests_passed": self.tests_passed,
                    "tests_failed": self.tests_run - self.tests_passed,
                    "success_rate": round(self.tests_passed/self.tests_run*100, 1)
                },
                "test_results": self.test_results,
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        
        return self.tests_passed == self.tests_run

def main():
    tester = GridAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())