import { Navigate, useSearchParams } from 'react-router-dom';

const CompleteSignup = () => {
  const [searchParams] = useSearchParams();
  const plan = String(searchParams.get('plan') || '').trim();
  const redirectParams = new URLSearchParams(searchParams);

  if (plan) {
    redirectParams.set('plan', plan);
  }
  redirectParams.set('from', '/complete-signup');

  return <Navigate to={`/subscribe?${redirectParams.toString()}`} replace />;
};

export default CompleteSignup;
