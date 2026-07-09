import React, { useState, useEffect } from 'react';
import { Camera, Mail, Phone, MapPin, Building, ChevronRight, User } from 'lucide-react';

export default function Step1PersonalInfo({ initialData, onNext }) {
  const [formData, setFormData] = useState({
    firstName: initialData.firstName || '',
    lastName: initialData.lastName || '',
    gender: initialData.gender || 'male',
    email: initialData.email || '',
    mobile: initialData.mobile || '',
    agencyName: initialData.agencyName || '',
    city: initialData.city || '',
    state: initialData.state || '',
    pincode: initialData.pincode || '',
    addressLine1: initialData.addressLine1 || '',
    addressLine2: initialData.addressLine2 || '',
    billingAddressLine1: initialData.billingAddressLine1 || '',
    billingAddressLine2: initialData.billingAddressLine2 || '',
    profilePhoto: initialData.profilePhoto || null,
    sameAsPermanent: initialData.sameAsPermanent ?? true
  });

  const [username, setUsername] = useState('username123');
  const [errors, setErrors] = useState({});

  // Generate dynamic username based on name inputs
  useEffect(() => {
    const fn = formData.firstName.trim().toLowerCase();
    const ln = formData.lastName.trim().toLowerCase();
    if (fn || ln) {
      setUsername(`${fn}${ln ? '_' + ln : ''}${formData.mobile ? formData.mobile.slice(-4) : '123'}`);
    } else {
      setUsername('username123');
    }
  }, [formData.firstName, formData.lastName, formData.mobile]);

  // Synchronize billing address if "sameAsPermanent" toggle is active
  useEffect(() => {
    if (formData.sameAsPermanent) {
      setFormData(prev => ({
        ...prev,
        billingAddressLine1: prev.addressLine1,
        billingAddressLine2: prev.addressLine2
      }));
    }
  }, [formData.addressLine1, formData.addressLine2, formData.sameAsPermanent]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleToggleSameAddress = (e) => {
    const checked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      sameAsPermanent: checked,
      billingAddressLine1: checked ? prev.addressLine1 : prev.billingAddressLine1,
      billingAddressLine2: checked ? prev.addressLine2 : prev.billingAddressLine2
    }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          profilePhoto: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Valid email is required';
    if (!formData.mobile.trim() || formData.mobile.replace(/\D/g, '').length !== 10) newErrors.mobile = '10-digit mobile is required';
    if (!formData.agencyName.trim()) newErrors.agencyName = 'Agency name is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pincode.trim() || formData.pincode.replace(/\D/g, '').length !== 6) newErrors.pincode = '6-digit pincode is required';
    if (!formData.addressLine1.trim()) newErrors.addressLine1 = 'Address line 1 is required';
    
    if (!formData.sameAsPermanent) {
      if (!formData.billingAddressLine1.trim()) newErrors.billingAddressLine1 = 'Billing address line 1 is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onNext({
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        username
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto bg-brand-navy rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-fadeIn m-4">
      {/* Header Band */}
      <div className="bg-brand-grayLight px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span>Personal Information</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">Please provide accurate demographic and agency contact details.</p>
      </div>

      <div className="p-5 sm:p-8 space-y-6 md:space-y-8">
        
        {/* Upper Section: Profile Photo left panel + Main grid fields side-by-side */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 border-b border-slate-800/60 pb-6 md:pb-8">
          
          {/* Left Profile Upload Panel */}
          <div className="md:w-1/4 flex flex-col items-center border-b md:border-b-0 md:border-r border-slate-800 pb-6 mb-6 md:pb-0 md:mb-0 md:pr-6">
            <div className="relative group w-32 h-32 rounded-full overflow-hidden bg-slate-900 border-2 border-slate-700 hover:border-brand-orange transition-all duration-300">
              {formData.profilePhoto ? (
                <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                  <User className="w-10 h-10" />
                </div>
              )}
              
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity duration-300 text-xs font-semibold text-slate-200">
                <Camera className="w-5 h-5 mb-1 text-brand-orange" />
                Upload Photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
            
            <div className="mt-3 text-center">
              <span className="text-xs text-slate-500 font-mono block">@{username}</span>
              <span className="text-[10px] text-slate-600 block mt-1">PNG, JPG, or JPEG up to 2MB</span>
            </div>
          </div>

          {/* Main Grid Fields */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                  errors.firstName ? 'border-red-500' : 'border-slate-800'
                }`}
                placeholder="Rahul"
              />
              {errors.firstName && <span className="text-[10px] text-red-500 mt-1 block">{errors.firstName}</span>}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                  errors.lastName ? 'border-red-500' : 'border-slate-800'
                }`}
                placeholder="Sharma"
              />
              {errors.lastName && <span className="text-[10px] text-red-500 mt-1 block">{errors.lastName}</span>}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand-orange"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                  errors.email ? 'border-red-500' : 'border-slate-800'
                }`}
                placeholder="rahul@example.com"
              />
              {errors.email && <span className="text-[10px] text-red-500 mt-1 block">{errors.email}</span>}
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" /> Mobile Number
              </label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                  errors.mobile ? 'border-red-500' : 'border-slate-800'
                }`}
                placeholder="10-digit number"
                maxLength="10"
              />
              {errors.mobile && <span className="text-[10px] text-red-500 mt-1 block">{errors.mobile}</span>}
            </div>

            {/* Agency Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-500" /> Agency Name
              </label>
              <input
                type="text"
                name="agencyName"
                value={formData.agencyName}
                onChange={handleChange}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                  errors.agencyName ? 'border-red-500' : 'border-slate-800'
                }`}
                placeholder="Vexaro Courier Ltd"
              />
              {errors.agencyName && <span className="text-[10px] text-red-500 mt-1 block">{errors.agencyName}</span>}
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                  errors.city ? 'border-red-500' : 'border-slate-800'
                }`}
                placeholder="Mumbai"
              />
              {errors.city && <span className="text-[10px] text-red-500 mt-1 block">{errors.city}</span>}
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                  errors.state ? 'border-red-500' : 'border-slate-800'
                }`}
                placeholder="Maharashtra"
              />
              {errors.state && <span className="text-[10px] text-red-500 mt-1 block">{errors.state}</span>}
            </div>

            {/* Pin Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> Pin Code
              </label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-2 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                  errors.pincode ? 'border-red-500' : 'border-slate-800'
                }`}
                placeholder="6-digit pincode"
                maxLength="6"
              />
              {errors.pincode && <span className="text-[10px] text-red-500 mt-1 block">{errors.pincode}</span>}
            </div>
          </div>

        </div>

        {/* Toggle Button for Address Sync */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="sameAsPermanent"
            checked={formData.sameAsPermanent}
            onChange={handleToggleSameAddress}
            className="w-4 h-4 rounded text-brand-orange bg-slate-900 border-slate-700 focus:ring-brand-orange"
          />
          <label htmlFor="sameAsPermanent" className="text-xs font-semibold text-slate-300 cursor-pointer">
            Billing address same as permanent address
          </label>
        </div>

        {/* Lower Address Cards Section (Full Width, side-by-side) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Permanent Address Card */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 shadow-md">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-orange"></span> Permanent Address
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Address Line 1</label>
                <input
                  type="text"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  className={`w-full bg-slate-900 border rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange ${
                    errors.addressLine1 ? 'border-red-500' : 'border-slate-800'
                  }`}
                  placeholder="Flat/House No, Building"
                />
                {errors.addressLine1 && <span className="text-[9px] text-red-500 mt-1 block">{errors.addressLine1}</span>}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Address Line 2</label>
                <input
                  type="text"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-700 focus:outline-none focus:border-brand-orange"
                  placeholder="Street, Landmark, Locality"
                />
              </div>
            </div>
          </div>

          {/* Billing Address Card */}
          <div className={`p-5 rounded-2xl border shadow-md transition-all duration-300 ${
            formData.sameAsPermanent 
              ? 'bg-slate-900/40 border-slate-900 opacity-60' 
              : 'bg-slate-950 border-slate-850'
          }`}>
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span> Billing Address
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Address Line 1</label>
                <input
                  type="text"
                  name="billingAddressLine1"
                  value={formData.billingAddressLine1}
                  onChange={handleChange}
                  disabled={formData.sameAsPermanent}
                  className={`w-full border rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-750 focus:outline-none focus:border-brand-orange ${
                    formData.sameAsPermanent ? 'bg-slate-900 cursor-not-allowed border-slate-850 text-slate-500' : 'bg-slate-900 border-slate-800'
                  } ${errors.billingAddressLine1 && !formData.sameAsPermanent ? 'border-red-500' : ''}`}
                  placeholder="Flat/House No, Building"
                />
                {errors.billingAddressLine1 && !formData.sameAsPermanent && (
                  <span className="text-[9px] text-red-500 mt-1 block">{errors.billingAddressLine1}</span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Address Line 2</label>
                <input
                  type="text"
                  name="billingAddressLine2"
                  value={formData.billingAddressLine2}
                  onChange={handleChange}
                  disabled={formData.sameAsPermanent}
                  className={`w-full border rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-750 focus:outline-none focus:border-brand-orange ${
                    formData.sameAsPermanent ? 'bg-slate-900 cursor-not-allowed border-slate-850 text-slate-500' : 'bg-slate-900 border-slate-800'
                  }`}
                  placeholder="Street, Landmark, Locality"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions footer */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            type="submit"
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orangeHover text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-brand-orange/20 transition-all"
          >
            Next: Upload KYC Documents
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
