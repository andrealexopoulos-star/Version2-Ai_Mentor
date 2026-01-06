import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Target, Stethoscope, BarChart3, TrendingUp } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Diagnosis from './Diagnosis';
import Analysis from './Analysis';
import MarketAnalysis from './MarketAnalysis';

const IntelCentre = () => {
  const [activeTab, setActiveTab] = useState('diagnosis');

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-serif mb-2" style={{ color: 'var(--text-primary)' }}>
              Intel Centre
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Business intelligence, diagnostics, and market insights
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 w-full mb-8">
              <TabsTrigger value="diagnosis" className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />
                <span>Diagnosis</span>
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span>Analysis</span>
              </TabsTrigger>
              <TabsTrigger value="market" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Market Intel</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="diagnosis">
              <Diagnosis embedded={true} />
            </TabsContent>

            <TabsContent value="analysis">
              <Analysis embedded={true} />
            </TabsContent>

            <TabsContent value="market">
              <MarketAnalysis embedded={true} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default IntelCentre;
