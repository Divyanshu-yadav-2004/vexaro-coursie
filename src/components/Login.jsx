import React, { useState } from 'react';
import { Shield, User, Key, Info, HelpCircle } from 'lucide-react';
import { getUsers, login } from '../utils/storage';

export default function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminRole, setAdminRole] = useState('admin'); // 'admin' | 'owner'
  const [error, setError] = useState('');

  const users = getUsers();

  const handleUserSelect = (selectedEmail) => {
    const user = login(selectedEmail);
    if (user) {
      onLoginSuccess(user);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setError('');
    
    const targetEmail = adminRole === 'admin' ? 'admin@kycportal.com' : 'owner@kycportal.com';
    const targetPassword = adminRole === 'admin' ? 'admin@kyc123' : 'owner@kyc123';
    
    if (password === targetPassword) {
      const user = login(targetEmail);
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Configuration error: admin account not found in database.');
      }
    } else {
      setError('Invalid password. Hint: admin@kyc123 or owner@kyc123');
    }
  };

  const handleCustomUserSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter an email address.');
      return;
    }
    const user = login(email);
    if (user) {
      onLoginSuccess(user);
    } else {
      setError('Email not found. Please click a seeded account below to simulate.');
    }
  };

  return (
    <div className="flex flex-col md:flex-row max-w-4xl w-full bg-brand-navy rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-fadeIn m-4">
      {/* Left Branding Panel */}
      <div className="md:w-1/2 bg-gradient-to-br from-brand-navy to-brand-navyDark p-5 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
        <div>
          {/* VEXARO Brand Logo */}
          <div className="flex items-center space-x-3 mb-6 md:mb-8">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-orange flex items-center justify-center font-black text-xl md:text-2xl text-white shadow-lg shadow-brand-orange/20">
              V
            </div>
            <div>
              <div className="text-xl md:text-2xl font-black tracking-wider flex items-center">
                <span>VEX</span>
                <span className="text-brand-orange">ARO</span>
              </div>
              <span className="text-[7.5px] md:text-[8px] text-slate-400 tracking-widest block uppercase font-bold">Courier Solutions Pvt. Ltd.</span>
            </div>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-slate-100 mb-2">Secure Identity Gateway</h2>
          <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-6">
            Log in to manage your driver profile, upload mandatory documents, and complete your KYC verification.
          </p>

          <div className="hidden sm:block space-y-4">
            <div className="flex items-start space-x-3">
              <span className="text-lg mt-0.5">🛡️</span>
              <div>
                <h4 className="font-semibold text-sm text-slate-200">Bank-grade Encryption</h4>
                <p className="text-xs text-slate-400">All identity documents are securely redacted and protected.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-lg mt-0.5">⚡</span>
              <div>
                <h4 className="font-semibold text-sm text-slate-200">Real-time Verification Desk</h4>
                <p className="text-xs text-slate-400">Owner and Admin dashboards permit secure review and approval.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-4 md:pt-6 border-t border-slate-800/80 text-[10px] text-slate-500 hidden sm:block">
          © {new Date().getFullYear()} Vexaro Logistics. All rights reserved. Version 2.0 (React/Tailwind)
        </div>
      </div>

      {/* Right Login Action Panel */}
      <div className="md:w-1/2 p-5 sm:p-8 bg-brand-navy flex flex-col justify-center">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-slate-200">Portal Login</h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">Role-Simulation Mode</span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 mb-6">
          <button
            onClick={() => { setActiveTab('user'); setError(''); }}
            className={`flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'user' 
                ? 'border-brand-orange text-brand-orange' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            Client Onboarding
          </button>
          <button
            onClick={() => { setActiveTab('admin'); setError(''); }}
            className={`flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'admin' 
                ? 'border-brand-orange text-brand-orange' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Staff / Control Panel
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/40 border border-red-800 text-red-200 text-xs p-3 rounded-lg flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Content - User Portal */}
        {activeTab === 'user' && (
          <div className="space-y-4">
            <form onSubmit={handleCustomUserSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Enter Client Email</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-orange"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-brand-orange hover:bg-brand-orangeHover text-white font-semibold text-sm py-2 rounded-xl transition-all shadow-lg shadow-brand-orange/15"
              >
                Access Wizard
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-600 text-[10px] font-bold uppercase">Or Choose Seeded Client Profile</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Seeded User Profiles grid */}
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {users.filter(u => u.role === 'user').map(u => (
                <button
                  key={u.id}
                  onClick={() => handleUserSelect(u.email)}
                  className="flex items-center justify-between p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all text-left"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{u.name}</div>
                    <div className="text-[10px] text-slate-500">{u.email}</div>
                  </div>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    u.kycStatus === 'approved' ? 'bg-green-950/50 text-green-400 border border-green-800' :
                    u.kycStatus === 'pending' ? 'bg-amber-950/50 text-amber-400 border border-amber-800' :
                    u.kycStatus === 'rejected' ? 'bg-red-950/50 text-red-400 border border-red-800' :
                    'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {u.kycStatus.replace('_', ' ').toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content - Admin / Control Panel */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Select Role</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setAdminRole('admin'); setError(''); }}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                    adminRole === 'admin'
                      ? 'bg-slate-800 border-brand-orange text-brand-orange'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Administrator
                </button>
                <button
                  type="button"
                  onClick={() => { setAdminRole('owner'); setError(''); }}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                    adminRole === 'owner'
                      ? 'bg-slate-800 border-brand-orange text-brand-orange'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  System Owner
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Staff Username</label>
              <input
                type="text"
                value={adminRole === 'admin' ? 'admin@kycportal.com' : 'owner@kycportal.com'}
                disabled
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Enter Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-orange"
              />
            </div>

            <div className="bg-slate-900/60 border border-slate-850 p-2.5 rounded-xl flex items-start gap-2.5 text-[10px] text-slate-400 leading-relaxed">
              <Key className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300">Mock Password: </span>
                <code className="text-brand-orange font-mono select-all bg-slate-950 px-1 rounded">
                  {adminRole === 'admin' ? 'admin@kyc123' : 'owner@kyc123'}
                </code>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-orange hover:bg-brand-orangeHover text-white font-semibold text-sm py-2 rounded-xl transition-all shadow-lg shadow-brand-orange/15"
            >
              Sign In to Dashboard
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
