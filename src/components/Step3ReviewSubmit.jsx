import React from 'react';
import { ShieldCheck, FileCheck, ArrowLeft, Send, CheckCircle2, User, Building, MapPin } from 'lucide-react';
import { redactEmail, redactMobile, redactPincode } from '../utils/storage';

export default function Step3ReviewSubmit({ profileData, documentData, onBack, onSubmit }) {
  // Mask sensitive information for secure review display
  const maskedEmail = redactEmail(profileData.email);
  const maskedMobile = redactMobile(profileData.mobile);
  const maskedPincode = redactPincode(profileData.pincode);

  return (
    <div className="w-full max-w-4xl mx-auto bg-brand-navy rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-fadeIn m-4">
      {/* Header Band */}
      <div className="bg-brand-grayLight px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700 flex justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>Review & Submit Application</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">Review your redacted details and confirm document attachments before final dispatch.</p>
        </div>
        <div className="bg-green-950/20 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full border border-green-800/20 flex items-center gap-1 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
          <span className="hidden sm:inline">Secured Data View</span>
        </div>
      </div>

      <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">
        
        {/* Security Warning Box */}
        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex items-start gap-3">
          <div className="text-2xl mt-0.5">🔒</div>
          <div className="text-xs text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-200 block mb-0.5">Privacy Guard Active</span>
            To protect your personally identifiable information (PII), we automatically mask sensitive fields and redact file names on the client screen. Admins and Owners can securely inspect the unmasked details in their verification portal.
          </div>
        </div>

        {/* Profile Summary Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Card 1: Basic Info */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <User className="w-4 h-4 text-brand-orange" />
              Client Identity
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Full Name</span>
                <span className="font-semibold text-slate-200">{profileData.firstName} {profileData.lastName}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Gender</span>
                <span className="font-semibold text-slate-200 capitalize">{profileData.gender}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">System Username</span>
                <span className="font-mono text-slate-400">@{profileData.username || 'username123'}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Contact Details */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-brand-orange" />
              Agency & Contacts
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Agency Name</span>
                <span className="font-semibold text-slate-200">{profileData.agencyName}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  Email Address <span className="text-[9px] text-green-500 font-bold">🔒 Masked</span>
                </span>
                <span className="font-semibold text-slate-200">{maskedEmail}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  Mobile Number <span className="text-[9px] text-green-500 font-bold">🔒 Masked</span>
                </span>
                <span className="font-semibold text-slate-200">{maskedMobile}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Regional Details */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-orange" />
              Region & Pincode
            </h3>
            
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">City</span>
                <span className="font-semibold text-slate-200">{profileData.city}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">State</span>
                <span className="font-semibold text-slate-200">{profileData.state}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                  Pin Code <span className="text-[9px] text-green-500 font-bold">🔒 Masked</span>
                </span>
                <span className="font-semibold text-slate-200">{maskedPincode}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Addresses Summary Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Permanent Address</h4>
            <div className="text-xs text-slate-300 space-y-1">
              <p>{profileData.addressLine1}</p>
              {profileData.addressLine2 && <p>{profileData.addressLine2}</p>}
              <p>{profileData.city}, {profileData.state} - {maskedPincode}</p>
            </div>
          </div>

          <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850">
            <div className="flex justify-between items-center mb-2.5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Billing Address</h4>
              {profileData.sameAsPermanent && (
                <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">Same as Permanent</span>
              )}
            </div>
            <div className="text-xs text-slate-300 space-y-1">
              <p>{profileData.billingAddressLine1}</p>
              {profileData.billingAddressLine2 && <p>{profileData.billingAddressLine2}</p>}
              <p>{profileData.city}, {profileData.state} - {maskedPincode}</p>
            </div>
          </div>
        </div>

        {/* Documents Attached Summary Card */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-brand-orange" />
            Documents Attached Summary
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Aadhaar Front Chip */}
            <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-850 rounded-xl">
              <div className="text-xl">📇</div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 block">Aadhaar Front</span>
                <span className="text-xs font-semibold text-slate-200 block truncate">{documentData.aadhaarFront?.name}</span>
                <span className="text-[9px] text-slate-500">{documentData.aadhaarFront?.size}</span>
              </div>
            </div>

            {/* Aadhaar Back Chip */}
            <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-850 rounded-xl">
              <div className="text-xl">📇</div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 block">Aadhaar Back</span>
                <span className="text-xs font-semibold text-slate-200 block truncate">{documentData.aadhaarBack?.name}</span>
                <span className="text-[9px] text-slate-500">{documentData.aadhaarBack?.size}</span>
              </div>
            </div>

            {/* PAN Card Chip */}
            <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-850 rounded-xl">
              <div className="text-xl">💳</div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 block">PAN Card</span>
                <span className="text-xs font-semibold text-slate-200 block truncate">{documentData.panCard?.name}</span>
                <span className="text-[9px] text-slate-500">{documentData.panCard?.size}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Declaration and Action Bar */}
        <div className="pt-5 border-t border-slate-800 space-y-4">
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="consent"
              defaultChecked={true}
              className="w-4 h-4 rounded text-brand-orange bg-slate-900 border-slate-700 focus:ring-brand-orange mt-0.5"
            />
            <label htmlFor="consent" className="text-[10px] text-slate-400 leading-relaxed cursor-pointer select-none">
              I hereby declare that all the government credentials provided belong to me and are authentic. I consent to the auto-redaction processing for security compliance.
            </label>
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Edit
            </button>
            
            <button
              type="button"
              onClick={onSubmit}
              className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orangeHover text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-brand-orange/20 hover:shadow-brand-orange/35 transition-all"
            >
              Submit Application
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
