import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, UserCheck, AlertTriangle, LogOut } from 'lucide-react';
import StepTracker from './components/StepTracker';
import Step1PersonalInfo from './components/Step1PersonalInfo';
import Step2DocumentUpload from './components/Step2DocumentUpload';
import Step3ReviewSubmit from './components/Step3ReviewSubmit';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { getMe, logout as apiLogout, getMyKYC, updateProfile } from './utils/api';

const LOGO_URL = '/assets/vexaro-logo.jpeg';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [profileData, setProfileData] = useState({});
  const [documentData, setDocumentData] = useState({});
  const [kycRecord, setKycRecord] = useState(null);

  // ─── Check for existing JWT session on load ───────────────
  useEffect(() => {
    async function restoreSession() {
      const user = await getMe();
      if (user) {
        await initUserSession(user);
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  const initUserSession = async (user) => {
    setCurrentUser(user);
    if (user.role === 'user') {
      // Populate profile data from user object
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        gender: user.gender || 'male',
        email: user.email || '',
        mobile: user.mobile || '',
        agencyName: user.agencyName || '',
        city: user.city || '',
        state: user.state || '',
        pincode: user.pincode || '',
        addressLine1: user.addressLine1 || '',
        addressLine2: user.addressLine2 || '',
        billingAddressLine1: user.billingAddressLine1 || '',
        billingAddressLine2: user.billingAddressLine2 || '',
        profilePhoto: user.profilePhoto || null,
        sameAsPermanent: user.sameAsPermanent ?? true,
      });

      // Load KYC record from API
      try {
        const record = await getMyKYC();
        setKycRecord(record);
        if (record) {
          setDocumentData({
            aadhaarFront: record.aadhaarFront,
            aadhaarBack: record.aadhaarBack,
            panCard: record.panCard,
          });
        }
      } catch (err) {
        console.error('Failed to fetch KYC record:', err);
      }

      setStep(1);
    }
  };

  const handleLoginSuccess = async (user) => {
    await initUserSession(user);
  };

  const handleLogout = () => {
    apiLogout();
    setCurrentUser(null);
    setStep(1);
    setProfileData({});
    setDocumentData({});
    setKycRecord(null);
  };

  const handleStep1Submit = async (data) => {
    setProfileData(data);
    // Save profile to backend
    try {
      await updateProfile(data);
    } catch (err) {
      console.error('Profile update failed:', err);
      // Continue to next step anyway — data is in state
    }
    setStep(2);
  };

  const handleStep2Submit = (data) => {
    setDocumentData(data);
    setStep(3);
  };

  const handleStep3Submit = (submittedKyc) => {
    setKycRecord(submittedKyc);
    setCurrentUser(prev => ({ ...prev, kycStatus: 'pending' }));
    setStep(1);
  };

  const handleRestartKYC = () => {
    setCurrentUser(prev => ({ ...prev, kycStatus: 'not_started' }));
    setDocumentData({});
    setKycRecord(null);
    setStep(1);
  };

  // ─── Render user portal content based on KYC status ───────
  const renderClientContent = () => {
    const kycStatus = currentUser.kycStatus;

    if (kycStatus === 'approved') {
      return (
        <div className="w-full max-w-2xl mx-auto bg-brand-navy rounded-2xl p-8 border border-green-800 shadow-2xl text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500">
            <UserCheck className="w-10 h-10 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-100">Verification Approved</h2>
            <p className="text-slate-400 text-xs">
              Congratulations! Your Vexaro Driver Portal KYC is fully validated and active.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-left text-xs space-y-2.5">
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Agency Tag</span>
              <span className="font-bold text-slate-300">{profileData.agencyName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Onboarding Date</span>
              <span className="font-mono text-slate-300">
                {new Date(currentUser.createdAt || Date.now()).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Secure Token Status</span>
              <span className="font-bold text-green-400">ACTIVE DESK V2</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            Vexaro Security Desk protects all identity files.
          </div>
        </div>
      );
    }

    if (kycStatus === 'pending') {
      if (step === 3) {
        return (
          <div className="space-y-4">
            <Step3ReviewSubmit
              profileData={profileData}
              documentData={documentData}
              onBack={() => setStep(1)}
              onSubmit={handleStep3Submit}
              readOnly
            />
          </div>
        );
      }

      return (
        <div className="w-full max-w-2xl mx-auto bg-brand-navy rounded-2xl p-8 border border-slate-800 shadow-2xl text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500">
            <Clock className="w-10 h-10 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-100">KYC Under Verification</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              We have received your profile and document credentials. Vexaro verification desk staff are reviewing your submissions.
            </p>
          </div>

          <div className="p-5 bg-slate-950 border border-slate-850 rounded-2xl text-left space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Timeline Status</h4>
            <div className="relative pl-6 space-y-6 border-l border-slate-800">
              <div className="relative">
                <span className="absolute -left-[30px] top-0.5 w-4.5 h-4.5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white">✓</span>
                <span className="text-xs font-bold text-slate-300 block">Profile Registered</span>
                <span className="text-[10px] text-slate-500 block">Completed during Step 1</span>
              </div>
              <div className="relative">
                <span className="absolute -left-[30px] top-0.5 w-4.5 h-4.5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white">✓</span>
                <span className="text-xs font-bold text-slate-300 block">Documents Dispatched</span>
                <span className="text-[10px] text-slate-500 block">Aadhaar and PAN details safely transmitted</span>
              </div>
              <div className="relative animate-pulse">
                <span className="absolute -left-[30px] top-0.5 w-4.5 h-4.5 bg-brand-orange rounded-full flex items-center justify-center text-[8px] text-white">●</span>
                <span className="text-xs font-bold text-brand-orange block">Awaiting Staff Review</span>
                <span className="text-[10px] text-slate-500 block">Usually validated within 2-4 business hours</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            className="text-xs text-brand-orange hover:text-brand-orangeHover font-semibold underline decoration-dashed transition-all cursor-pointer"
          >
            Review Submitted Credentials
          </button>
        </div>
      );
    }

    if (kycStatus === 'rejected') {
      return (
        <div className="w-full max-w-2xl mx-auto bg-brand-navy rounded-2xl p-8 border border-red-950/60 shadow-2xl text-center space-y-6 animate-fadeIn">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <AlertTriangle className="w-10 h-10 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-100">Verification Rejected</h2>
            <p className="text-slate-400 text-xs">
              Our review desk noticed discrepancies in your submitted verification documents.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-red-900/20 text-left space-y-2">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">Feedback Reason</span>
            <p className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-900">
              {kycRecord?.rejectionReason || 'Uploaded files were blurry. Please scan and re-submit again.'}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleRestartKYC}
              className="bg-brand-orange hover:bg-brand-orangeHover text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-brand-orange/15 transition-all w-full sm:w-auto"
            >
              Re-submit Identity Details
            </button>
          </div>
        </div>
      );
    }

    // Step wizard
    return (
      <div className="space-y-4">
        {step < 4 && <StepTracker currentStep={step} />}

        {step === 1 && (
          <Step1PersonalInfo
            initialData={profileData}
            onNext={handleStep1Submit}
          />
        )}

        {step === 2 && (
          <Step2DocumentUpload
            initialData={documentData}
            onNext={handleStep2Submit}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <Step3ReviewSubmit
            profileData={profileData}
            documentData={documentData}
            onBack={() => {
              if (currentUser.kycStatus === 'pending') {
                handleLogout();
              } else {
                setStep(2);
              }
            }}
            onSubmit={handleStep3Submit}
          />
        )}
      </div>
    );
  };

  // ─── Loading State ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-navyDark flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-brand-orange flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-brand-orange/20 mx-auto animate-pulse">
            <img src={LOGO_URL} alt="Vexaro" className="w-full h-full object-contain rounded-xl bg-white" />
          </div>
          <p className="text-slate-400 text-sm">Loading Vexaro KYC...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-navyDark text-slate-100 flex flex-col justify-between">

      {/* Top Nav Bar */}
      {currentUser && (
        <div className="bg-brand-navy border-b border-slate-800/80 px-6 py-3 flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <div className="w-16 h-9 rounded-md bg-white border border-slate-700 flex items-center justify-center overflow-hidden">
              <img src={LOGO_URL} alt="Vexaro Courier Solution Private Limited" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-slate-200">VEXARO</span>
              <span className="text-[9px] text-slate-400 font-medium block leading-none">Courier Solutions Private Limited</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-400 font-semibold hidden sm:inline">
              Client Portal: <strong className="text-slate-200 font-normal">{currentUser.name}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-all font-bold text-[10px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        {!currentUser ? (
          <Login onLoginSuccess={handleLoginSuccess} />
        ) : currentUser.role === 'admin' || currentUser.role === 'owner' ? (
          <AdminDashboard currentUser={currentUser} onLogout={handleLogout} />
        ) : (
          <div className="w-full">
            {renderClientContent()}
          </div>
        )}
      </main>

      {/* Footer */}
      {!currentUser && (
        <footer className="text-center py-4 text-[10px] text-slate-650 tracking-wider">
          SECURED BY VEXARO CRYPTOGRAPHIC ID DESK. DESIGNED FOR HIGH-FIDELITY COMPLIANCE.
        </footer>
      )}
    </div>
  );
}
