"""
Create a confirmed test user in Supabase for testing
Uses service role key to bypass email confirmation
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('/app/backend/.env')

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def create_confirmed_test_user():
    """Create a test user with email already confirmed"""
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        # Create user with service role (bypasses email confirmation)
        test_email = "testing@biqc.demo"
        test_password = "TestPass123!"
        
        print(f"Creating test user: {test_email}")
        
        # Use admin API to create user with email_confirm set to true
        auth_response = supabase.auth.admin.create_user({
            "email": test_email,
            "password": test_password,
            "email_confirm": True,  # Auto-confirm email
            "user_metadata": {
                "full_name": "BIQC Test User",
                "company_name": "BIQC Test Company",
                "industry": "Technology"
            }
        })
        
        if auth_response.user:
            print(f"✅ User created successfully!")
            print(f"   User ID: {auth_response.user.id}")
            print(f"   Email: {auth_response.user.email}")
            print(f"   Email Confirmed: {auth_response.user.email_confirmed_at is not None}")
            
            # Create user profile in PostgreSQL
            user_data = {
                "id": auth_response.user.id,
                "email": test_email,
                "full_name": "BIQC Test User",
                "company_name": "BIQC Test Company",
                "industry": "Technology",
                "role": "user",
                "subscription_tier": "free",
                "is_master_account": False
            }
            
            # Check if user already exists
            existing = supabase.table("users").select("*").eq("email", test_email).execute()
            if existing.data:
                print(f"   User profile already exists in database")
            else:
                profile_response = supabase.table("users").insert(user_data).execute()
                print(f"   User profile created in database")
                
                # Create cognitive profile
                cognitive_data = {
                    "user_id": auth_response.user.id,
                    "immutable_reality": {},
                    "behavioural_truth": {},
                    "delivery_preference": {},
                    "consequence_memory": {}
                }
                supabase.table("cognitive_profiles").insert(cognitive_data).execute()
                print(f"   Cognitive profile created")
            
            print(f"\n✅ Test user ready!")
            print(f"   Email: {test_email}")
            print(f"   Password: {test_password}")
            return True
        else:
            print(f"❌ Failed to create user")
            return False
            
    except Exception as e:
        error_str = str(e)
        if "already been registered" in error_str or "duplicate" in error_str:
            print(f"✅ User already exists: {test_email}")
            print(f"   Email: {test_email}")
            print(f"   Password: {test_password}")
            return True
        else:
            print(f"❌ Error: {e}")
            return False

if __name__ == "__main__":
    success = create_confirmed_test_user()
    sys.exit(0 if success else 1)
