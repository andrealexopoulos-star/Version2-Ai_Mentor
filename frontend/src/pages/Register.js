import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, ArrowRight, Eye, EyeOff, Zap, Check, CheckCircle2, Circle } from 'lucide-react';

const industries = [
  { code: 'A', label: 'A — Agriculture, Forestry and Fishing' },
  { code: 'B', label: 'B — Mining' },
  { code: 'C', label: 'C — Manufacturing' },
  { code: 'D', label: 'D — Electricity, Gas, Water and Waste Services' },
  { code: 'E', label: 'E — Construction' },
  { code: 'F', label: 'F — Wholesale Trade' },
  { code: 'G', label: 'G — Retail Trade' },
  { code: 'H', label: 'H — Accommodation and Food Services' },
  { code: 'I', label: 'I — Transport, Postal and Warehousing' },
  { code: 'J', label: 'J — Information Media and Telecommunications' },
  { code: 'K', label: 'K — Financial and Insurance Services' },
  { code: 'L', label: 'L — Rental, Hiring and Real Estate Services' },
  { code: 'M', label: 'M — Professional, Scientific and Technical Services' },
  { code: 'N', label: 'N — Administrative and Support Services' },
  { code: 'O', label: 'O — Public Administration and Safety' },
  { code: 'P', label: 'P — Education and Training' },
  { code: 'Q', label: 'Q — Health Care and Social Assistance' },
  { code: 'R', label: 'R — Arts and Recreation Services' },
  { code: 'S', label: 'S — Other Services' },
  { code: 'OTHER', label: 'Other / Not sure' },
];

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    business_name: '',
    industry: ''
  });

  const passwordsMatch = formData.password === formData.confirmPassword;
  const passwordValid = formData.password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordValid) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      toast.success('Welcome to Strategy Squad!');
      navigate('/onboarding');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const benefits = [
    'Personalised AI business advice',
    'Generate SOPs and action plans',
    'Competitive market analysis',
    'No credit card required'
  ];

  return (
    <div className="min-h-screen flex">
      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 bg-white overflow-y-auto">
        <div className="max-w-md w-full mx-auto">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-xl text-gray-900">Strategy Squad</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Start your free account
            </h1>
            <p className="text-gray-500">Get personalised AI business advisory today</p>
          </div>

          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3.5 px-4 rounded-xl transition-all mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-sm text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Acme Pty Ltd"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Work Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-900 focus:border-blue-500 focus:outline-none transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
              >
                <option value="">Select your industry</option>
                {industries.map((ind) => (
                  <option key={ind.code} value={ind.code}>{ind.label}</option>
                ))}
              </select>
            </div>


            <div className="p-3 rounded-xl border" style={{ borderColor: 'rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.06)' }}>
              <div className="text-sm font-medium text-gray-900">Tip</div>
              <div className="text-sm text-gray-600 mt-1">
                You can skip most fields here and use Business Profile Quick Setup to auto-fill from your website and documents.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-12 px-4 pr-12 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="Min 6 chars"
                    style={{ color: '#1a1a1a' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Confirm"
                  style={{ color: '#1a1a1a' }}
                />
              </div>
            </div>

            {/* Password validation */}
            {(formData.password || formData.confirmPassword) && (
              <div className="flex flex-wrap gap-4 text-sm">
                <div className={`flex items-center gap-1.5 ${passwordValid ? 'text-green-600' : 'text-gray-400'}`}>
                  {passwordValid ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  6+ characters
                </div>
                {formData.confirmPassword && (
                  <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordsMatch ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    Passwords match
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 mt-2"
              disabled={loading || !passwordValid || !passwordsMatch}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Free Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-gray-500 text-sm">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
            >
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-gray-400">
            By signing up, you agree to our{' '}
            <Link to="/terms" className="text-blue-600 hover:underline">Terms</Link>
            {' '}and{' '}
            <button className="text-blue-600 hover:underline">Privacy Policy</button>
          </p>
        </div>
      </div>

      {/* Right Side - Clean */}
      <div className="hidden lg:flex flex-1 bg-gray-50 items-center justify-center p-12">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            What you get with Strategy Squad
          </h2>
          <ul className="space-y-4">
            {benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-gray-700">{benefit}</span>
              </li>
            ))}
          </ul>
          
          <div className="mt-10 p-6 bg-white rounded-2xl border border-gray-200">
            <div className="flex items-center gap-1 mb-3">
              {[1,2,3,4,5].map(i => (
                <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                </svg>
              ))}
            </div>
            <p className="text-gray-700 mb-4">
              &quot;Finally an AI that understands MY business. The personalised advice helped me increase revenue by 40%.&quot;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">SC</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Sarah Chen</p>
                <p className="text-gray-500 text-sm">Founder, Bloom Digital</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
