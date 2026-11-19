import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Globe, MapPin, History, ExternalLink, Info, Briefcase } from 'lucide-react';
import { apiRequest } from '../api';
import { AuthUser, Company, isPlacementAdminRole, PlacementDrive } from '../types';
import { cardCls, ConfirmDialog, inputCls, labelCls, Modal, StatusText, useToast } from './SharedUI';

export function CompaniesView({ user }: { user: AuthUser }) {
  const canManage = isPlacementAdminRole(user.role) && user.role !== 'VICE_CHAIRMAN';
  const { showToast } = useToast();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [q, setQ] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [officialWebsite, setOfficialWebsite] = useState('');
  const [careerPageUrl, setCareerPageUrl] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [description, setDescription] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [formErr, setFormErr] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [historyCompany, setHistoryCompany] = useState<Company | null>(null);

  const loadCompanies = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (industryFilter) params.set('industry', industryFilter);
    apiRequest<Company[]>(`/api/companies?${params.toString()}`)
      .then(setCompanies)
      .catch((err) => showToast(err instanceof Error ? err.message : 'Unable to load companies', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiRequest<PlacementDrive[]>('/api/drives').then(setDrives).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(loadCompanies, 150);
    return () => clearTimeout(t);
  }, [q, industryFilter]);

  const industries = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => {
      if (c.industry) set.add(c.industry);
    });
    return Array.from(set).sort();
  }, [companies]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setIndustry('');
    setOfficialWebsite('');
    setCareerPageUrl('');
    setHeadquarters('Hyderabad, India');
    setDescription('');
    setContactPerson('');
    setContactEmail('');
    setContactPhone('');
    setFormErr('');
    setModalOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setName(c.company_name);
    setIndustry(c.industry);
    setOfficialWebsite(c.official_website || '');
    setCareerPageUrl(c.career_page_url || '');
    setHeadquarters(c.headquarters || '');
    setDescription(c.description || '');
    setContactPerson(c.contact_person || '');
    setContactEmail(c.contact_email || '');
    setContactPhone(c.contact_phone || '');
    setFormErr('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    try {
      const payload = {
        companyName: name,
        industry,
        officialWebsite,
        careerPageUrl: careerPageUrl || officialWebsite,
        headquarters,
        description,
        contactPerson,
        contactEmail,
        contactPhone,
      };
      if (editing) {
        await apiRequest(`/api/companies/${editing.company_id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast(`${name} updated in Company Directory.`);
      } else {
        await apiRequest('/api/companies', { method: 'POST', body: JSON.stringify(payload) });
        showToast(`${name} added to Company Directory.`);
      }
      setModalOpen(false);
      loadCompanies();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Unable to save company');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/companies/${deleteTarget.company_id}`, { method: 'DELETE' });
      showToast(`${deleteTarget.company_name} removed from directory.`, 'info');
      setDeleteTarget(null);
      loadCompanies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete company', 'error');
      setDeleteTarget(null);
    }
  };

  const companyDrives = historyCompany
    ? drives.filter((d) => d.company_id === historyCompany.company_id)
    : [];

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className={`${cardCls} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#172033] dark:text-white">GCET Recruiter & Company Directory</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {companies.length} organizations · Official websites, career portals, HR contacts, and campus hiring records
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 flex-1 sm:flex-initial justify-end">
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search company, HQ, sector..."
                className={`${inputCls} pl-9`}
              />
            </div>
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className={`${inputCls} w-full sm:w-48`}
              aria-label="Filter by industry"
            >
              <option value="">All Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
            {canManage && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Company</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <span>
            Preloaded organizations represent a starting reference directory of recruiters noted in GCET placement publications. Active hiring rounds and cutoffs are published separately in the Placement Opportunities Board and official career portals.
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${cardCls} h-52 bg-slate-100 dark:bg-slate-800/50`} />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className={`${cardCls} p-10 text-center text-xs text-slate-500 dark:text-slate-400`}>
          No companies matched your filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {companies.map((c) => (
            <div key={c.company_id} className={`${cardCls} p-5 flex flex-col justify-between`}>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[#172033] dark:text-white">{c.company_name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {c.industry}
                      {c.is_directory_reference ? ' · Publication Reference' : ' · Added by Placement Cell'}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openEdit(c)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded" title="Edit Company">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(c)} className="p-1.5 text-slate-500 hover:text-red-600 rounded" title="Delete Company">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed line-clamp-2">
                  {c.description || 'Recruiting organization listed in the GCET Career Connect directory.'}
                </p>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <p className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{c.headquarters}</span>
                  </p>
                  {c.official_website && (
                    <p className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a
                        href={c.official_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-[#246BFD] dark:text-[#20C5E8] hover:underline inline-flex items-center gap-1"
                      >
                        <span className="truncate">{c.official_website.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </p>
                  )}
                  {c.career_page_url && (
                    <p className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a
                        href={c.career_page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-[#246BFD] dark:text-[#20C5E8] hover:underline inline-flex items-center gap-1"
                      >
                        <span className="truncate">Official Careers Portal</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between text-xs">
                <div className="text-slate-500 dark:text-slate-400">
                  <span className="font-mono tabular-nums font-semibold text-[#172033] dark:text-white">{c.driveCount ?? 0}</span> drives ·{' '}
                  <span className="font-mono tabular-nums font-semibold text-[#172033] dark:text-white">{c.placedCount ?? 0}</span> hired
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryCompany(c)}
                  className="inline-flex items-center gap-1 font-medium text-[#246BFD] dark:text-[#20C5E8] hover:underline"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Contacts & Drives</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} title={editing ? `Edit Company — ${editing.company_name}` : 'Add Organization to Directory'} onClose={() => setModalOpen(false)} maxWidth="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-3.5">
          {formErr && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{formErr}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Company Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Industry / Sector</label>
              <input required value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="IT Services / Cloud / FinTech" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Headquarters</label>
              <input required value={headquarters} onChange={(e) => setHeadquarters(e.target.value)} placeholder="Hyderabad, India" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Official Website URL</label>
              <input type="url" required value={officialWebsite} onChange={(e) => setOfficialWebsite(e.target.value)} placeholder="https://www.company.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Careers Portal URL</label>
              <input type="url" value={careerPageUrl} onChange={(e) => setCareerPageUrl(e.target.value)} placeholder="https://careers.company.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>HR Contact Person</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Campus Relations Lead" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>HR Contact Email</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="campus@company.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>HR Contact Phone</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91 40 ..." className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Company Overview</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#246BFD] text-white hover:bg-blue-700">Save Company</button>
          </div>
        </form>
      </Modal>

      {/* Company Details, Contacts & History Modal */}
      <Modal
        open={Boolean(historyCompany)}
        title={`${historyCompany?.company_name} — Directory Profile & Drives`}
        onClose={() => setHistoryCompany(null)}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-slate-700/70 space-y-2">
            <p className="font-semibold text-[#172033] dark:text-white">Primary Campus Relations Contact</p>
            <p className="text-slate-600 dark:text-slate-300">
              {historyCompany?.contact_person || 'Campus Recruitment Desk'}
              {historyCompany?.designation ? ` (${historyCompany.designation})` : ''}
              {historyCompany?.contact_email ? ` · ${historyCompany.contact_email}` : ''}
              {historyCompany?.contact_phone ? ` · ${historyCompany.contact_phone}` : ''}
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              {historyCompany?.official_website && (
                <a
                  href={historyCompany.official_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#246BFD] dark:text-[#20C5E8] hover:underline inline-flex items-center gap-1 font-medium"
                >
                  Official Website <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {historyCompany?.career_page_url && (
                <a
                  href={historyCompany.career_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#246BFD] dark:text-[#20C5E8] hover:underline inline-flex items-center gap-1 font-medium"
                >
                  Careers Portal <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <div>
            <p className="font-semibold text-[#172033] dark:text-white mb-2">Portal Placement Drives</p>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
              {companyDrives.map((d) => (
                <div key={d.drive_id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#172033] dark:text-white">{d.job_role}</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {d.job_type} · {d.drive_date} · {d.compensation_label || `${Number(d.salary_package).toFixed(2)} LPA`} · Branches: {d.eligible_branches}
                    </p>
                  </div>
                  <StatusText status={d.drive_status} />
                </div>
              ))}
              {companyDrives.length === 0 && (
                <p className="py-6 text-center text-slate-500">No active or past portal drives recorded for this organization yet.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Company"
        message={`Remove ${deleteTarget?.company_name} from the directory? Associated placement drives will also be deleted.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
