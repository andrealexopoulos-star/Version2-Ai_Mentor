"""
Check existing MongoDB data before migration
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

async def check_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    collections = await db.list_collection_names()
    print("📊 MongoDB Collections Found:")
    print("="*80)
    
    for collection_name in collections:
        count = await db[collection_name].count_documents({})
        print(f"\n📁 {collection_name}: {count} documents")
        
        if count > 0:
            # Show sample document
            sample = await db[collection_name].find_one({})
            print(f"   Sample structure: {list(sample.keys())}")
    
    print("\n" + "="*80)
    client.close()

if __name__ == "__main__":
    asyncio.run(check_data())
