"""
Test suite for OverGrid production build serving and download functionality.
Tests the fix for Electron app grid blinking/restarting issue.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_returns_200(self):
        """Health endpoint should return 200 with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data


class TestProductionBuildServing:
    """Tests for production React build serving at /api/app-stable/"""
    
    def test_production_build_fullscreen_returns_html(self):
        """Production build at /api/app-stable/fullscreen should return valid HTML"""
        response = requests.get(f"{BASE_URL}/api/app-stable/fullscreen")
        assert response.status_code == 200
        assert "<!doctype html>" in response.text.lower()
        assert "<html" in response.text.lower()
        assert "OverGrid" in response.text
    
    def test_production_build_js_bundle_serves(self):
        """Production JS bundle should serve with 200 status"""
        response = requests.get(f"{BASE_URL}/api/app-stable/static/js/main.e47c64a8.js")
        assert response.status_code == 200
        # JS file should have content
        assert len(response.content) > 10000  # JS bundle should be substantial
    
    def test_production_build_css_serves(self):
        """Production CSS should serve with 200 status"""
        response = requests.get(f"{BASE_URL}/api/app-stable/static/css/main.8ab54c89.css")
        assert response.status_code == 200
        # CSS file should have content
        assert len(response.content) > 1000
    
    def test_production_build_has_correct_asset_paths(self):
        """Production build HTML should reference /api/app-stable/ paths"""
        response = requests.get(f"{BASE_URL}/api/app-stable/fullscreen")
        assert response.status_code == 200
        # Check that asset paths use /api/app-stable/ prefix
        assert "/api/app-stable/static/js/" in response.text
        assert "/api/app-stable/static/css/" in response.text
    
    def test_production_build_no_hmr_websocket_references(self):
        """Production build should NOT have HMR WebSocket references"""
        response = requests.get(f"{BASE_URL}/api/app-stable/fullscreen")
        assert response.status_code == 200
        # These are HMR-related paths that should NOT be in production build
        assert "/sockjs-node" not in response.text
        assert "webpackHotUpdate" not in response.text
        # Note: /ws might appear in other contexts, so we check for HMR-specific patterns
    
    def test_production_build_electron_mode_controls(self):
        """Production build should serve for electron mode=controls"""
        response = requests.get(f"{BASE_URL}/api/app-stable/fullscreen?electron=1&mode=controls")
        assert response.status_code == 200
        assert "<!doctype html>" in response.text.lower()
    
    def test_production_build_electron_mode_layers(self):
        """Production build should serve for electron mode=layers"""
        response = requests.get(f"{BASE_URL}/api/app-stable/fullscreen?electron=1&mode=layers")
        assert response.status_code == 200
        assert "<!doctype html>" in response.text.lower()
    
    def test_production_build_electron_mode_grid(self):
        """Production build should serve for electron mode=grid"""
        response = requests.get(f"{BASE_URL}/api/app-stable/fullscreen?electron=1&overlay=1&mode=grid")
        assert response.status_code == 200
        assert "<!doctype html>" in response.text.lower()


class TestDownloadChunks:
    """Tests for chunked download functionality"""
    
    def test_download_part_aa_returns_200(self):
        """Download chunk part-aa should return 200"""
        response = requests.get(f"{BASE_URL}/api/download/OverGrid-part-aa", stream=True)
        assert response.status_code == 200
        # Check content-length header exists
        assert "content-length" in response.headers
    
    def test_download_part_ab_returns_200(self):
        """Download chunk part-ab should return 200"""
        response = requests.get(f"{BASE_URL}/api/download/OverGrid-part-ab", stream=True)
        assert response.status_code == 200
    
    def test_download_part_ac_returns_200(self):
        """Download chunk part-ac should return 200"""
        response = requests.get(f"{BASE_URL}/api/download/OverGrid-part-ac", stream=True)
        assert response.status_code == 200
    
    def test_download_nonexistent_file_returns_404(self):
        """Nonexistent download file should return 404"""
        response = requests.get(f"{BASE_URL}/api/download/nonexistent-file.zip")
        assert response.status_code == 404


class TestDevServerStillWorks:
    """Tests to ensure dev server routes still work"""
    
    def test_homepage_returns_200(self):
        """Homepage at / should return 200"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
    
    def test_download_page_returns_200(self):
        """Download page at /download should return 200"""
        response = requests.get(f"{BASE_URL}/download")
        assert response.status_code == 200
    
    def test_fullscreen_page_returns_200(self):
        """Fullscreen page at /fullscreen should return 200"""
        response = requests.get(f"{BASE_URL}/fullscreen")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
