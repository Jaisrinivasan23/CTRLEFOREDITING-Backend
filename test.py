#!/usr/bin/env python3
"""
Google Drive Credentials Test Script
====================================
This script tests the Google Drive API credentials from your .env file
and performs various operations to ensure everything is working correctly.

Usage:
1. Make sure you have a .env file in the backend directory with Google Drive credentials
2. Install required packages: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client python-dotenv
3. Run from backend directory: python test.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime
import json

try:
    from dotenv import load_dotenv
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    import requests
except ImportError as e:
    print(f"❌ Missing required package: {e}")
    print("\n📦 Please install required packages:")
    print("pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client python-dotenv requests")
    sys.exit(1)

class GoogleDriveCredentialsTester:
    def __init__(self):
        self.client_id = None
        self.client_secret = None
        self.refresh_token = None
        self.root_folder_id = None
        self.service = None
        self.credentials = None
        
    def load_environment(self):
        """Load environment variables from .env file"""
        print("🔍 Loading environment variables...")
        
        # Since we're in the backend directory, check current directory and parent
        env_paths = [
            Path(__file__).parent / '.env',  # backend/.env
            Path(__file__).parent / '.env.example',  # backend/.env.example  
            Path(__file__).parent.parent / '.env',  # root/.env
            Path(__file__).parent.parent / '.env.example'  # root/.env.example
        ]
        
        loaded = False
        loaded_from = None
        for env_path in env_paths:
            if env_path.exists():
                load_dotenv(env_path)
                print(f"✅ Loaded environment from: {env_path}")
                loaded = True
                loaded_from = env_path
                break
        
        if not loaded:
            print("⚠️  No .env or .env.example file found. Using system environment variables.")
        elif '.env.example' in str(loaded_from):
            print("⚠️  Using .env.example file. For production, copy this to .env and update values.")
            print("💡 Run: cp .env.example .env")
        
        # Get Google Drive credentials from environment
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.refresh_token = os.getenv('GOOGLE_REFRESH_TOKEN')
        self.root_folder_id = os.getenv('GOOGLE_DRIVE_FOLDER_ID')
        
        print(f"📋 Client ID: {self.client_id[:20]}..." if self.client_id else "❌ No Client ID")
        print(f"📋 Client Secret: {'*' * 20}" if self.client_secret else "❌ No Client Secret")
        print(f"📋 Refresh Token: {self.refresh_token[:20]}..." if self.refresh_token else "❌ No Refresh Token")
        print(f"📋 Root Folder ID: {self.root_folder_id}" if self.root_folder_id else "❌ No Root Folder ID")
        
        if not all([self.client_id, self.client_secret, self.refresh_token]):
            print("\n❌ Missing required Google Drive credentials!")
            print("Please set the following environment variables:")
            print("- GOOGLE_CLIENT_ID")
            print("- GOOGLE_CLIENT_SECRET") 
            print("- GOOGLE_REFRESH_TOKEN")
            print("- GOOGLE_DRIVE_FOLDER_ID (optional)")
            return False
        
        return True
    
    def test_token_refresh(self):
        """Test if we can refresh the access token"""
        print("\n🔄 Testing token refresh...")
        
        try:
            # Create credentials object
            self.credentials = Credentials(
                token=None,
                refresh_token=self.refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.client_id,
                client_secret=self.client_secret,
                scopes=['https://www.googleapis.com/auth/drive']
            )
            
            # Refresh the token
            request = Request()
            self.credentials.refresh(request)
            
            print(f"✅ Token refreshed successfully!")
            print(f"🔑 Access token: {self.credentials.token[:20]}...")
            print(f"⏰ Token expires: {self.credentials.expiry}")
            
            return True
            
        except Exception as e:
            print(f"❌ Token refresh failed: {e}")
            return False
    
    def test_drive_service(self):
        """Test creating Google Drive service"""
        print("\n🔧 Testing Google Drive service creation...")
        
        try:
            self.service = build('drive', 'v3', credentials=self.credentials)
            print("✅ Google Drive service created successfully!")
            return True
        except Exception as e:
            print(f"❌ Failed to create Google Drive service: {e}")
            return False
    
    def test_basic_operations(self):
        """Test basic Google Drive operations"""
        print("\n📁 Testing basic Google Drive operations...")
        
        try:
            # Test 1: List files in root
            print("🔍 Testing file listing...")
            results = self.service.files().list(
                pageSize=5,
                fields="nextPageToken, files(id, name, mimeType)"
            ).execute()
            
            files = results.get('files', [])
            print(f"✅ Successfully listed {len(files)} files from root")
            
            if files:
                print("📄 Sample files:")
                for file in files[:3]:
                    print(f"   - {file['name']} ({file['mimeType']})")
            
            # Test 2: Get drive info
            print("\n💾 Testing drive info...")
            about = self.service.about().get(fields="user, storageQuota").execute()
            user = about.get('user', {})
            quota = about.get('storageQuota', {})
            
            print(f"✅ Drive owned by: {user.get('displayName', 'Unknown')} ({user.get('emailAddress', 'Unknown')})")
            
            if quota:
                used = int(quota.get('usage', 0))
                limit = int(quota.get('limit', 0))
                if limit > 0:
                    used_gb = used / (1024**3)
                    limit_gb = limit / (1024**3)
                    print(f"💾 Storage: {used_gb:.2f} GB used / {limit_gb:.2f} GB total")
                else:
                    print(f"💾 Storage: {used / (1024**3):.2f} GB used (unlimited)")
            
            return True
            
        except HttpError as e:
            print(f"❌ Google Drive API error: {e}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return False
    
    def test_folder_operations(self):
        """Test folder creation and management"""
        print("\n📂 Testing folder operations...")
        
        try:
            # Test folder creation
            print("🔨 Creating test folder...")
            
            folder_metadata = {
                'name': f'CtrlE_Test_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [self.root_folder_id] if self.root_folder_id else []
            }
            
            folder = self.service.files().create(
                body=folder_metadata,
                fields='id, name, webViewLink'
            ).execute()
            
            print(f"✅ Test folder created: {folder['name']}")
            print(f"🔗 Folder link: {folder['webViewLink']}")
            folder_id = folder['id']
            
            # Test subfolder creation
            print("🔨 Creating subfolder...")
            subfolder_metadata = {
                'name': 'Client_Files',
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [folder_id]
            }
            
            subfolder = self.service.files().create(
                body=subfolder_metadata,
                fields='id, name'
            ).execute()
            
            print(f"✅ Subfolder created: {subfolder['name']}")
            
            # Test folder permissions (make it viewable by anyone with link)
            print("🔑 Setting folder permissions...")
            
            permission = {
                'type': 'anyone',
                'role': 'reader'
            }
            
            self.service.permissions().create(
                fileId=folder_id,
                body=permission
            ).execute()
            
            print("✅ Folder permissions set (viewable by anyone with link)")
            
            # Clean up - delete test folder
            print("🧹 Cleaning up test folder...")
            self.service.files().delete(fileId=folder_id).execute()
            print("✅ Test folder deleted")
            
            return True
            
        except HttpError as e:
            print(f"❌ Google Drive API error during folder operations: {e}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error during folder operations: {e}")
            return False
    
    def test_root_folder(self):
        """Test access to the configured root folder"""
        if not self.root_folder_id:
            print("\n⚠️  No root folder ID configured, skipping root folder test")
            return True
            
        print(f"\n📁 Testing access to root folder: {self.root_folder_id}")
        
        try:
            # Get folder info
            folder = self.service.files().get(
                fileId=self.root_folder_id,
                fields='id, name, mimeType, webViewLink, owners'
            ).execute()
            
            print(f"✅ Root folder found: {folder['name']}")
            print(f"🔗 Folder link: {folder['webViewLink']}")
            
            owners = folder.get('owners', [])
            if owners:
                print(f"👤 Folder owner: {owners[0].get('displayName', 'Unknown')}")
            
            # List contents
            results = self.service.files().list(
                q=f"'{self.root_folder_id}' in parents",
                fields="files(id, name, mimeType)"
            ).execute()
            
            files = results.get('files', [])
            print(f"📄 Folder contains {len(files)} items")
            
            return True
            
        except HttpError as e:
            if e.resp.status == 404:
                print(f"❌ Root folder not found or no access: {self.root_folder_id}")
            else:
                print(f"❌ Error accessing root folder: {e}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error accessing root folder: {e}")
            return False
    
    def run_all_tests(self):
        """Run all credential tests"""
        print("🧪 Google Drive Credentials Test Suite")
        print("=" * 50)
        
        tests = [
            ("Environment Loading", self.load_environment),
            ("Token Refresh", self.test_token_refresh),
            ("Drive Service", self.test_drive_service),
            ("Basic Operations", self.test_basic_operations),
            ("Root Folder Access", self.test_root_folder),
            ("Folder Operations", self.test_folder_operations),
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            try:
                results[test_name] = test_func()
                if not results[test_name] and test_name in ["Environment Loading", "Token Refresh", "Drive Service"]:
                    print(f"\n❌ Critical test '{test_name}' failed. Stopping further tests.")
                    break
            except Exception as e:
                print(f"\n💥 Test '{test_name}' crashed: {e}")
                results[test_name] = False
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} - {test_name}")
        
        print(f"\n🎯 Overall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Your Google Drive credentials are working correctly.")
            print("\n🚀 You can now use the Google Drive integration in your CRM application!")
        else:
            print("⚠️  Some tests failed. Please check your Google Drive configuration.")
            
            if not results.get("Environment Loading", False):
                print("\n💡 Next steps:")
                print("1. Create a .env file in the backend directory")
                print("2. Add your Google Drive API credentials")
                print("3. Re-run this test script")
            elif not results.get("Token Refresh", False):
                print("\n💡 Next steps:")
                print("1. Check if your refresh token is valid")
                print("2. Make sure your OAuth client credentials are correct")
                print("3. You may need to re-authorize and get a new refresh token")

def main():
    """Main function to run the test suite"""
    tester = GoogleDriveCredentialsTester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()
