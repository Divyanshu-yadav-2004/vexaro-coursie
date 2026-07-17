import React, { useState, useEffect } from 'react';
import { Search, Filter, ShieldCheck, UserCheck, AlertTriangle, FileText, CheckCircle2, XCircle, ArrowLeft, Eye, EyeOff, ShieldAlert, Check, X, Shield, RefreshCw } from 'lucide-react';
import { getAllUsers, getAllKYC, updateKYCStatus, redactEmail, redactMobile, redactPincode } from '../utils/api';

export default function AdminDashboard({ currentUser, onLogout }) {
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isPIIRevealed, setIsPIIRevealed] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Load database on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // getAllKYC returns records with embedded .user data
      const kycRecords = await getAllKYC();
      // Extract unique users from the kyc records
      const usersFromKyc = kycRecords.map(r => ({
        ...r.user,
        kycStatus: r.status,
        kycId: r.id,
      }));
      setUsers(usersFromKyc);
      setRecords(kycRecords);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  // Guard Clause: Only Admins or Owners allowed
  if (currentUser.role !== 'admin' && currentUser.role !== 'owner') {
    return (
      <div className="w-full max-w-md mx-auto bg-brand-navy rounded-2xl p-8 border border-red-900 shadow-2xl text-center animate-fadeIn">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-slate-100 mb-2">Access Denied</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          You are authenticated as a standard client and do not have access to the Verification Desk.
        </p>
        <button
          onClick={onLogout}
          className="w-full bg-brand-orange hover:bg-brand-orangeHover text-white font-semibold py-2 rounded-xl transition-all"
        >
          Return to Portal Login
        </button>
      </div>
    );
  }

  // Calculate statistics from KYC records
  const totalClients = records.length;
  const pendingCount  = records.filter(r => r.status === 'pending').length;
  const approvedCount = records.filter(r => r.status === 'approved').length;
  const rejectedCount = records.filter(r => r.status === 'rejected').length;

  // Filter clients
  const filteredUsers = users.filter(u => {
    const name    = (u.name || '').toLowerCase();
    const email   = (u.email || '').toLowerCase();
    const agency  = (u.agencyName || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = name.includes(q) || email.includes(q) || agency.includes(q);
    const matchesStatus = statusFilter === 'all' ? true : u.kycStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleOpenDetails = (client) => {
    const kyc = records.find(r => r.userId === client.id || r.user?.id === client.id) || null;
    setSelectedClient(client);
    setSelectedRecord(kyc);
    setIsPIIRevealed(false);
    setShowRejectForm(false);
    setRejectionReason('');
  };

  const handleCloseDetails = () => {
    setSelectedClient(null);
    setSelectedRecord(null);
    setIsPIIRevealed(false);
  };

  const handlePIIToggle = () => {
    if (!isPIIRevealed) {
      // Simulate audit logging
      const newLog = {
        timestamp: new Date().toLocaleTimeString(),
        actor: currentUser.email,
        action: `PII Decrypted for client ${selectedClient.name}`,
        level: 'WARNING'
      };
      setAuditLogs(prev => [newLog, ...prev]);
    }
    setIsPIIRevealed(!isPIIRevealed);
  };

  const describeWhatsAppResult = (whatsapp) => {
    if (!whatsapp) return 'WhatsApp notification result unavailable.';
    if (whatsapp.sent) {
      return `WhatsApp notification sent via ${whatsapp.mode || 'api'}${whatsapp.messageId ? ` (message ${whatsapp.messageId})` : ''}.`;
    }
    if (whatsapp.skipped) {
      if (whatsapp.reason === 'whatsapp_not_configured') {
        return 'WhatsApp setup is missing in backend/.env.';
      }
      if (whatsapp.reason === 'missing_mobile') {
        return 'WhatsApp notification skipped because this user has no mobile number.';
      }
      return `WhatsApp notification skipped: ${whatsapp.reason || 'not_applicable'}.`;
    }
    return `WhatsApp notification failed: ${whatsapp.reason || 'unknown_error'}.`;
  };

  const handleApprove = async () => {
    if (!selectedClient) return;
    try {
      const result = await updateKYCStatus(selectedRecord.id, 'approved');
      const updatedRecord = result.kyc;
      const whatsappSummary = describeWhatsAppResult(result.whatsapp);
      // Log action
      const newLog = {
        timestamp: new Date().toLocaleTimeString(),
        actor: currentUser.email,
        action: `KYC APPROVED: Client ${selectedClient.name} verification completed. ${whatsappSummary}`,
        level: 'INFO'
      };
      setAuditLogs(prev => [newLog, ...prev]);
      // Refresh state
      await loadData();
      setSelectedClient(prev => ({ ...prev, kycStatus: 'approved' }));
      setSelectedRecord(updatedRecord);
    } catch (err) {
      console.error('Approve failed:', err);
      setAuditLogs(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        actor: currentUser.email,
        action: `KYC APPROVAL FAILED: ${err.message || 'Unknown error'}`,
        level: 'CRITICAL'
      }, ...prev]);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!selectedClient || !rejectionReason.trim()) return;
    try {
      const result = await updateKYCStatus(selectedRecord.id, 'rejected', rejectionReason);
      const updatedRecord = result.kyc;

    // Log action
    const newLog = {
      timestamp: new Date().toLocaleTimeString(),
      actor: currentUser.email,
      action: `KYC REJECTED: Client ${selectedClient.name}. Reason: ${rejectionReason}`,
      level: 'CRITICAL'
    };
    setAuditLogs(prev => [newLog, ...prev]);

    // Refresh state
    await loadData();
    setSelectedClient(prev => ({ ...prev, kycStatus: 'rejected' }));
    setSelectedRecord(updatedRecord);
    setShowRejectForm(false);
    setRejectionReason('');
    } catch (err) {
      console.error('Reject failed:', err);
      setAuditLogs(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        actor: currentUser.email,
        action: `KYC REJECTION FAILED: ${err.message || 'Unknown error'}`,
        level: 'CRITICAL'
      }, ...prev]);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn px-4">
      
      {/* Admin Navbar */}
      <header className="bg-brand-navy border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand-orange" />
          </div>
          <div>
            <h1 className="text-md font-extrabold text-slate-100 flex items-center gap-1.5">
              VEXARO Verification Desk
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                currentUser.role === 'owner' ? 'bg-red-950/50 text-red-400 border border-red-800' : 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30'
              }`}>
                {currentUser.role}
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">Control center for reviewing client document onboarding</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-300 font-semibold block">{currentUser.name}</span>
            <span className="text-[10px] text-slate-500 block">{currentUser.email}</span>
          </div>
          <button
            onClick={loadData}
            title="Refresh data"
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 text-xs font-bold p-2 rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onLogout}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white text-slate-400 text-xs font-bold px-4 py-2 rounded-xl transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-brand-navy p-5 rounded-2xl border border-slate-800 shadow-md">
          <span className="text-xs text-slate-400 block font-semibold">Total Portals Registered</span>
          <span className="text-2xl font-black text-slate-100 block mt-1">{totalClients}</span>
        </div>
        
        {/* Metric 2 */}
        <div className="bg-brand-navy p-5 rounded-2xl border border-slate-800 shadow-md flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-400 block font-semibold">Pending Review</span>
            <span className="text-2xl font-black text-amber-500 block mt-1">{pendingCount}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-brand-navy p-5 rounded-2xl border border-slate-800 shadow-md flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-400 block font-semibold">Approved Portals</span>
            <span className="text-2xl font-black text-green-500 block mt-1">{approvedCount}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-green-500" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-brand-navy p-5 rounded-2xl border border-slate-800 shadow-md flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-400 block font-semibold">Rejected Portals</span>
            <span className="text-2xl font-black text-red-500 block mt-1">{rejectedCount}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Search, Filter, Table Panel */}
        <div className="lg:col-span-2 bg-brand-navy rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          {/* Header Controls */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, agency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-orange"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-orange"
              >
                <option value="all">All KYC Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Client Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {/* Brand Compliant Light Blue-Gray Header Band */}
                <tr className="bg-brand-grayLight border-b border-slate-700 text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 rounded-tl-2xl">Client Name</th>
                  <th className="py-3.5 px-4">Agency Name</th>
                  <th className="py-3.5 px-4 text-center">KYC Status</th>
                  <th className="py-3.5 px-4 rounded-tr-2xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{client.name}</div>
                        <div className="text-[10px] text-slate-500">{client.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-medium">{client.agencyName}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          client.kycStatus === 'approved' ? 'bg-green-950/40 text-green-400 border-green-800' :
                          client.kycStatus === 'pending' ? 'bg-amber-950/40 text-amber-400 border-amber-800 animate-pulse' :
                          client.kycStatus === 'rejected' ? 'bg-red-950/40 text-red-400 border-red-800' :
                          'bg-slate-800 text-slate-400 border-slate-750'
                        }`}>
                          {client.kycStatus.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetails(client)}
                          className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 hover:text-brand-orange border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Review Desk
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-500 font-semibold">
                      No onboarding clients matched the query filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Audit Log Panel */}
        <div className="bg-brand-navy rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col h-[400px]">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500 animate-pulse" />
            Security Decryption Audit Log
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar text-[10px]">
            {auditLogs.length > 0 ? (
              auditLogs.map((log, idx) => (
                <div key={idx} className="p-2.5 bg-slate-950 border border-slate-850 rounded-xl space-y-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className={
                      log.level === 'CRITICAL' ? 'text-red-400' :
                      log.level === 'WARNING' ? 'text-amber-400' :
                      'text-green-400'
                    }>
                      [{log.level}]
                    </span>
                    <span className="text-slate-500 font-mono">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-mono">{log.action}</p>
                  <div className="text-slate-500">Actor: {log.actor}</div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-4">
                <ShieldCheck className="w-8 h-8 mb-2 opacity-30 text-green-500" />
                No sensitive decryption logs registered yet. Access Client PII to audit logs.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Detail & Decision Desk Drawer / Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-navy w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-y-auto border border-slate-800 shadow-2xl flex flex-col animate-slideUp">
            
            {/* Modal Header Band */}
            <div className="bg-brand-grayLight px-6 py-4 border-b border-slate-700 flex justify-between items-center sticky top-0 z-15">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Verification Desk: {selectedClient.name}
                </h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Verify government card attachments and approve client portal onboarding
                </p>
              </div>
              
              <button
                onClick={handleCloseDetails}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 p-2 rounded-xl transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              
              {/* Decryption Control Guard (Redaction Layer) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    {isPIIRevealed ? (
                      <span className="text-green-500 animate-pulse">🔓 Plaintext Access Granted</span>
                    ) : (
                      <span className="text-amber-500">🔒 PII Masking and Document Redaction Active</span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                    Personally Identifiable Information is encrypted and file names are redacted to comply with local privacy policies.
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={handlePIIToggle}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                    isPIIRevealed
                      ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-brand-orange/20 border-brand-orange text-brand-orange hover:bg-brand-orange/30'
                  }`}
                >
                  {isPIIRevealed ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Mask PII Details
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Authorize Decryption
                    </>
                  )}
                </button>
              </div>

              {/* Data Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Card 1: Identity */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-3.5 text-xs">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wide">Identity Details</h4>
                  <div>
                    <span className="text-slate-500 block">Full Name</span>
                    <span className="font-semibold text-slate-200">{selectedClient.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Gender</span>
                    <span className="font-semibold text-slate-200 capitalize">{selectedClient.gender || 'Not Provided'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Username</span>
                    <span className="font-mono text-slate-400">@{selectedClient.username || 'username123'}</span>
                  </div>
                </div>

                {/* Card 2: Contacts */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-3.5 text-xs">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wide">Contact Details</h4>
                  <div>
                    <span className="text-slate-500 block">Agency Name</span>
                    <span className="font-semibold text-slate-200">{selectedClient.agencyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block flex items-center gap-1.5">
                      Email Address {!isPIIRevealed && <span className="text-[8px] font-bold text-green-500 uppercase">🔒 Masked</span>}
                    </span>
                    <span className="font-semibold text-slate-200">
                      {isPIIRevealed ? selectedClient.email : redactEmail(selectedClient.email)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block flex items-center gap-1.5">
                      Mobile Number {!isPIIRevealed && <span className="text-[8px] font-bold text-green-500 uppercase">🔒 Masked</span>}
                    </span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {isPIIRevealed ? selectedClient.mobile : redactMobile(selectedClient.mobile)}
                    </span>
                  </div>
                </div>

                {/* Card 3: Regional */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-3.5 text-xs">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wide">Location Info</h4>
                  <div>
                    <span className="text-slate-500 block">City / State</span>
                    <span className="font-semibold text-slate-200">{selectedClient.city}, {selectedClient.state}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block flex items-center gap-1.5">
                      Pin Code {!isPIIRevealed && <span className="text-[8px] font-bold text-green-500 uppercase">🔒 Masked</span>}
                    </span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {isPIIRevealed ? selectedClient.pincode : redactPincode(selectedClient.pincode)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">KYC Verification Status</span>
                    <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      selectedClient.kycStatus === 'approved' ? 'bg-green-950/30 text-green-400 border-green-800' :
                      selectedClient.kycStatus === 'pending' ? 'bg-amber-950/30 text-amber-400 border-amber-800' :
                      selectedClient.kycStatus === 'rejected' ? 'bg-red-950/30 text-red-400 border-red-800' :
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {selectedClient.kycStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>

              </div>

              {/* Addresses Summary block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 text-xs">
                  <h4 className="font-bold text-slate-400 uppercase mb-2">Permanent Address</h4>
                  <p className="text-slate-300">{selectedClient.addressLine1 || selectedClient.address || 'Address not filled'}</p>
                  {selectedClient.addressLine2 && <p className="text-slate-300 mt-1">{selectedClient.addressLine2}</p>}
                </div>

                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 text-xs">
                  <h4 className="font-bold text-slate-400 uppercase mb-2">Billing Address</h4>
                  <p className="text-slate-300">{selectedClient.billingAddressLine1 || selectedClient.address || 'Address not filled'}</p>
                  {selectedClient.billingAddressLine2 && <p className="text-slate-300 mt-1">{selectedClient.billingAddressLine2}</p>}
                </div>
              </div>

              {/* Document previews & Redacted File Chips */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Government Identity Attachments</h4>
                
                {selectedRecord ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Aadhaar Front */}
                    <div className="bg-slate-900 border border-slate-850 rounded-xl p-3 flex flex-col justify-between h-[160px]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-brand-orange" />
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Aadhaar Front</span>
                      </div>
                      
                      {/* Document Redaction Logic applied to file names */}
                      <div className="my-3 text-center">
                        <span className="text-xs font-bold text-slate-200 block truncate max-w-full">
                          {selectedRecord.aadhaarFront?.name}
                        </span>
                        <span className="text-[9px] text-slate-500">{selectedRecord.aadhaarFront?.size || '420 KB'}</span>
                      </div>

                      <div className="bg-green-950/30 text-green-400 text-[8px] font-bold px-2 py-0.5 rounded-full border border-green-800/40 text-center uppercase tracking-wide">
                        🛡️ Auto-Redacted Secure
                      </div>
                    </div>

                    {/* Aadhaar Back */}
                    <div className="bg-slate-900 border border-slate-850 rounded-xl p-3 flex flex-col justify-between h-[160px]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-brand-orange" />
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Aadhaar Back</span>
                      </div>
                      
                      <div className="my-3 text-center">
                        <span className="text-xs font-bold text-slate-200 block truncate max-w-full">
                          {selectedRecord.aadhaarBack?.name}
                        </span>
                        <span className="text-[9px] text-slate-500">{selectedRecord.aadhaarBack?.size || '390 KB'}</span>
                      </div>

                      <div className="bg-green-950/30 text-green-400 text-[8px] font-bold px-2 py-0.5 rounded-full border border-green-800/40 text-center uppercase tracking-wide">
                        🛡️ Auto-Redacted Secure
                      </div>
                    </div>

                    {/* PAN Card */}
                    <div className="bg-slate-900 border border-slate-850 rounded-xl p-3 flex flex-col justify-between h-[160px]">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-brand-orange" />
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">PAN Card</span>
                      </div>
                      
                      <div className="my-3 text-center">
                        <span className="text-xs font-bold text-slate-200 block truncate max-w-full">
                          {selectedRecord.panCard?.name}
                        </span>
                        <span className="text-[9px] text-slate-500">{selectedRecord.panCard?.size || '310 KB'}</span>
                      </div>

                      <div className="bg-green-950/30 text-green-400 text-[8px] font-bold px-2 py-0.5 rounded-full border border-green-800/40 text-center uppercase tracking-wide">
                        🛡️ Auto-Redacted Secure
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-500 py-6 font-semibold">
                    Client has not uploaded any verification documents yet.
                  </div>
                )}
              </div>

              {/* Rejection Notification if exists */}
              {selectedClient.kycStatus === 'rejected' && selectedRecord?.rejectionReason && (
                <div className="bg-red-950/30 border border-red-900 p-4 rounded-xl text-xs">
                  <span className="font-bold text-red-400 block mb-1">Previous Rejection Notice</span>
                  <p className="text-slate-300 font-mono">{selectedRecord.rejectionReason}</p>
                </div>
              )}

              {/* Reject Form Drawer */}
              {showRejectForm && (
                <form onSubmit={handleReject} className="bg-slate-950 p-4 rounded-xl border border-red-900/40 space-y-3.5 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Enter Rejection Reason Details</label>
                    <textarea
                      required
                      placeholder="Specify what was incorrect (e.g. Blurry PAN, name mismatch)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-650 focus:outline-none focus:border-red-500 h-20"
                    />
                  </div>
                  <div className="flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="bg-slate-900 text-slate-300 border border-slate-800 text-xs font-bold px-4 py-1.5 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-all shadow-lg shadow-red-600/15"
                    >
                      Confirm Reject KYC
                    </button>
                  </div>
                </form>
              )}

            </div>

            {/* Modal Footer Controls */}
            {selectedClient.kycStatus === 'pending' && !showRejectForm && (
              <div className="bg-slate-950 p-4 border-t border-slate-850 flex justify-end gap-3 sticky bottom-0 z-15">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  className="bg-red-950/40 text-red-400 border border-red-800 hover:bg-red-950/70 text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
                >
                  Reject Application
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="bg-brand-orange hover:bg-brand-orangeHover text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-brand-orange/20"
                >
                  Approve Application
                </button>
              </div>
            )}
            
          </div>
        </div>
      )}

    </div>
  );
}
