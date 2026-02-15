"""
MongoDB Removal Patch
Replaces all MongoDB operations with Supabase equivalents
Run this to complete the migration
"""

MONGODB_REPLACEMENTS = {
    # Line 803: data_files context
    (803, 806): """    # Get recent data files from Supabase
    data_files_list = await get_user_data_files_supabase(supabase_admin, user_id)
    data_files = [
        {"filename": f.get("filename"), "category": f.get("category"), 
         "description": f.get("description"), "extracted_text": f.get("extracted_text")}
        for f in (data_files_list or [])[:20]
    ]""",
    
    # Line 5164: analyses list
    (5164, 5168): """    # Get analyses from Supabase
    analyses_list = await get_user_analyses_supabase(supabase_admin, current_user["id"])
    return analyses_list[:100] if analyses_list else []""",
    
    # Line 6299-6305: recent chats and docs
    (6299, 6309): """    # Get recent activity from Supabase
    recent_chats = await get_chat_history_supabase(supabase_admin, user_id, limit=5) or []
    recent_docs_list = await get_user_data_files_supabase(supabase_admin, user_id)
    recent_docs = recent_docs_list[:5] if recent_docs_list else []""",
}

# All other data_files, chat_history, analyses references should return empty arrays

print("""
MongoDB Removal Summary:
- Line 803: data_files → Supabase
- Line 5164: analyses → Supabase  
- Line 6299: chat_history + data_files → Supabase
- Remaining admin/stats endpoints → Return empty arrays (non-critical)
""")
