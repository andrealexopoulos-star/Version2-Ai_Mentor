import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(formData.email, formData.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
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
            <p className="overline text-[#0f2f24]/60 mb-3">Welcome Back</p>
            <h1 className="text-4xl font-serif text-[#0f2f24]">Sign In</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                data-testid="login-email-input"
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
                placeholder="••••••••"
                data-testid="login-password-input"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full btn-forest rounded-sm py-6 mt-8"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-[#0f2f24]/60">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="text-[#0f2f24] font-medium hover:underline"
              data-testid="register-link"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Image Side */}
      <div 
        className="auth-image hidden md:block"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1758518731814-77fa04b3c67d?crop=entropy&cs=srgb&fm=jpg&q=85)'
        }}
      >
        <div className="relative z-10 h-full flex flex-col justify-end p-12">
          <blockquote className="text-white/90 text-2xl font-serif italic max-w-md">
            "Strategic Advisor transformed how I approach my business decisions. 
            The insights are invaluable."
          </blockquote>
          <p className="text-white/60 mt-4">— Sarah Chen, Founder & CEO</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
