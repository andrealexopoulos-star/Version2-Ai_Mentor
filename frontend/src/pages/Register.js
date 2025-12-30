import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Mail, CheckCircle, XCircle } from 'lucide-react';

const industries = [
  'Retail & E-commerce',
  'Professional Services',
  'Food & Hospitality',
  'Healthcare',
  'Technology',
  'Manufacturing',
  'Construction',
  'Real Estate',
  'Education',
  'Marketing & Advertising',
  'Other'
];

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
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
      toast.success('Account created! Welcome aboard!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Form Side */}
      <div className="flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 bg-[#F3F3EE] overflow-y-auto">
        <div className="max-w-md w-full mx-auto">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-[#051F1A]/60 hover:text-[#051F1A] mb-8 transition-colors font-medium"
            data-testid="back-to-home-link"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="mb-8">
            <p className="label-mono text-[#FF0099] mb-3">Join The Squad</p>
            <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-[#051F1A] tracking-tight uppercase">
              Sign Up
            </h1>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={handleGoogleLogin}
              className="btn-google w-full"
              data-testid="google-register-btn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <div className="divider-text mb-6">or create account with email</div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="label-mono">Your Name *</Label>
              <Input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-modern w-full bg-transparent"
                placeholder="John Smith"
                data-testid="register-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="label-mono">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-modern w-full bg-transparent"
                placeholder="you@company.com"
                data-testid="register-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="label-mono">Password *</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-modern w-full bg-transparent"
                placeholder="Min. 6 characters"
                data-testid="register-password-input"
              />
              {formData.password && (
                <div className={`flex items-center gap-2 text-sm ${passwordValid ? 'text-green-600' : 'text-red-500'}`}>
                  {passwordValid ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {passwordValid ? 'Password strength OK' : 'At least 6 characters required'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="label-mono">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="input-modern w-full bg-transparent"
                placeholder="Re-enter password"
                data-testid="register-confirm-password-input"
              />
              {formData.confirmPassword && (
                <div className={`flex items-center gap-2 text-sm ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                  {passwordsMatch ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="business" className="label-mono">Business Name</Label>
              <Input
                id="business"
                type="text"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="input-modern w-full bg-transparent"
                placeholder="Your Company LLC"
                data-testid="register-business-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="label-mono">Industry</Label>
              <Select 
                value={formData.industry} 
                onValueChange={(value) => setFormData({ ...formData, industry: value })}
              >
                <SelectTrigger className="w-full bg-white border-[#E5E5E0]" data-testid="register-industry-select">
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              className="w-full btn-primary mt-6"
              disabled={loading || !passwordValid || !passwordsMatch}
              data-testid="register-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-[#051F1A]/60 text-sm">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-[#051F1A] font-bold hover:text-[#FF0099] transition-colors"
              data-testid="login-link"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Image Side */}
      <div 
        className="hidden lg:block relative"
        style={{ 
          backgroundImage: 'url(https://images.pexels.com/photos/20447503/pexels-photo-20447503.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#051F1A]/90 to-[#051F1A]/50" />
        <div className="relative z-10 h-full flex flex-col justify-end p-12">
          <h2 className="text-white text-3xl font-heading font-bold mb-4">
            Join 500+ entrepreneurs
          </h2>
          <p className="text-white/70 max-w-md">
            Get AI-powered insights, professional SOPs, and strategic action plans 
            tailored to your business. No consultants. No waiting. Just results.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
