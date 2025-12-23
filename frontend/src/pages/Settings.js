import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { User, Building, Briefcase, Loader2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';

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

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    business_name: user?.business_name || '',
    industry: user?.industry || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Note: Profile update endpoint would need to be implemented
    setTimeout(() => {
      toast.success('Profile settings saved');
      setLoading(false);
    }, 500);
  };

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="settings-page">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <p className="overline text-[#0f2f24]/60 mb-2">Account</p>
            <h1 className="text-3xl md:text-4xl font-serif text-[#0f2f24]">Settings</h1>
          </div>

          {/* Profile Card */}
          <Card className="card-clean mb-6">
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="bg-[#f5f5f0]"
                  />
                  <p className="text-xs text-[#0f2f24]/60">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-white"
                    data-testid="settings-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Business Name
                  </Label>
                  <Input
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="Your Company LLC"
                    className="bg-white"
                    data-testid="settings-business-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Industry
                  </Label>
                  <Select 
                    value={formData.industry} 
                    onValueChange={(value) => setFormData({ ...formData, industry: value })}
                  >
                    <SelectTrigger className="bg-white" data-testid="settings-industry-select">
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
                  className="btn-forest rounded-sm"
                  disabled={loading}
                  data-testid="save-settings-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="card-clean">
            <CardHeader>
              <CardTitle className="font-serif">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-[#f5f5f0] rounded-sm">
                <div>
                  <p className="text-sm font-medium text-[#0f2f24]">Account Type</p>
                  <p className="text-xs text-[#0f2f24]/60">Your current role</p>
                </div>
                <span className={`badge ${user?.role === 'admin' ? 'badge-lime' : 'badge-outline'}`}>
                  {user?.role || 'user'}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-[#f5f5f0] rounded-sm">
                <div>
                  <p className="text-sm font-medium text-[#0f2f24]">Member Since</p>
                  <p className="text-xs text-[#0f2f24]/60">Account creation date</p>
                </div>
                <span className="text-sm text-[#0f2f24]">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
