import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import axios from 'axios';
import { Users, BarChart3, FileText, MessageSquare, Trash2, Shield, User, Loader2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/users`)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await axios.put(`${API}/admin/users/${userId}`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const toggleUserStatus = async (userId, isActive) => {
    try {
      await axios.put(`${API}/admin/users/${userId}`, { is_active: !isActive });
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !isActive } : u));
      toast.success(`User ${isActive ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const deleteUser = async () => {
    if (!deleteUserId) return;
    try {
      await axios.delete(`${API}/admin/users/${deleteUserId}`);
      setUsers(users.filter(u => u.id !== deleteUserId));
      toast.success('User deleted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeleteUserId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#0f2f24]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="admin-dashboard-page">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-[#ccff00]" />
              <p className="overline text-[#0f2f24]/60">Admin Panel</p>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif text-[#0f2f24]">System Overview</h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="stat-card hover-lift" data-testid="admin-stat-users">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="stat-label">Total Users</p>
                    <p className="stat-value">{stats?.total_users || 0}</p>
                  </div>
                  <Users className="w-8 h-8 text-[#ccff00]" />
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card hover-lift" data-testid="admin-stat-analyses">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="stat-label">Analyses</p>
                    <p className="stat-value">{stats?.total_analyses || 0}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-[#ccff00]" />
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card hover-lift" data-testid="admin-stat-documents">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="stat-label">Documents</p>
                    <p className="stat-value">{stats?.total_documents || 0}</p>
                  </div>
                  <FileText className="w-8 h-8 text-[#ccff00]" />
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card hover-lift" data-testid="admin-stat-chats">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="stat-label">Chat Messages</p>
                    <p className="stat-value">{stats?.total_chats || 0}</p>
                  </div>
                  <MessageSquare className="w-8 h-8 text-[#ccff00]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="users">
            <TabsList className="bg-[#f5f5f0] p-1 mb-6">
              <TabsTrigger value="users" className="data-[state=active]:bg-white" data-testid="admin-tab-users">
                <Users className="w-4 h-4 mr-2" /> Users
              </TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-white" data-testid="admin-tab-activity">
                <BarChart3 className="w-4 h-4 mr-2" /> Recent Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card className="card-clean">
                <CardHeader>
                  <CardTitle className="font-serif">User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#ccff00] rounded-full flex items-center justify-center text-[#0f2f24] font-medium">
                                {u.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-[#0f2f24]">{u.name}</p>
                                <p className="text-xs text-[#0f2f24]/60">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">{u.business_name || '-'}</p>
                              <p className="text-xs text-[#0f2f24]/60">{u.industry || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={u.role === 'admin' ? 'default' : 'secondary'}
                              className={u.role === 'admin' ? 'bg-[#ccff00] text-[#0f2f24]' : ''}
                            >
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.is_active !== false ? 'outline' : 'destructive'}>
                              {u.is_active !== false ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-[#0f2f24]/60">
                            {new Date(u.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {u.id !== user?.id && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleUserRole(u.id, u.role)}
                                    data-testid={`toggle-role-${u.id}`}
                                  >
                                    {u.role === 'admin' ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleUserStatus(u.id, u.is_active !== false)}
                                    data-testid={`toggle-status-${u.id}`}
                                  >
                                    {u.is_active !== false ? 'Deactivate' : 'Activate'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteUserId(u.id)}
                                    className="text-red-600 hover:text-red-700"
                                    data-testid={`delete-user-${u.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="card-clean">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">Recent Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats?.recent_users?.length > 0 ? (
                      <div className="space-y-4">
                        {stats.recent_users.map((u) => (
                          <div key={u.id} className="flex items-center justify-between p-3 bg-[#f5f5f0] rounded-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#0f2f24] rounded-full flex items-center justify-center text-white text-sm">
                                {u.name?.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{u.name}</p>
                                <p className="text-xs text-[#0f2f24]/60">{u.email}</p>
                              </div>
                            </div>
                            <p className="text-xs text-[#0f2f24]/40">
                              {new Date(u.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#0f2f24]/60 text-center py-4">No recent users</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="card-clean">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">Recent Analyses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats?.recent_analyses?.length > 0 ? (
                      <div className="space-y-4">
                        {stats.recent_analyses.map((a) => (
                          <div key={a.id} className="flex items-center justify-between p-3 bg-[#f5f5f0] rounded-sm">
                            <div>
                              <p className="text-sm font-medium">{a.title}</p>
                              <p className="text-xs text-[#0f2f24]/60">{a.analysis_type}</p>
                            </div>
                            <p className="text-xs text-[#0f2f24]/40">
                              {new Date(a.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#0f2f24]/60 text-center py-4">No recent analyses</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? All their data (analyses, documents, chat history) will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} className="bg-red-600 hover:bg-red-700">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminDashboard;
