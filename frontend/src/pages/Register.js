import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

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
    business_name: '',
    industry: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(formData);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      {/* Form Side */}
      <div className="flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 bg-[#f5f5f0]">
        <div className="max-w-md w-full mx-auto">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-[#0f2f24]/60 hover:text-[#0f2f24] mb-12 transition-colors"
            data-testid="back-to-home-link"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="mb-10">
            <p className="overline text-[#0f2f24]/60 mb-3">Get Started</p>
            <h1 className="text-4xl font-serif text-[#0f2f24]">Create Account</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#0f2f24]">Your Name</Label>
              <Input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-underline w-full"
                placeholder="John Smith"
                data-testid="register-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#0f2f24]">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-underline w-full"
                placeholder="your@email.com"
                data-testid="register-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#0f2f24]">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-underline w-full"
                placeholder="Min. 6 characters"
                data-testid="register-password-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business" className="text-[#0f2f24]">Business Name (Optional)</Label>
              <Input
                id="business"
                type="text"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="input-underline w-full"
                placeholder="Your Company LLC"
                data-testid="register-business-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#0f2f24]">Industry (Optional)</Label>
              <Select 
                value={formData.industry} 
                onValueChange={(value) => setFormData({ ...formData, industry: value })}
              >
                <SelectTrigger className="w-full bg-white border-[#e5e5e5]" data-testid="register-industry-select">
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
              className="w-full btn-lime rounded-sm py-6 mt-8"
              disabled={loading}
              data-testid="register-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-[#0f2f24]/60">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-[#0f2f24] font-medium hover:underline"
              data-testid="login-link"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Image Side */}
      <div 
        className="auth-image hidden md:block"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1758409426632-e0a240c52038?crop=entropy&cs=srgb&fm=jpg&q=85)'
        }}
      >
        <div className="relative z-10 h-full flex flex-col justify-end p-12">
          <h2 className="text-white text-3xl font-serif mb-4">
            Join hundreds of SMB owners
          </h2>
          <p className="text-white/70 max-w-md">
            Get AI-powered insights, professional SOPs, and strategic action plans 
            tailored to your business.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
