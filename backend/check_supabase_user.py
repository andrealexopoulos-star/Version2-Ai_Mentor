"""
Diagnostic: Check if Supabase user exists
"""
import os
import asyncio
from supabase_client import supabase_admin
from dotenv import load_dotenv

load_dotenv()

async def check_user():
    user_id = "47c638f0-e6c8-4896-973e-ccf93c089240"
    
    print(f"\n{'='*80}")
    print(f"Checking for user: {user_id}")
    print(f"{'='*80}\n")
    
    try:
        # Check in Supabase users table
        response = supabase_admin.table("users").select("*").eq("id", user_id).execute()
        
        print(f"Supabase Query Response:")
        print(f"  Data: {response.data}")
        print(f"  Count: {response.count if hasattr(response, 'count') else 'N/A'}")
        
        if response.data and len(response.data) > 0:
            print(f"\n✅ USER FOUND in Supabase!")
            print(f"  Email: {response.data[0].get('email')}")
            print(f"  Full Name: {response.data[0].get('full_name')}")
            print(f"  ID: {response.data[0].get('id')}")
        else:
            print(f"\n❌ USER NOT FOUND in Supabase users table")
            print(f"  This is why Outlook integration fails!")
            
        # Check Supabase Auth
        print(f"\n{'='*80}")
        print(f"Checking Supabase Auth users...")
        print(f"{'='*80}\n")
        
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
        if auth_user:
            print(f"✅ USER FOUND in Supabase Auth!")
            print(f"  Email: {auth_user.user.email if auth_user.user else 'N/A'}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_user())
