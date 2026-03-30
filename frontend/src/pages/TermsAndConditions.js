import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Scale, AlertTriangle, FileText } from 'lucide-react';

const TermsAndConditions = () => {
  const navigate = useNavigate();
  const lastUpdated = "1 January 2025";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-xs">TS</span>
            </div>
            <span className="font-semibold text-slate-900">Business Intelligence Quotient Centre</span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Title Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Scale className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Terms and Conditions</h1>
                <p className="text-slate-500">Last updated: {lastUpdated}</p>
              </div>
            </div>
          </div>

          {/* Important Notice Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-10">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-2">Important Notice - General Information Only</h3>
                <p className="text-amber-800 text-sm leading-relaxed">
                  Business Intelligence Quotient Centre provides <strong>general information and educational content only</strong>.
                  Our AI-powered platform does not provide personal financial advice, legal advice, tax advice, 
                  or any other form of professional advice. You should seek independent professional advice 
                  before making any business decisions.
                </p>
              </div>
            </div>
          </div>

          {/* Terms Content */}
          <div className="prose prose-slate max-w-none">
            
            {/* Section 1 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">1</span>
                Agreement to Terms
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  By accessing or using Business Intelligence Quotient Centre platform (&quot;Service&quot;), operated by Business Intelligence Quotient Centre Pty Ltd
                  (ABN to be registered) (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms and
                  Conditions (&quot;Terms&quot;). If you do not agree to these Terms, you must not access or use the Service.
                </p>
                <p>
                  These Terms constitute a legally binding agreement between you and Business Intelligence Quotient Centre. By using our
                  Service, you represent that you are at least 18 years of age and have the legal capacity to enter 
                  into this agreement.
                </p>
                <p>
                  We reserve the right to modify these Terms at any time. Continued use of the Service after any 
                  modifications constitutes acceptance of the updated Terms.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">2</span>
                Nature of Service - General Information Only
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-semibold mb-2">IMPORTANT DISCLAIMER</p>
                  <p className="text-red-700 text-sm">
                    THE STRATEGY SQUAD PROVIDES GENERAL INFORMATION AND EDUCATIONAL CONTENT ONLY. 
                    THE SERVICE DOES NOT CONSTITUTE AND SHOULD NOT BE CONSTRUED AS:
                  </p>
                  <ul className="text-red-700 text-sm mt-2 list-disc pl-5 space-y-1">
                    <li>Financial advice or financial product advice as defined under the Corporations Act 2001 (Cth)</li>
                    <li>Legal advice</li>
                    <li>Taxation advice</li>
                    <li>Accounting advice</li>
                    <li>Professional business advice</li>
                    <li>Any other form of professional advice</li>
                  </ul>
                </div>
                <p>
                  Our AI-powered Personalised Business Advisory platform uses artificial intelligence to provide 
                  general business information, insights, and educational content based on the information you 
                  provide. This information is:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>General in nature and does not take into account your specific circumstances, objectives, financial situation, or needs</li>
                  <li>Generated by artificial intelligence and may contain errors, inaccuracies, or outdated information</li>
                  <li>Not a substitute for professional advice from qualified advisors</li>
                  <li>Provided for educational and informational purposes only</li>
                </ul>
                <p className="font-semibold text-slate-800">
                  You must seek independent professional advice from appropriately qualified professionals 
                  (including financial advisors, lawyers, accountants, and business consultants) before making 
                  any business, financial, legal, or other decisions.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">3</span>
                Limitation of Liability
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  To the maximum extent permitted by law, including the Australian Consumer Law (Schedule 2 of the 
                  Competition and Consumer Act 2010 (Cth)):
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <p>
                    <strong>3.1</strong> Business Intelligence Quotient Centre, its directors, officers, employees, agents, contractors,
                    and affiliates (&quot;Released Parties&quot;) shall not be liable for any:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Direct, indirect, incidental, special, consequential, or punitive damages</li>
                    <li>Loss of profits, revenue, data, or business opportunities</li>
                    <li>Business interruption or loss of goodwill</li>
                    <li>Any other losses or damages of any kind</li>
                  </ul>
                  <p>
                    arising out of or in connection with your use of, or inability to use, the Service, even if we 
                    have been advised of the possibility of such damages.
                  </p>
                  <p>
                    <strong>3.2</strong> Our total liability to you for all claims arising out of or relating to 
                    these Terms or the Service shall not exceed the amount you paid to us in the twelve (12) months 
                    preceding the claim, or AUD $100, whichever is greater.
                  </p>
                  <p>
                    <strong>3.3</strong> You acknowledge that the limitations of liability in this section are 
                    fundamental elements of the agreement between you and Business Intelligence Quotient Centre, and the Service
                    would not be provided without such limitations.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">4</span>
                Indemnification
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  You agree to indemnify, defend, and hold harmless Business Intelligence Quotient Centre, its directors, officers,
                  employees, agents, contractors, licensors, service providers, subcontractors, suppliers, interns, 
                  and affiliates from and against any and all:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Claims, demands, actions, suits, or proceedings made by any third party</li>
                  <li>Losses, damages, costs, liabilities, and expenses (including reasonable legal fees)</li>
                  <li>Fines, penalties, and settlements</li>
                </ul>
                <p>arising out of or relating to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Your use of the Service or any content generated through the Service</li>
                  <li>Your breach of these Terms</li>
                  <li>Your violation of any rights of another person or entity</li>
                  <li>Any business decisions you make based on information obtained through the Service</li>
                  <li>Your reliance on any content, information, or advice provided through the Service</li>
                  <li>Any negligent or wrongful conduct by you</li>
                </ul>
                <p className="font-semibold text-slate-800">
                  This indemnification obligation shall survive the termination of these Terms and your use of the Service.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">5</span>
                No Professional Relationship
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  Your use of the Service does not create any professional relationship, including but not limited to:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>A client-advisor relationship</li>
                  <li>A fiduciary relationship</li>
                  <li>A professional consultation relationship</li>
                  <li>An employer-employee relationship</li>
                  <li>A partnership or joint venture</li>
                </ul>
                <p>
                  Business Intelligence Quotient Centre does not hold an Australian Financial Services Licence (AFSL) and is not
                  authorised to provide financial product advice. Any financial information provided is general 
                  in nature and does not constitute financial product advice.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">6</span>
                AI-Generated Content Disclaimer
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  Our Personalised AI Business Advisory platform uses artificial intelligence technology to 
                  generate content. You acknowledge and agree that:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>AI-generated content may contain errors, inaccuracies, or outdated information</li>
                  <li>AI responses are based on patterns in training data and may not reflect current market conditions, laws, or best practices</li>
                  <li>The AI does not have access to real-time data unless explicitly connected through integrations</li>
                  <li>AI-generated content should be independently verified before being relied upon</li>
                  <li>Business Intelligence Quotient Centre does not guarantee the accuracy, completeness, or reliability of AI-generated content</li>
                </ul>
              </div>
            </section>

            {/* Section 7 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">7</span>
                Australian Consumer Law
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  Nothing in these Terms excludes, restricts, or modifies any consumer guarantee, right, or remedy 
                  conferred on you by the Australian Consumer Law (ACL) or any other applicable law that cannot be 
                  excluded, restricted, or modified by agreement.
                </p>
                <p>
                  To the extent that the ACL permits us to limit our liability, our liability for breach of a 
                  consumer guarantee is limited, at our option, to:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>In the case of services: the supply of the services again, or the payment of the cost of having the services supplied again</li>
                </ul>
              </div>
            </section>

            {/* Section 8 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">8</span>
                Disclaimer of Warranties
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  To the maximum extent permitted by applicable law, the Service is provided &quot;as is&quot; and &quot;as available&quot;
                  without warranties of any kind, whether express, implied, statutory, or otherwise, including but not 
                  limited to implied warranties of merchantability, fitness for a particular purpose, title, and 
                  non-infringement.
                </p>
                <p>We do not warrant that:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>The Service will meet your specific requirements or expectations</li>
                  <li>The Service will be uninterrupted, timely, secure, or error-free</li>
                  <li>The results obtained from the Service will be accurate, reliable, or complete</li>
                  <li>Any errors in the Service will be corrected</li>
                </ul>
              </div>
            </section>

            {/* Section 9 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">9</span>
                Your Responsibilities
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>By using the Service, you agree to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Seek independent professional advice before making any business, financial, legal, or other decisions</li>
                  <li>Independently verify any information provided through the Service</li>
                  <li>Not rely solely on information from the Service when making important decisions</li>
                  <li>Provide accurate information when using the Service</li>
                  <li>Use the Service only for lawful purposes</li>
                  <li>Accept full responsibility for any decisions you make based on information from the Service</li>
                </ul>
              </div>
            </section>

            {/* Section 10 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">10</span>
                Governing Law and Jurisdiction
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of New South Wales, 
                  Australia, without regard to its conflict of law provisions.
                </p>
                <p>
                  You agree to submit to the exclusive jurisdiction of the courts of New South Wales, Australia, 
                  for the resolution of any disputes arising out of or relating to these Terms or the Service.
                </p>
              </div>
            </section>

            {/* Section 11 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">11</span>
                Privacy
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  Your privacy is important to us. Our collection and use of personal information is governed by 
                  our Privacy Policy and the Privacy Act 1988 (Cth) and the Australian Privacy Principles.
                </p>
                <p>
                  By using the Service, you consent to the collection, use, and disclosure of your information as 
                  described in our Privacy Policy.
                </p>
              </div>
            </section>

            {/* Section 12 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">12</span>
                Severability
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining 
                  provisions shall continue in full force and effect. The invalid, illegal, or unenforceable 
                  provision shall be modified to the minimum extent necessary to make it valid, legal, and enforceable.
                </p>
              </div>
            </section>

            {/* Section 13 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">13</span>
                Entire Agreement
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  These Terms, together with the Privacy Policy, constitute the entire agreement between you and 
                  Business Intelligence Quotient Centre regarding the Service and supersede all prior and contemporaneous agreements,
                  proposals, or representations, written or oral.
                </p>
              </div>
            </section>

            {/* Section 14 */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">14</span>
                Contact Information
              </h2>
              <div className="pl-10 space-y-4 text-slate-600">
                <p>
                  For any questions about these Terms and Conditions, please contact us at:
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p><strong>Business Intelligence Quotient Centre Pty Ltd</strong></p>
                  <p>Email: legal@biqc.ai</p>
                  <p>Australia</p>
                </div>
              </div>
            </section>

          </div>

          {/* Acknowledgement */}
          <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-4">
              <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Acknowledgement</h3>
                <p className="text-blue-800 text-sm leading-relaxed">
                  By using Business Intelligence Quotient Centre platform, you acknowledge that you have read, understood, and agree
                  to be bound by these Terms and Conditions. You confirm that you understand the Service provides 
                  general information only and is not a substitute for professional advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-400 text-sm">
            © 2025 Business Intelligence Quotient Centre Pty Ltd. All rights reserved.
          </p>
          <p className="text-slate-500 text-xs mt-2">
            ABN: To be registered | Governed by the laws of New South Wales, Australia
          </p>
        </div>
      </footer>
    </div>
  );
};

export default TermsAndConditions;
