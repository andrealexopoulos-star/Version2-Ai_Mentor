#!/usr/bin/env python3
"""
MongoDB Cleanup Script
Removes all test/legacy data from MongoDB collections
Prepares for MongoDB retirement
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def cleanup_mongodb():
    """Clean up MongoDB - remove all test data"""
    
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["biqc_db"]
    
    print("=" * 60)
    print("MONGODB CLEANUP - REMOVING ALL TEST DATA")
    print("=" * 60)
    
    # Get all collections
    collections = await db.list_collection_names()
    
    total_deleted = 0
    
    for collection_name in collections:
        count_before = await db[collection_name].count_documents({})
        
        if count_before > 0:
            result = await db[collection_name].delete_many({})
            deleted = result.deleted_count
            total_deleted += deleted
            print(f"✅ {collection_name:30} → Deleted {deleted:6} documents")
        else:
            print(f"⚪ {collection_name:30} → Already empty")
    
    print("\n" + "=" * 60)
    print(f"TOTAL DELETED: {total_deleted} documents")
    print("=" * 60)
    print("\n✅ MongoDB is now clean - ready for retirement")
    print("All future data will flow to Supabase exclusively.")

if __name__ == "__main__":
    print("\n⚠️  WARNING: This will delete ALL data from MongoDB!")
    print("Watchtower and email data are already in Supabase.")
    print("Legacy chat/analysis history will be lost.\n")
    
    confirm = input("Type 'DELETE ALL' to confirm: ")
    
    if confirm == "DELETE ALL":
        asyncio.run(cleanup_mongodb())
    else:
        print("❌ Cleanup cancelled")
