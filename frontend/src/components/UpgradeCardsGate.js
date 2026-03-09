// All gates removed — full platform access for all users
export default function UpgradeCardsGate({ children, requiredTier = 'starter', featureName = 'This feature' }) {
  return children;
}
