"""
List all users in MongoDB database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

async def list_users():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    print("="*100)
    print(f"📊 TOTAL USERS IN DATABASE: {len(users)}")
    print("="*100)
    print()
    
    for idx, user in enumerate(users, 1):
        email = user.get('email', 'N/A')
        name = user.get('name', 'N/A')
        business_name = user.get('business_name', 'N/A')
        created_at = user.get('created_at', 'N/A')
        is_active = user.get('is_active', 'N/A')
        
        print(f"{idx}. Email: {email}")
        print(f"   Name: {name}")
        print(f"   Business: {business_name}")
        print(f"   Created: {created_at}")
        print(f"   Active: {is_active}")
        print()
    
    print("="*100)
    
    # Also check for microsoft_tokens to see OAuth connections
    tokens_count = await db.microsoft_tokens.count_documents({})
    print(f"\n🔗 Microsoft OAuth Connections: {tokens_count}")
    
    if tokens_count > 0:
        tokens = await db.microsoft_tokens.find({}, {"_id": 0, "user_id": 1}).to_list(1000)
        print(f"   Connected user_ids: {[t.get('user_id') for t in tokens]}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(list_users())
