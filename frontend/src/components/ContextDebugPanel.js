import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useLocation } from 'react-router-dom';

const ContextDebugPanel = () => {
  const { businessContext, contextSource, session } = useSupabaseAuth();
  const location = useLocation();
  
  // Only show if ?debug=1 in URL
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') {
    return null;
  }

  const maskId = (id) => {
    if (!id) return 'null';
    return id.substring(0, 8) + '...';
  };

  const cacheAge = businessContext?.cached_at 
    ? Math.floor((Date.now() - businessContext.cached_at) / 60000)
    : 'N/A';

  return (
    <div
      className="fixed bottom-4 right-4 p-4 rounded-lg shadow-xl border-2 border-blue-500 bg-white z-50 max-w-sm text-xs font-mono"
      style={{ fontSize: '11px' }}
    >
      <div className="font-bold mb-2 text-blue-700">🔍 Context Debug Panel</div>
      
      <div className="space-y-1 text-gray-700">
        <div>
          <span className="font-semibold">Source:</span> {contextSource || 'loading'}
        </div>
        <div>
          <span className="font-semibold">User ID:</span> {maskId(session?.user?.id)}
        </div>
        <div>
          <span className="font-semibold">Account ID:</span> {maskId(businessContext?.account_id)}
        </div>
        <div>
          <span className="font-semibold">Profile ID:</span> {maskId(businessContext?.business_profile_id)}
        </div>
        <div>
          <span className="font-semibold">Onboarding:</span> {businessContext?.onboarding_status || 'unknown'}
        </div>
        <div>
          <span className="font-semibold">Cache Age:</span> {cacheAge} minutes
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200">
          <span className="font-semibold">localStorage:</span>
          <div className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
            {JSON.stringify(businessContext, null, 2)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContextDebugPanel;
