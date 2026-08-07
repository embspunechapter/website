import { useEffect, useRef, useState } from 'react';
import { 
  Users, Settings, FileSpreadsheet, Upload, UserPlus, 
  Bell, FileText, Award, BarChart3, Trash2, AlertTriangle, Search, Plus, Activity,
  BookOpen, Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import CertificatePreviewModal from '../components/CertificatePreviewModal';

const fileTypes = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel';
const emptyPerson = { id: '', full_name: '', email: '', role: 'mentor', domain: '', group_id: '', mentor_capacity: 4 };
const normalise = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const findColumn = (row, names) => {
  if (!row) return undefined;
  const normalisedKeys = Object.keys(row).map(k => ({ original: k, normalised: normalise(k) }));
  const exactMatch = normalisedKeys.find(nk => names.includes(nk.normalised));
  if (exactMatch) return exactMatch.original;
  const subMatch = normalisedKeys.find(nk => names.some(name => nk.normalised.includes(name)));
  if (subMatch) return subMatch.original;
  return undefined;
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reports, setReports] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState({});
  const [managementSearch, setManagementSearch] = useState('');
  const [manageRole, setManageRole] = useState('student');
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({ name: '', type: 'report', file: null });
  const [certPreview, setCertPreview] = useState(null);
  const [milestonesData, setMilestonesData] = useState([]);
  const fileInputRef = useRef(null);
  
  // Filtering and Searching
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [selectedStudentCerts, setSelectedStudentCerts] = useState({});
  const [mgmtSectionFilter, setMgmtSectionFilter] = useState('');
  const [mgmtCityFilter, setMgmtCityFilter] = useState('');
  const [mgmtIeeeFilter, setMgmtIeeeFilter] = useState('');
  const [mgmtYearFilter, setMgmtYearFilter] = useState('');
  const [mgmtDomainFilter, setMgmtDomainFilter] = useState('');
  const [mgmtCollegeFilter, setMgmtCollegeFilter] = useState('');
  const [mgmtOrgFilter, setMgmtOrgFilter] = useState('');
  const [mgmtDesignationFilter, setMgmtDesignationFilter] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [person, setPerson] = useState(emptyPerson);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [importRole, setImportRole] = useState('mentor');
  const [parsedPeople, setParsedPeople] = useState(null);
  const [parsedTeams, setParsedTeams] = useState(null);
  
  // Announcements form
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', audience: 'all', deadline_at: '' });
  
  const peopleInputRef = useRef(null);
  const teamsInputRef = useRef(null);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 5000);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [{ data: profiles, error: profilesError }, { data: groupData, error: groupError }, { data: reportData, error: reportError }, { data: annData, error: annError }, { data: certData, error: certError }, { data: templateData, error: templateError }, { data: milestoneData, error: milestoneError }, { data: meetingData, error: meetingError }] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('groups').select('*').order('id'),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('certificates').select('*').order('issued_at', { ascending: false }),
        supabase.from('templates').select('*').order('created_at', { ascending: false }),
        supabase.from('milestones').select('*').order('due_date', { ascending: true }),
        supabase.from('meetings').select('*').order('held_at', { ascending: false })
      ]);

      if (profilesError) throw profilesError;
      if (groupError) throw groupError;
      if (reportError) throw reportError;
      if (annError) throw annError;
      if (certError) throw certError;
      if (milestoneError) throw milestoneError;
      if (meetingError) throw meetingError;
      if (templateError) {
        console.warn('Templates table not found, please run migrations:', templateError.message);
      }

      const allProfiles = profiles || [];
      setStudents(allProfiles.filter((profile) => profile.role === 'student'));
      setMentors(allProfiles.filter((profile) => profile.role === 'mentor'));
      setAnnouncements(annData || []);
      setCertificates(certData || []);
      setMilestonesData(milestoneData || []);
      setTemplates(templateData || []);
      setMeetings(meetingData || []);
      
      setGroups((groupData || []).map((group) => ({
        ...group,
        mentor: allProfiles.find((profile) => profile.id === group.mentor_id) || null,
        members: allProfiles.filter((profile) => profile.role === 'student' && profile.group_id === group.id),
      })));

      setReports((reportData || []).map((report) => ({
        ...report,
        submitter: allProfiles.find((profile) => profile.id === report.submitted_by)?.full_name || 'Student',
        reviewer: allProfiles.find((profile) => profile.id === report.reviewed_by)?.full_name || null,
      })));

    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      showNotice(`Could not load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUploadTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplate.name || !newTemplate.file) {
      showNotice('Format name and file are required.');
      return;
    }
    setSaving(true);
    try {
      const file = newTemplate.file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `formats/${fileName}`;

      // Upload file to Supabase storage bucket 'templates'
      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('templates')
        .getPublicUrl(filePath);

      // Insert record in templates table
      const { error: insertError } = await supabase
        .from('templates')
        .insert({
          name: newTemplate.name.trim(),
          type: newTemplate.type,
          file_url: publicUrl
        });

      if (insertError) throw insertError;

      setNewTemplate({ name: '', type: 'report', file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Refresh dashboard data
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (!templateError && templateData) {
        setTemplates(templateData);
      }

      showNotice('Format uploaded successfully.');
    } catch (error) {
      console.error(error);
      showNotice(`Failed to upload format: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`Are you sure you want to delete the format "${template.name}"?`)) return;
    setSaving(true);
    try {
      // Extract filename from file_url
      // Example: https://.../storage/v1/object/public/templates/formats/abc-123.pdf
      const urlParts = template.file_url.split('/storage/v1/object/public/templates/');
      const filePath = urlParts[1];
      if (filePath) {
        await supabase.storage.from('templates').remove([filePath]);
      }
      
      const { error } = await supabase.from('templates').delete().eq('id', template.id);
      if (error) throw error;
      
      // Refresh templates
      const { data: templateData } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (templateData) {
        setTemplates(templateData);
      }

      showNotice('Format deleted successfully.');
    } catch (error) {
      console.error(error);
      showNotice(`Failed to delete format: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const savePerson = async (event) => {
    event.preventDefault();
    if (!person.full_name || !person.email) {
      showNotice('Full name and email are required.');
      return;
    }
    const finalId = person.id.trim() || crypto.randomUUID();
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${finalId},email.eq.${person.email.trim().toLowerCase()}`)
        .maybeSingle();

      const profilePayload = {
        full_name: person.full_name.trim(),
        email: person.email.trim().toLowerCase(),
        role: person.role,
        domain: person.domain.trim() || null,
        mentor_capacity: person.role === 'mentor' ? parseInt(person.mentor_capacity) || 4 : null,
        group_id: person.role === 'student' ? person.group_id.trim() || null : null,
      };

      if (existing) {
        const { error } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: finalId,
            ...profilePayload
          });
        if (error) throw error;
      }
      setPerson({ ...emptyPerson, role: person.role });
      await fetchDashboardData();
      showNotice(`${person.role === 'mentor' ? 'Mentor' : 'Student'} profile saved successfully.`);
    } catch (error) {
      console.error('Error saving profile:', error);
      showNotice(`Could not save profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteProfiles = async (profileIds, role) => {
    if (!profileIds || profileIds.length === 0) return;
    const confirmMsg = `Are you sure you want to delete ${profileIds.length} ${role}(s)? This will remove their profiles and delete related certificates, reports, and group assignments.`;
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const currentAdminId = (await supabase.auth.getUser()).data.user?.id;
      const idsToDelete = profileIds.filter(id => id !== currentAdminId);
      if (idsToDelete.length === 0) {
        showNotice("You cannot delete your own admin account.");
        return;
      }

      // Delete notifications for targeted profiles first
      await supabase
        .from('notifications')
        .delete()
        .in('user_id', idsToDelete);

      if (role === 'mentor') {
        // Disassign mentor from groups
        await supabase
          .from('groups')
          .update({ mentor_id: null })
          .in('mentor_id', idsToDelete);

        // Clear mentor signatures in certificates table
        await supabase
          .from('certificates')
          .update({
            mentor_approved: false,
            mentor_approved_by: null,
            mentor_approved_at: null
          })
          .in('mentor_approved_by', idsToDelete);

        // Clear mentor reference in meetings table
        await supabase
          .from('meetings')
          .update({ mentor_id: null })
          .in('mentor_id', idsToDelete);

        // Clear mentor reviews in reports
        await supabase
          .from('reports')
          .update({
            reviewed_by: null,
            reviewed_at: null,
            feedback: null,
            status: 'submitted'
          })
          .in('reviewed_by', idsToDelete);

        // Clear milestones updated by mentor
        await supabase
          .from('milestones')
          .update({
            updated_by: null
          })
          .in('updated_by', idsToDelete);

        // Clear announcements created by mentor
        await supabase
          .from('announcements')
          .update({
            created_by: null
          })
          .in('created_by', idsToDelete);

      } else if (role === 'student') {
        // Delete student certificates and reports
        await supabase
          .from('certificates')
          .delete()
          .in('student_id', idsToDelete);
        
        await supabase
          .from('reports')
          .delete()
          .in('submitted_by', idsToDelete);
      }

      // Now delete the profiles
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', idsToDelete);
      
      if (error) throw error;

      await fetchDashboardData();
      setSelectedMembers({});
      showNotice(`Successfully deleted ${idsToDelete.length} ${role}(s).`);
    } catch (error) {
      console.error('Delete error details:', error);
      showNotice(`Failed to delete profiles: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const assignMentor = async (groupId, mentorId) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('groups').update({ mentor_id: mentorId || null }).eq('id', groupId);
      if (error) throw error;
      
      // Notify the mentor
      if (mentorId) {
        await supabase.from('notifications').insert({
          user_id: mentorId,
          title: 'New Mentor Assignment',
          content: `You have been assigned to mentor group ${groupId}.`,
          link: '/mentor'
        });
        
        // Notify students in the group
        const groupMembers = students.filter(s => s.group_id === groupId);
        const mentorName = mentors.find(m => m.id === mentorId)?.full_name || 'a Mentor';
        for (const member of groupMembers) {
          await supabase.from('notifications').insert({
            user_id: member.id,
            title: 'Mentor Assigned',
            content: `${mentorName} has been assigned as your group mentor.`,
            link: '/student'
          });
        }
      }

      await fetchDashboardData();
      showNotice('Mentor assignment saved.');
    } catch (error) {
      console.error('Error assigning mentor:', error);
      showNotice(`Could not assign mentor: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const moveStudentGroup = async (studentId, groupId) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ group_id: groupId || null }).eq('id', studentId);
      if (error) throw error;
      
      if (groupId) {
        await supabase.from('notifications').insert({
          user_id: studentId,
          title: 'Group Reassignment',
          content: `You have been moved to group ${groupId}.`,
          link: '/student'
        });
      }
      
      await fetchDashboardData();
      showNotice('Student group reassignment complete.');
    } catch (error) {
      console.error('Error moving student:', error);
      showNotice(`Could not move student: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (groupId) => {
    if (!window.confirm(`Are you sure you want to delete the group "${groupId}"? This will dissolve the group, clear student assignments, and delete all associated meetings, milestones, and reports.`)) return;
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ group_id: null, is_lead: false })
        .eq('group_id', groupId);
      if (profileError) throw profileError;

      const { error: deleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);
      if (deleteError) throw deleteError;

      await fetchDashboardData();
      showNotice(`Successfully deleted group "${groupId}".`);
    } catch (error) {
      console.error(error);
      showNotice(`Failed to delete group: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const makeTeamLead = async (studentId, groupId) => {
    setSaving(true);
    try {
      // 1. Set is_lead = false for everyone in this group (using dummy condition to satisfy update requirements)
      const { error: resetError } = await supabase
        .from('profiles')
        .update({ is_lead: false })
        .eq('group_id', groupId)
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (resetError) throw resetError;

      // 2. Set is_lead = true for this student
      const { error: setLeadError } = await supabase
        .from('profiles')
        .update({ is_lead: true })
        .eq('id', studentId);
      if (setLeadError) throw setLeadError;

      await fetchDashboardData();
      showNotice('Team Lead assigned successfully.');
    } catch (error) {
      console.error(error);
      showNotice(`Failed to assign Team Lead: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };
  const postAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title || !announcementForm.content) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        audience: announcementForm.audience,
        deadline_at: announcementForm.deadline_at || null
      }).select();

      if (error) throw error;

      // Trigger notifications for target audience
      let targets = [];
      if (announcementForm.audience === 'all') {
        targets = [...students, ...mentors];
      } else if (announcementForm.audience === 'student') {
        targets = students;
      } else if (announcementForm.audience === 'mentor') {
        targets = mentors;
      }

      const notifData = targets.map(t => ({
        user_id: t.id,
        title: `Announcement: ${announcementForm.title}`,
        content: announcementForm.content.slice(0, 100) + (announcementForm.content.length > 100 ? '...' : ''),
        link: announcementForm.audience === 'mentor' ? '/mentor' : '/student'
      }));

      if (notifData.length) {
        await supabase.from('notifications').insert(notifData);
      }

      setAnnouncementForm({ title: '', content: '', audience: 'all', deadline_at: '' });
      await fetchDashboardData();
      showNotice('Announcement posted and notifications sent.');
    } catch (error) {
      showNotice(`Failed to post announcement: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      await fetchDashboardData();
      showNotice('Announcement deleted.');
    } catch (error) {
      showNotice(`Failed to delete announcement: ${error.message}`);
    }
  };



  const handleAdminApproveStudent = async (student) => {
    setSaving(true);
    try {
      const activeCertTemplate = templates.find(t => t.type === 'certificate');
      if (!activeCertTemplate) {
        showNotice('No Certificate Format uploaded. Please upload a format of type "Certificate Format" in the Formats tab first.');
        return;
      }
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase.from('certificates').insert({
        recipient_id: student.id,
        recipient_role: 'student',
        student_id: student.id,
        group_id: student.group_id,
        admin_approved: true,
        admin_approved_by: adminId,
        admin_approved_at: new Date().toISOString(),
        mentor_approved: false,
        file_url: activeCertTemplate.file_url
      });
      if (error) throw error;

      // Notify mentor
      const groupObj = groups.find(g => g.id === student.group_id);
      if (groupObj?.mentor_id) {
        await supabase.from('notifications').insert({
          user_id: groupObj.mentor_id,
          title: 'Certificate Approval Required',
          content: `Coordinator has approved completion for ${student.full_name}. Please approve and sign their certificate.`,
          link: '/mentor'
        });
      }

      await fetchDashboardData();
      showNotice(`Approved completion for ${student.full_name}. Awaiting mentor approval.`);
    } catch (error) {
      console.error(error);
      showNotice(`Failed to approve: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkApproveStudentCompletions = async () => {
    const studentIds = Object.keys(selectedStudentCerts).filter(id => selectedStudentCerts[id]);
    if (studentIds.length === 0) {
      showNotice('No students selected.');
      return;
    }
    
    setSaving(true);
    try {
      const activeCertTemplate = templates.find(t => t.type === 'certificate');
      if (!activeCertTemplate) {
        showNotice('No Certificate Format uploaded. Please upload a format of type "Certificate Format" in the Formats tab first.');
        return;
      }
      
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      
      const batchInserts = studentIds.map(id => {
        const student = students.find(s => s.id === id);
        return {
          recipient_id: id,
          recipient_role: 'student',
          student_id: id,
          group_id: student.group_id,
          admin_approved: true,
          admin_approved_by: adminId,
          admin_approved_at: new Date().toISOString(),
          mentor_approved: false,
          file_url: activeCertTemplate.file_url
        };
      });

      const { error } = await supabase.from('certificates').insert(batchInserts);
      if (error) throw error;

      for (const id of studentIds) {
        const student = students.find(s => s.id === id);
        const groupObj = groups.find(g => g.id === student.group_id);
        if (groupObj?.mentor_id) {
          await supabase.from('notifications').insert({
            user_id: groupObj.mentor_id,
            title: 'Certificate Approval Required',
            content: `Coordinator has approved completion for ${student.full_name}. Please approve and sign their certificate.`,
            link: '/mentor'
          });
        }
      }

      await fetchDashboardData();
      setSelectedStudentCerts({});
      showNotice(`Successfully approved completion for ${studentIds.length} students.`);
    } catch (error) {
      console.error(error);
      showNotice(`Failed to batch approve: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleMergeGroups = async (e) => {
    e.preventDefault();
    if (!mergeSource || !mergeTarget) {
      showNotice('Please select both source and target groups.');
      return;
    }
    if (mergeSource === mergeTarget) {
      showNotice('Source and target groups must be different.');
      return;
    }
    if (!window.confirm(`Are you sure you want to merge group "${mergeSource}" into "${mergeTarget}"? This will move all students, milestones, meetings, and reports, and then delete group "${mergeSource}".`)) return;

    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ group_id: mergeTarget })
        .eq('group_id', mergeSource);
      if (profileError) throw profileError;

      const { error: milestoneError } = await supabase
        .from('milestones')
        .update({ group_id: mergeTarget })
        .eq('group_id', mergeSource);
      if (milestoneError) throw milestoneError;

      const { error: meetingError } = await supabase
        .from('meetings')
        .update({ group_id: mergeTarget })
        .eq('group_id', mergeSource);
      if (meetingError) throw meetingError;

      const { error: reportError } = await supabase
        .from('reports')
        .update({ group_id: mergeTarget })
        .eq('group_id', mergeSource);
      if (reportError) throw reportError;

      const { error: deleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', mergeSource);
      if (deleteError) throw deleteError;

      const savedSource = mergeSource;
      setMergeSource('');
      setMergeTarget('');
      await fetchDashboardData();
      showNotice(`Successfully merged group "${savedSource}" into "${mergeTarget}".`);
    } catch (error) {
      console.error(error);
      showNotice(`Failed to merge groups: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleViewMeetingScreenshot = async (filePath) => {
    try {
      const { data, error } = await supabase.storage
        .from('meetings')
        .createSignedUrl(filePath, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error(error);
      showNotice(`Could not load screenshot: ${error.message}`);
    }
  };

  const handleIssueMentorCertificate = async (mentor) => {
    setSaving(true);
    try {
      const activeCertTemplate = templates.find(t => t.type === 'certificate');
      if (!activeCertTemplate) {
        showNotice('No Certificate Format uploaded. Please upload a format of type "Certificate Format" in the Formats tab first.');
        return;
      }
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase.from('certificates').insert({
        recipient_id: mentor.id,
        recipient_role: 'mentor',
        admin_approved: true,
        admin_approved_by: adminId,
        admin_approved_at: new Date().toISOString(),
        mentor_approved: true,
        file_url: activeCertTemplate.file_url
      });
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: mentor.id,
        title: 'Appreciation Certificate Issued!',
        content: 'Your official appreciation certificate has been issued by the Coordinator. View and download it on your dashboard.',
        link: '/mentor'
      });

      await fetchDashboardData();
      showNotice(`Issued certificate to mentor ${mentor.full_name}.`);
    } catch (error) {
      console.error(error);
      showNotice(`Failed to issue certificate: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRevertApproval = async (cert) => {
    if (!window.confirm('Are you sure you want to revert/delete this certificate?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('certificates').delete().eq('id', cert.id);
      if (error) throw error;
      await fetchDashboardData();
      showNotice('Approval reverted successfully.');
    } catch (error) {
      console.error(error);
      showNotice(`Failed to revert: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // CSV Import Helpers
  const readRows = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target.result, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      callback(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
    };
    reader.readAsBinaryString(file);
  };

  const parsePeopleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readRows(file, (rows) => {
      const people = rows.map((row) => {
        const idKey = findColumn(row, ['id', 'authuserid', 'userid', 'uuid']);
        const nameKey = findColumn(row, ['fullname', 'name']);
        const emailKey = findColumn(row, ['email', 'emailaddress']);
        const domainKey = findColumn(row, ['domain']);
        const groupKey = findColumn(row, ['groupid', 'teamid']);
        const capKey = findColumn(row, ['capacity', 'capacitycount', 'mentorcapacity']);
        const sectionKey = findColumn(row, ['section', 'ieeesection']);
        const cityKey = findColumn(row, ['city', 'location']);
        const ieeeKey = findColumn(row, ['ieee', 'ieeemember', 'isieeemember']);
        const yearKey = findColumn(row, ['year', 'graduationyear', 'gradyear']);
        const collegeKey = findColumn(row, ['college', 'collegename', 'university']);
        const designationKey = findColumn(row, ['designation', 'jobtitle', 'role_title']);
        const orgKey = findColumn(row, ['organisation', 'organization', 'company', 'employer']);

        const rawIeee = String(row[ieeeKey] || '').toLowerCase().trim();
        const isIeee = rawIeee === 'true' || rawIeee === 'yes' || rawIeee === '1';

        return {
          id: String(row[idKey] || '').trim(),
          full_name: String(row[nameKey] || '').trim(),
          email: String(row[emailKey] || '').trim().toLowerCase(),
          role: importRole,
          domain: String(row[domainKey] || '').trim() || null,
          mentor_capacity: importRole === 'mentor' ? parseInt(row[capKey]) || 4 : null,
          group_id: importRole === 'student' ? String(row[groupKey] || '').trim() || null : null,
          section: String(row[sectionKey] || '').trim() || null,
          city: String(row[cityKey] || '').trim() || null,
          is_ieee_member: isIeee,
          graduation_year: String(row[yearKey] || '').trim() || null,
          college: String(row[collegeKey] || '').trim() || null,
          designation: String(row[designationKey] || '').trim() || null,
          organisation: String(row[orgKey] || '').trim() || null,
        };
      }).filter((profile) => profile.full_name && profile.email);
      setParsedPeople(people);
      if (!people.length) showNotice('No valid rows found. Include Name and Email columns.');
    });
  };

  const importPeople = async () => {
    if (!parsedPeople?.length) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-provision-users', {
        body: { role: importRole, people: parsedPeople, redirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setParsedPeople(null);
      await fetchDashboardData();
      const failed = data.failed?.length || 0;
      showNotice(`${data.invited} ${importRole}(s) invited. ${data.existing} existing profile(s) skipped.${failed ? ` ${failed} row(s) need attention.` : ''}`);
    } catch (error) {
      console.error('Error importing people:', error);
      showNotice(`Import failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const parseTeamsFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readRows(file, (rows) => {
      let count = 1;
      const teamMap = new Map();
      const memberAssignments = [];
      const mentorMap = new Map();
      const rawGroupsList = [];

      rows.forEach((row) => {
        const keys = Object.keys(row);
        const teamKey = findColumn(row, ['teamid', 'team', 'groupid', 'group', 'teamnumber']);
        const domainKey = findColumn(row, ['domain', 'domainfocus', 'track']);
        const id = String(row[teamKey] || `EMBS-TEAM-${count++}`).trim();
        const domain = String(row[domainKey] || 'General').trim() || 'General';

        teamMap.set(id, { id, domain });

        const mentorNameKey = findColumn(row, ['mentorname', 'mentor']);
        const mentorEmailKey = findColumn(row, ['mentormail', 'mentoremail', 'mentormailid']);
        const mentorName = String(row[mentorNameKey] || '').trim();
        const mentorEmail = String(row[mentorEmailKey] || '').trim().toLowerCase();

        if (mentorName && mentorEmail) {
          mentorMap.set(mentorEmail, {
            full_name: mentorName,
            email: mentorEmail,
            role: 'mentor',
            domain
          });
          rawGroupsList.push({ id, mentorEmail, domain });
        }
        
        // Google Forms exports use headers such as "Name of member 1" and
        // "Mail id of member1". Pair them by the member number, rather than
        // relying on a fixed header order or a maximum number of members.
        const memberColumns = new Map();
        keys.forEach((key) => {
          const header = normalise(key);
          const memberMatch = header.match(/member(\d+)/);
          if (!memberMatch || header.includes('mentor')) return;
          const memberNumber = memberMatch[1];
          const columns = memberColumns.get(memberNumber) || {};
          if (header.includes('email') || header.includes('mail')) columns.emailKey = key;
          else if (header.includes('name')) columns.nameKey = key;
          memberColumns.set(memberNumber, columns);
        });

        for (const { nameKey, emailKey } of memberColumns.values()) {
          if (row[nameKey] && row[emailKey]) {
            memberAssignments.push({
              full_name: String(row[nameKey]).trim(),
              email: String(row[emailKey]).trim().toLowerCase(),
              role: 'student',
              group_id: id
            });
          }
        }
      });
      setParsedTeams({
        groups: [...teamMap.values()],
        members: memberAssignments,
        mentors: [...mentorMap.values()],
        rawGroups: rawGroupsList
      });
      if (!memberAssignments.length) {
        showNotice('No student name/email pairs were found. Check that the sheet includes member name and email columns.');
      }
    });
  };

  const importTeams = async () => {
    if (!parsedTeams) return;
    console.log('Importing teams. parsedTeams payload:', parsedTeams);
    setSaving(true);
    try {
      const uniqueGroups = [];
      const seenGroupIds = new Set();
      for (const g of (parsedTeams.groups || [])) {
        if (!seenGroupIds.has(g.id)) {
          seenGroupIds.add(g.id);
          uniqueGroups.push(g);
        }
      }

      console.log('uniqueGroups list:', uniqueGroups);

      const { error: groupError } = await supabase.from('groups').upsert(uniqueGroups, { onConflict: 'id' });
      if (groupError) throw groupError;

      const uniqueMentors = [];
      const seenMentorEmails = new Set();
      for (const m of (parsedTeams.mentors || [])) {
        const email = m.email.toLowerCase();
        if (!seenMentorEmails.has(email)) {
          seenMentorEmails.add(email);
          uniqueMentors.push(m);
        }
      }

      console.log('uniqueMentors list:', uniqueMentors);

      let mentorsInvited = 0;
      let mentorsExisting = 0;
      let mentorsFailed = 0;
      let mentorFailureReason = '';
      if (uniqueMentors.length) {
        const { data: mentorRes, error: mentorErr } = await supabase.functions.invoke('bulk-provision-users', {
          body: { role: 'mentor', people: uniqueMentors, redirectTo: window.location.origin }
        });
        if (mentorErr) throw mentorErr;
        if (mentorRes?.error) throw new Error(mentorRes.error);
        mentorsInvited = mentorRes.invited || 0;
        mentorsExisting = mentorRes.existing || 0;
        mentorsFailed = mentorRes.failed?.length || 0;
        mentorFailureReason = mentorRes.failed?.[0]?.reason || '';
        if (mentorRes.failed?.length) {
          console.warn('Failed mentors:', mentorRes.failed);
        }
      }

      const uniqueMembers = [];
      const seenMemberEmails = new Set();
      for (const m of (parsedTeams.members || [])) {
        const email = m.email.toLowerCase();
        if (!seenMemberEmails.has(email)) {
          seenMemberEmails.add(email);
          uniqueMembers.push(m);
        }
      }

      console.log('uniqueMembers list:', uniqueMembers);

      let studentsInvited = 0;
      let studentsExisting = 0;
      let studentsFailed = 0;
      let studentFailureReason = '';
      if (uniqueMembers.length) {
        const { data: studentRes, error: studentErr } = await supabase.functions.invoke('bulk-provision-users', {
          body: { role: 'student', people: uniqueMembers, redirectTo: window.location.origin }
        });
        if (studentErr) throw studentErr;
        if (studentRes?.error) throw new Error(studentRes.error);
        studentsInvited = studentRes.invited || 0;
        studentsExisting = studentRes.existing || 0;
        studentsFailed = studentRes.failed?.length || 0;
        studentFailureReason = studentRes.failed?.[0]?.reason || '';
        if (studentRes.failed?.length) {
          console.warn('Failed students:', studentRes.failed);
        }
      }

      const { data: allMentors, error: fetchMentorsError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'mentor');
      if (fetchMentorsError) throw fetchMentorsError;

      const mentorEmailToId = new Map(allMentors.map(m => [m.email.toLowerCase(), m.id]));

      const seenGroupUpdateIds = new Set();
      const groupUpdates = [];
      for (const g of (parsedTeams.rawGroups || [])) {
        if (!seenGroupUpdateIds.has(g.id)) {
          seenGroupUpdateIds.add(g.id);
          const mId = mentorEmailToId.get(g.mentorEmail.toLowerCase());
          groupUpdates.push({
            id: g.id,
            mentor_id: mId || null,
            domain: g.domain
          });
        }
      }

      console.log('groupUpdates list:', groupUpdates);

      if (groupUpdates.length) {
        const { error: groupMentorError } = await supabase
          .from('groups').upsert(groupUpdates, { onConflict: 'id' });
        if (groupMentorError) throw groupMentorError;
      }

      setParsedTeams(null);
      await fetchDashboardData();
      showNotice(
        `Team import successful! ` +
        `Created ${uniqueGroups.length} groups. ` +
        `Mentors: ${mentorsInvited} invited, ${mentorsExisting} matched${mentorsFailed ? `, ${mentorsFailed} failed (${mentorFailureReason})` : ''}. ` +
        `Students: ${studentsInvited} invited, ${studentsExisting} linked/matched${studentsFailed ? `, ${studentsFailed} failed (${studentFailureReason})` : ''}.`
      );
    } catch (error) {
      console.error('Error importing teams:', error);
      showNotice(`Team import failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetAllGroupsData = async () => {
    if (!window.confirm("Are you sure you want to delete all groups, meetings, reports, milestones, and certificates? This action cannot be undone.")) return;
    setSaving(true);
    try {
      const { error: certError } = await supabase
        .from('certificates')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (certError) throw certError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ group_id: null, is_lead: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (profileError) throw profileError;

      const { error: groupError } = await supabase
        .from('groups')
        .delete()
        .neq('id', '_dummy_group_id_');
      if (groupError) throw groupError;

      await fetchDashboardData();
      showNotice("All groups and related logs cleared successfully!");
    } catch (error) {
      console.error(error);
      showNotice(`Failed to reset data: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };



  // Suggestions for Group Mentor Assignment
  const getSuggestedMentors = (groupDomain) => {
    return mentors
      .map(m => {
        const assignedCount = groups.filter(g => g.mentor_id === m.id).length;
        const capacity = m.mentor_capacity || 4;
        const mentorDomains = m.domain ? m.domain.split(',').map(d => d.trim()) : [];
        const isMatch = mentorDomains.some(d => normalise(d).includes(normalise(groupDomain)) || normalise(groupDomain).includes(normalise(d)));
        return { ...m, assignedCount, capacity, isMatch, score: (isMatch ? 10 : 0) + (capacity - assignedCount) };
      })
      .filter(m => m.assignedCount < m.capacity)
      .sort((a, b) => b.score - a.score);
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading dashboard…</div>;

  // Search & Filter Logic
  const filteredReports = reports.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.submitter.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.group_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? r.status === statusFilter : true;
    const matchesDomain = domainFilter ? groups.find(g => g.id === r.group_id)?.domain === domainFilter : true;
    const matchesWeek = weekFilter ? String(r.week_number) === weekFilter : true;
    return matchesSearch && matchesStatus && matchesDomain && matchesWeek;
  });

  const domains = [...new Set(groups.map(g => g.domain).filter(Boolean))];
  const unassignedStudents = students.filter(s => !s.group_id);
  const unassignedGroupsCount = groups.filter(g => !g.mentor_id).length;

  return (
    <div style={{ padding: '2rem 0' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>IEEE EMBS Admin Portal</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Pune Chapter Internship Coordinator Hub</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('analytics')}><BarChart3 size={16} /> Analytics</button>
          <button className={`btn ${activeTab === 'teams' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('teams')}><Users size={16} /> Teams</button>
          <button className={`btn ${activeTab === 'announcements' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('announcements')}><Bell size={16} /> Announcements</button>
          <button className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('reports')}><FileText size={16} /> Reports</button>
          <button className={`btn ${activeTab === 'certificates' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('certificates')}><Award size={16} /> Certificates</button>
           <button className={`btn ${activeTab === 'templates' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('templates')}><FileSpreadsheet size={16} /> Formats</button>
          <button className={`btn ${activeTab === 'meetings' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('meetings')}><BookOpen size={16} /> Meetings</button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '1rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)', background: 'var(--info-light)', color: 'var(--info)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          {notice}
        </div>
      )}

      {/* RENDER ACTIVE TAB */}

      {activeTab === 'analytics' && (
        <div className="animate-fade-in">
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Students</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '2rem' }}>{students.length}</strong>
                <Users size={24} style={{ color: 'var(--ieee-blue)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--error)', fontWeight: 600 }}>{unassignedStudents.length} unassigned</span>
            </div>
            
            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Mentors</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '2rem' }}>{mentors.length}</strong>
                <Users size={24} style={{ color: 'var(--ieee-purple)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                Avg Cap: {(mentors.reduce((acc, m) => acc + (m.mentor_capacity || 4), 0) / (mentors.length || 1)).toFixed(1)} grps
              </span>
            </div>

            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Groups</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '2rem' }}>{groups.length}</strong>
                <Settings size={24} style={{ color: 'var(--ieee-dark-blue)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: unassignedGroupsCount > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                {unassignedGroupsCount} missing mentor
              </span>
            </div>

            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pending Reports</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '2rem' }}>{reports.filter(r => r.status === 'submitted' || r.status === 'in_review').length}</strong>
                <FileText size={24} style={{ color: 'var(--warning)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Out of {reports.length} total reports</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Custom SVG Chart: Report Statuses */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.15rem' }}>Report Review Progress</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['approved', 'submitted', 'in_review', 'changes_requested'].map(status => {
                  const count = reports.filter(r => (r.status || 'submitted') === status).length;
                  const pct = reports.length ? (count / reports.length) * 100 : 0;
                  const label = status.replace('_', ' ').toUpperCase();
                  const barColor = status === 'approved' ? 'var(--success)' : status === 'submitted' ? 'var(--info)' : status === 'in_review' ? 'var(--warning)' : 'var(--error)';
                  return (
                    <div key={status} className="chart-bar-group">
                      <div className="chart-bar-label">{label} ({count})</div>
                      <div className="chart-bar-wrapper">
                        <div className="chart-bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor, background: 'none' }}>
                          {count > 0 && `${pct.toFixed(0)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom SVG Chart: Domain Distribution */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.15rem' }}>Group Domain Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '250px', overflowY: 'auto' }}>
                {domains.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No domains available</p> : 
                  domains.map(domain => {
                    const count = groups.filter(g => g.domain === domain).length;
                    const maxCount = Math.max(...domains.map(d => groups.filter(g => g.domain === d).length), 1);
                    const pct = (count / maxCount) * 100;
                    return (
                      <div key={domain} className="chart-bar-group">
                        <div className="chart-bar-label">{domain} ({count})</div>
                        <div className="chart-bar-wrapper">
                          <div className="chart-bar-fill" style={{ width: `${pct}%` }}>
                            {count > 0 && count}
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
          
          {/* Quick Group Assign / Manual Register */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ marginBottom: '1rem' }}><UserPlus size={18} /> Add Mentor / Student</h3>
            <form onSubmit={savePerson} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Auth UUID (optional)</label>
                <input placeholder="Auto-generated if empty" value={person.id} onChange={(e) => setPerson({ ...person, id: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                <input required placeholder="Full Name" value={person.full_name} onChange={(e) => setPerson({ ...person, full_name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
                <input required type="email" placeholder="Email" value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role</label>
                <select value={person.role} onChange={(e) => setPerson({ ...person, role: e.target.value })}>
                  <option value="mentor">Mentor</option>
                  <option value="student">Student</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {person.role === 'mentor' ? 'Guided Domains (comma separated)' : 'Domain / Problem Statement'}
                </label>
                <input 
                  placeholder={person.role === 'mentor' ? "E.g. AI, Robotics, IoT" : "E.g. Robotics"} 
                  value={person.domain} 
                  onChange={(e) => setPerson({ ...person, domain: e.target.value })} 
                />
              </div>
              {person.role === 'mentor' && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mentor Capacity</label>
                  <input type="number" min="1" max="10" value={person.mentor_capacity} onChange={(e) => setPerson({ ...person, mentor_capacity: e.target.value })} />
                </div>
              )}
              {person.role === 'student' && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Group ID (optional)</label>
                  <input placeholder="Group ID" value={person.group_id} onChange={(e) => setPerson({ ...person, group_id: e.target.value })} />
                </div>
              )}
              <button className="btn btn-primary" disabled={saving} style={{ height: '40px' }}><Plus size={16} /> Save Member</button>
            </form>
          </div>

          {/* Import Sheets Section & Group Merge */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3><FileSpreadsheet size={18} /> Import Members via Spreadsheet</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem' }}>CSV/Excel columns: <strong>Name</strong> and <strong>Email Address</strong>. Optional: <strong>Domain</strong> and <strong>Group ID</strong>.</p>
              {!parsedPeople ? (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <select style={{ width: 'auto' }} value={importRole} onChange={(e) => setImportRole(e.target.value)}>
                    <option value="mentor">Import as Mentors</option>
                    <option value="student">Import as Students</option>
                  </select>
                  <input ref={peopleInputRef} type="file" accept={fileTypes} onChange={parsePeopleFile} style={{ display: 'none' }} />
                  <button className="btn btn-secondary" onClick={() => peopleInputRef.current?.click()}><Upload size={16} /> Select Spreadsheet</button>
                </div>
              ) : (
                <ImportPreview count={parsedPeople.length} onCancel={() => setParsedPeople(null)} onConfirm={importPeople} saving={saving} />
              )}
            </div>

            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3><FileSpreadsheet size={18} /> Import Teams (Google Form responses)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem' }}>Extracts groups and links registered student profiles matching emails.</p>
              {!parsedTeams ? (
                <>
                  <input ref={teamsInputRef} type="file" accept={fileTypes} onChange={parseTeamsFile} style={{ display: 'none' }} />
                  <button className="btn btn-secondary" onClick={() => teamsInputRef.current?.click()}><Upload size={16} /> Select Team Sheet</button>
                </>
              ) : (
                <ImportPreview
                  count={parsedTeams.groups.length}
                  label="groups"
                  detail={`${parsedTeams.members.length} students and ${parsedTeams.mentors.length} mentors detected.`}
                  onCancel={() => setParsedTeams(null)}
                  onConfirm={importTeams}
                  saving={saving}
                />
              )}
            </div>

            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3><Users size={18} style={{ color: 'var(--ieee-blue)' }} /> Merge Internship Groups</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem' }}>Merge all students, milestones, meetings, and reports of a source group into a target group.</p>
              <form onSubmit={handleMergeGroups} style={{ display: 'grid', gap: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Source Group</label>
                    <select required value={mergeSource} onChange={(e) => setMergeSource(e.target.value)} style={{ padding: '0.35rem' }}>
                      <option value="">Select Source</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Group</label>
                    <select required value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} style={{ padding: '0.35rem' }}>
                      <option value="">Select Target</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.id}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={saving}>
                  {saving ? 'Merging...' : 'Merge Groups'}
                </button>
              </form>
            </div>

            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderColor: 'var(--error)' }}>
              <h3><AlertTriangle size={18} style={{ color: 'var(--error)' }} /> Reset Portal Groups</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem' }}>Delete all groups, meetings, milestones, reports, and certificates. (For Excel re-testing).</p>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                onClick={resetAllGroupsData}
                disabled={saving}
              >
                {saving ? 'Resetting...' : 'Delete All Groups'}
              </button>
            </div>
          </div>

          {/* Unassigned Students Alert List */}
          {unassignedStudents.length > 0 && (
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderColor: 'var(--error)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)' }}>
                <AlertTriangle size={20} /> Unassigned Students ({unassignedStudents.length})
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>These students are not currently assigned to any group.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {unassignedStudents.map(student => (
                  <div key={student.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{student.full_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{student.email}</div>
                      {student.domain && <div style={{ fontSize: '0.75rem', color: 'var(--ieee-blue)', fontWeight: 600 }}>Interest: {student.domain}</div>}
                    </div>
                    <select 
                      defaultValue=""
                      onChange={(e) => moveStudentGroup(student.id, e.target.value)}
                      style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                    >
                      <option value="" disabled>Assign to group...</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.id} ({g.domain})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group and Mentor Assignment Table */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Current Internship Groups ({groups.length})</h3>
            <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
              {groups.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No groups imported yet.</p> : 
                groups.map(group => {
                  const suggestions = getSuggestedMentors(group.domain);
                  return (
                    <div 
                      key={group.id} 
                      style={{ 
                        padding: '1.25rem', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-md)', 
                        display: 'grid', 
                        gridTemplateColumns: '1.5fr 1.5fr 1.5fr', 
                        gap: '1rem', 
                        alignItems: 'start',
                        borderColor: !group.mentor_id ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)',
                        backgroundColor: !group.mentor_id ? 'var(--error-light)' : 'transparent'
                      }}
                    >
                      {/* Group Basics */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ color: 'var(--ieee-dark-blue)', fontSize: '1.1rem' }}>{group.id}</strong>
                            {!group.mentor_id && <span className="badge badge-error">Needs Mentor</span>}
                          </div>
                          <button
                            type="button"
                            style={{ border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => deleteGroup(group.id)}
                            title="Delete Group"
                            disabled={saving}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ieee-blue)' }}>Domain: {group.domain}</span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          <strong>Members ({group.members.length}):</strong>
                          <ul style={{ paddingLeft: '1rem', marginTop: '0.2rem' }}>
                             {group.members.map(m => (
                               <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                 <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                   {m.full_name}
                                   {m.is_lead && <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.7rem' }} title="Team Lead">👑 Lead</span>}
                                 </span>
                                 <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                   {!m.is_lead && (
                                     <button 
                                       type="button" 
                                       onClick={() => makeTeamLead(m.id, group.id)}
                                       style={{ border: 'none', background: 'transparent', color: 'var(--ieee-blue)', cursor: 'pointer', fontSize: '0.65rem', textDecoration: 'underline', padding: 0 }}
                                     >
                                       Set Lead
                                     </button>
                                   )}
                                   <select 
                                     value={group.id} 
                                     onChange={(e) => moveStudentGroup(m.id, e.target.value)}
                                     style={{ padding: '0.1rem', fontSize: '0.7rem', width: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ieee-purple)', fontWeight: 600 }}
                                   >
                                     {groups.map(g => <option key={g.id} value={g.id}>Move to {g.id}</option>)}
                                     <option value="">Remove from group</option>
                                   </select>
                                 </div>
                               </li>
                             ))}
                          </ul>
                        </div>
                      </div>

                      {/* Mentor Selection */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Assigned Mentor</label>
                        <select 
                          value={group.mentor_id || ''} 
                          disabled={saving} 
                          onChange={(e) => assignMentor(group.id, e.target.value)}
                          style={{ marginTop: '0.3rem' }}
                        >
                          <option value="">No mentor assigned</option>
                          {mentors.map((mentor) => {
                            const assignedCount = groups.filter(g => g.mentor_id === mentor.id).length;
                            return (
                              <option key={mentor.id} value={mentor.id}>
                                {mentor.full_name} ({assignedCount}/{mentor.mentor_capacity || 4})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Suggestions list */}
                      {!group.mentor_id ? (
                        <div style={{ background: 'white', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid #fed7d7' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--error)', display: 'block', marginBottom: '0.3rem' }}>Suggested Mentors:</span>
                          {suggestions.slice(0, 3).map(mentor => (
                            <div key={mentor.id} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                              <span>{mentor.full_name} ({mentor.assignedCount}/{mentor.capacity})</span>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}
                                onClick={() => assignMentor(group.id, mentor.id)}
                              >
                                Assign
                              </button>
                            </div>
                          ))}
                          {suggestions.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No matching mentors available</span>}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <strong>Mentor Details:</strong>
                          <div>Specialty: {group.mentor?.domain || 'General'}</div>
                          <div>Email: {group.mentor?.email}</div>
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </div>
          </div>

          {/* Teams Progress Tracker */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} style={{ color: 'var(--ieee-blue)' }} /> Group Progress Tracker
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Track milestone roadmap completions, active mentor guidance, and percentage progress for all teams.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {groups.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No groups imported yet.</p>
              ) : (
                groups.map(group => {
                  const mentor = mentors.find(m => m.id === group.mentor_id);
                  const mentorName = mentor ? mentor.full_name : 'No Mentor Assigned';
                  
                  const groupMilestones = milestonesData.filter(m => m.group_id === group.id);
                  const totalMilestones = groupMilestones.length;
                  const approvedMilestones = groupMilestones.filter(m => m.status === 'approved').length;
                  const percentage = totalMilestones > 0 ? Math.round((approvedMilestones / totalMilestones) * 100) : 0;
                  
                  return (
                    <div key={group.id} style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--ieee-dark-blue)' }}>{group.id}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>{group.domain}</span>
                        </div>
                        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{percentage}% Done</span>
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>Assigned Mentor:</strong> <span style={{ color: 'var(--ieee-blue)', fontWeight: 600 }}>{mentorName}</span>
                      </div>
                      
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          <span>Milestones: {approvedMilestones} of {totalMilestones} Approved</span>
                          <span style={{ fontWeight: 600 }}>{percentage}%</span>
                        </div>
                        <div className="progress-container" style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--ieee-gradient)', borderRadius: '4px' }}></div>
                        </div>
                      </div>

                      {totalMilestones > 0 ? (
                        <details style={{ fontSize: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--ieee-purple)', fontWeight: 600 }}>Show Roadmap Milestones ({totalMilestones})</summary>
                          <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                            {groupMilestones.map((m, idx) => (
                              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem', background: '#f8fafc', borderRadius: '4px' }}>
                                <span>{idx + 1}. {m.title}</span>
                                <span className={`badge ${m.status === 'approved' ? 'badge-success' : m.status === 'submitted' ? 'badge-info' : m.status === 'in_progress' ? 'badge-warning' : 'badge-error'}`} style={{ fontSize: '0.6rem', padding: '0.05rem 0.25rem' }}>
                                  {m.status.replace('_', ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No milestones set by mentor yet.</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Manage Profiles Section */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3>Manage Registered Members</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Search, details preview, and profile removal singly or in bulk.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-primary)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <button 
                  className="btn" 
                  type="button"
                  style={{ 
                    padding: '0.35rem 0.75rem', 
                    fontSize: '0.75rem', 
                    background: manageRole === 'student' ? 'var(--ieee-blue)' : 'transparent',
                    color: manageRole === 'student' ? 'white' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)'
                  }} 
                  onClick={() => { setManageRole('student'); setSelectedMembers({}); }}
                >
                  Students ({students.length})
                </button>
                <button 
                  className="btn" 
                  type="button"
                  style={{ 
                    padding: '0.35rem 0.75rem', 
                    fontSize: '0.75rem', 
                    background: manageRole === 'mentor' ? 'var(--ieee-blue)' : 'transparent',
                    color: manageRole === 'mentor' ? 'white' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)'
                  }} 
                  onClick={() => { setManageRole('mentor'); setSelectedMembers({}); }}
                >
                  Mentors ({mentors.length})
                </button>
              </div>
            </div>

            {/* Filter and Bulk Actions Bar */}
            {(() => {
              const combinedProfiles = [...students, ...mentors];
              const allSections = [...new Set(combinedProfiles.map(p => p.section).filter(Boolean))];
              const allCities = [...new Set(combinedProfiles.map(p => p.city).filter(Boolean))];
              const allYears = [...new Set(combinedProfiles.map(p => p.graduation_year).filter(Boolean))];
              const allColleges = [...new Set(combinedProfiles.map(p => p.college).filter(Boolean))];
              const allOrgs = [...new Set(combinedProfiles.map(p => p.organisation).filter(Boolean))];
              const allDesignations = [...new Set(combinedProfiles.map(p => p.designation).filter(Boolean))];
              const allDomainsList = [...new Set(combinedProfiles.map(p => p.domain).filter(Boolean))];

              const list = manageRole === 'student' ? students : mentors;
              const filteredList = list.filter(m => {
                const matchesSearch = normalise(m.full_name).includes(normalise(managementSearch)) || 
                                      normalise(m.email).includes(normalise(managementSearch)) ||
                                      (m.domain && normalise(m.domain).includes(normalise(managementSearch)));
                const matchesSection = mgmtSectionFilter ? m.section === mgmtSectionFilter : true;
                const matchesCity = mgmtCityFilter ? m.city === mgmtCityFilter : true;
                const matchesIeee = mgmtIeeeFilter ? String(m.is_ieee_member) === mgmtIeeeFilter : true;
                const matchesYear = mgmtYearFilter ? m.graduation_year === mgmtYearFilter : true;
                const matchesDomain = mgmtDomainFilter ? m.domain === mgmtDomainFilter : true;
                const matchesCollege = mgmtCollegeFilter ? m.college === mgmtCollegeFilter : true;
                const matchesOrg = mgmtOrgFilter ? m.organisation === mgmtOrgFilter : true;
                const matchesDesignation = mgmtDesignationFilter ? m.designation === mgmtDesignationFilter : true;
                return matchesSearch && matchesSection && matchesCity && matchesIeee && matchesYear && matchesDomain && matchesCollege && matchesOrg && matchesDesignation;
              });
              
              const selectedCount = Object.keys(selectedMembers).filter(id => selectedMembers[id]).length;
              const isAllSelected = filteredList.length > 0 && filteredList.every(m => selectedMembers[m.id]);

              return (
                <div>
                  <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', marginBottom: '1.5rem', background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <input 
                        placeholder={`Search ${manageRole}s by name, email, or domain...`}
                        value={managementSearch}
                        onChange={(e) => setManagementSearch(e.target.value)}
                        style={{ maxWidth: '350px', flex: 1 }}
                      />
                      
                      {filteredList.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                            <input 
                              type="checkbox" 
                              checked={isAllSelected}
                              onChange={(e) => {
                                const nextSelected = {};
                                if (e.target.checked) {
                                  filteredList.forEach(m => {
                                    nextSelected[m.id] = true;
                                  });
                                }
                                setSelectedMembers(nextSelected);
                              }}
                              style={{ width: 'auto' }}
                            />
                            Select All
                          </label>
                          {selectedCount > 0 && (
                            <button 
                              className="btn btn-outline" 
                              type="button"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                              onClick={() => {
                                const ids = Object.keys(selectedMembers).filter(id => selectedMembers[id]);
                                deleteProfiles(ids, manageRole);
                              }}
                              disabled={saving}
                            >
                              <Trash2 size={12} style={{ marginRight: '0.35rem' }} /> Delete Selected ({selectedCount})
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Advanced Filters Panel */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Section</label>
                        <select value={mgmtSectionFilter} onChange={(e) => setMgmtSectionFilter(e.target.value)} style={{ padding: '0.35rem', fontSize: '0.75rem' }}>
                          <option value="">All Sections</option>
                          {allSections.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>City</label>
                        <select value={mgmtCityFilter} onChange={(e) => setMgmtCityFilter(e.target.value)} style={{ padding: '0.35rem', fontSize: '0.75rem' }}>
                          <option value="">All Cities</option>
                          {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>IEEE Member</label>
                        <select value={mgmtIeeeFilter} onChange={(e) => setMgmtIeeeFilter(e.target.value)} style={{ padding: '0.35rem', fontSize: '0.75rem' }}>
                          <option value="">All</option>
                          <option value="true">IEEE Member</option>
                          <option value="false">Non-Member</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Graduation Year</label>
                        <select value={mgmtYearFilter} onChange={(e) => setMgmtYearFilter(e.target.value)} style={{ padding: '0.35rem', fontSize: '0.75rem' }}>
                          <option value="">All Years</option>
                          {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Domain Focus</label>
                        <select value={mgmtDomainFilter} onChange={(e) => setMgmtDomainFilter(e.target.value)} style={{ padding: '0.35rem', fontSize: '0.75rem' }}>
                          <option value="">All Domains</option>
                          {allDomainsList.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>College Name</label>
                        <select value={mgmtCollegeFilter} onChange={(e) => setMgmtCollegeFilter(e.target.value)} style={{ padding: '0.35rem', fontSize: '0.75rem' }}>
                          <option value="">All Colleges</option>
                          {allColleges.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Organization</label>
                        <select value={mgmtOrgFilter} onChange={(e) => setMgmtOrgFilter(e.target.value)} style={{ padding: '0.35rem', fontSize: '0.75rem' }}>
                          <option value="">All Organizations</option>
                          {allOrgs.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Designation</label>
                        <select value={mgmtDesignationFilter} onChange={(e) => setMgmtDesignationFilter(e.target.value)} style={{ padding: '0.35rem', fontSize: '0.75rem' }}>
                          <option value="">All Designations</option>
                          {allDesignations.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Members Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', padding: '0.25rem' }}>
                    {filteredList.map(item => {
                      return (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '0.75rem', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                            <input 
                              type="checkbox" 
                              checked={!!selectedMembers[item.id]}
                              onChange={(e) => setSelectedMembers({ ...selectedMembers, [item.id]: e.target.checked })}
                              style={{ width: 'auto', marginTop: '0.2rem', cursor: 'pointer' }}
                            />
                            <div>
                              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.full_name}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.email}</div>
                              {item.domain && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                                  {item.domain.split(',').map((d, i) => (
                                    <span key={i} className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                                      {d.trim()}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {manageRole === 'student' ? (
                                <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                                  Group: <span className="badge" style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem' }}>{item.group_id || 'Unassigned'}</span>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                                  Capacity: <strong>{groups.filter(g => g.mentor_id === item.id).length}/{item.mentor_capacity || 4}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <button 
                            className="btn btn-outline" 
                            type="button"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                            onClick={() => deleteProfiles([item.id], manageRole)}
                            disabled={saving}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      );
                    })}
                    {filteredList.length === 0 && (
                      <p style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                        No profiles found matching search filters.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Post announcement form */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Post Notice & Deadlines</h3>
            <form onSubmit={postAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Title</label>
                <input required placeholder="Notice Title (e.g. Mid-Review Deadline)" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Content</label>
                <textarea required placeholder="Instructions, details, or meeting links..." value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Audience</label>
                <select value={announcementForm.audience} onChange={(e) => setAnnouncementForm({ ...announcementForm, audience: e.target.value })}>
                  <option value="all">Everyone</option>
                  <option value="student">Students Only</option>
                  <option value="mentor">Mentors Only</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Deadline (optional)</label>
                <input type="datetime-local" value={announcementForm.deadline_at} onChange={(e) => setAnnouncementForm({ ...announcementForm, deadline_at: e.target.value })} />
              </div>
              <button className="btn btn-primary" disabled={saving}><Plus size={16} /> Publish Announcement</button>
            </form>
          </div>

          {/* List existing announcements */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Published Announcements</h3>
            <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {announcements.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No announcements posted yet.</p> :
                announcements.map(ann => (
                  <article key={ann.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                      <div>
                        <h4 style={{ color: 'var(--ieee-blue)', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          {ann.title}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          <span className={`badge ${ann.audience === 'all' ? 'badge-info' : ann.audience === 'student' ? 'badge-success' : 'badge-warning'}`}>
                            {ann.audience}
                          </span>
                          {ann.deadline_at && (
                            <span className="badge badge-error">
                              Due: {new Date(ann.deadline_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--error)' }} onClick={() => deleteAnnouncement(ann.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', whiteSpace: 'pre-line' }}>{ann.content}</p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
                      Posted: {new Date(ann.created_at).toLocaleString()}
                    </span>
                  </article>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Filters Bar */}
          <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'white' }}>
              <Search size={18} style={{ color: 'var(--text-secondary)' }} />
              <input 
                placeholder="Search by title, student, or team..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', padding: 0 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.5rem', width: 'auto' }}>
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="in_review">In Review</option>
                <option value="approved">Approved</option>
                <option value="changes_requested">Changes Requested</option>
              </select>
              <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} style={{ padding: '0.5rem', width: 'auto' }}>
                <option value="">All Domains</option>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} style={{ padding: '0.5rem', width: 'auto' }}>
                <option value="">All Weeks</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i+1} value={i+1}>Week {i+1}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reports Grid */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Submitted Progress Reports ({filteredReports.length})</h3>
            <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
              {filteredReports.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No reports match the criteria.</p> :
                filteredReports.map(report => {
                  const isLate = report.due_date && new Date(report.created_at) > new Date(report.due_date);
                  return (
                    <article key={report.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ color: 'var(--ieee-blue)', fontSize: '1.05rem' }}>{report.title}</strong>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem', alignItems: 'center' }}>
                            {report.week_number && <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.05rem 0.25rem' }}>Week {report.week_number}</span>}
                            <span className="badge badge-info">{report.group_id}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              submitted by {report.submitter} on {new Date(report.created_at).toLocaleString()}
                            </span>
                            {isLate && <span className="badge badge-error">Late Submission</span>}
                            <span className="badge badge-info">v{report.version}</span>
                          </div>
                        </div>
                        <span className={`badge ${report.status === 'approved' ? 'badge-success' : report.status === 'changes_requested' ? 'badge-error' : report.status === 'in_review' ? 'badge-warning' : 'badge-info'}`}>
                          {(report.status || 'submitted').replace('_', ' ')}
                        </span>
                      </div>
                      
                      {report.content && (
                        <p style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                          {report.content}
                        </p>
                      )}

                      {report.feedback && (
                        <p style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--info-light)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--ieee-dark-blue)' }}>
                          <strong>Reviewer feedback ({report.reviewer || 'Mentor'}):</strong> {report.feedback}
                        </p>
                      )}
                    </article>
                  );
                })
              }
            </div>
          </div>
        </div>
      )}

      {activeTab === 'certificates' && (() => {
        const activeCertTemplate = templates.find(t => t.type === 'certificate');

        return (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: '1.5rem', flexWrap: 'wrap' }}>
            
            {/* Left Column: Template Status & Mentor Certificates */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Template Background Card */}
              <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Certificate Template Format</h4>
                {activeCertTemplate ? (
                  <div style={{ marginTop: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>✓ Certificate Format Active</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Name: {activeCertTemplate.name}</div>
                    <a href={activeCertTemplate.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.7rem', color: 'var(--ieee-blue)', display: 'inline-block', marginTop: '0.5rem', fontWeight: 500 }}>
                      View Background File →
                    </a>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--error)', fontWeight: 600 }}>⚠ Missing Certificate Format</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                      Please upload a template of type <strong>"Certificate Format"</strong> in the <strong>Formats</strong> tab first before issuing any certificates.
                    </p>
                  </div>
                )}
              </div>

              {/* Mentor Appreciation Certificates */}
              <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <h3>Mentor Certificates</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Issue appreciation certificates directly to active mentors.</p>
                
                <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {mentors.map(mentor => {
                    const cert = certificates.find(c => c.recipient_id === mentor.id && c.recipient_role === 'mentor');
                    return (
                      <div key={mentor.id} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{mentor.full_name}</strong>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{mentor.email}</div>
                        </div>
                        <div>
                          {cert ? (
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                onClick={() => setCertPreview(cert)}
                              >
                                Preview
                              </button>
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '0.25rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                                onClick={() => handleRevertApproval(cert)}
                                disabled={saving}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem' }}
                              disabled={saving || !activeCertTemplate}
                              onClick={() => handleIssueMentorCertificate(mentor)}
                            >
                              Issue
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {mentors.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No mentors registered yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Intern / Student Completion Approvals */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3>Internship Completion & Certificate Approvals</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Approve student completion. Once approved, the assigned group mentor must sign and complete the certificate.
              </p>
              
              {/* Select All & Bulk Action Bar */}
              {students.filter(s => s.group_id && !certificates.some(c => c.recipient_id === s.id && c.admin_approved)).length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={
                        students.filter(s => s.group_id && !certificates.some(c => c.recipient_id === s.id && c.admin_approved))
                          .every(s => selectedStudentCerts[s.id])
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const pendingStudents = students.filter(s => s.group_id && !certificates.some(c => c.recipient_id === s.id && c.admin_approved));
                        const nextSelected = { ...selectedStudentCerts };
                        pendingStudents.forEach(s => {
                          nextSelected[s.id] = checked;
                        });
                        setSelectedStudentCerts(nextSelected);
                      }}
                    />
                    Select All Pending ({students.filter(s => s.group_id && !certificates.some(c => c.recipient_id === s.id && c.admin_approved)).length})
                  </label>
                  
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={handleBulkApproveStudentCompletions}
                    disabled={saving || !activeCertTemplate || Object.keys(selectedStudentCerts).filter(id => selectedStudentCerts[id]).length === 0}
                  >
                    Approve Selected ({Object.keys(selectedStudentCerts).filter(id => selectedStudentCerts[id]).length})
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gap: '1rem', maxHeight: '580px', overflowY: 'auto' }}>
                {students.filter(s => s.group_id).map(student => {
                  const cert = certificates.find(c => c.recipient_id === student.id && c.recipient_role === 'student');
                  const isAdminApproved = cert && cert.admin_approved;
                  const isMentorApproved = cert && cert.mentor_approved;
                  
                  return (
                    <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {!isAdminApproved && (
                          <input 
                            type="checkbox"
                            checked={!!selectedStudentCerts[student.id]}
                            onChange={(e) => {
                              setSelectedStudentCerts(prev => ({
                                ...prev,
                                [student.id]: e.target.checked
                              }));
                            }}
                          />
                        )}
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{student.full_name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Group: <strong>{student.group_id}</strong></div>
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                            <span className={`badge ${isAdminApproved ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                              Admin: {isAdminApproved ? 'Approved' : 'Pending'}
                            </span>
                            <span className={`badge ${isMentorApproved ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                              Mentor: {isMentorApproved ? 'Approved' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {isAdminApproved ? (
                          <>
                            {isMentorApproved && (
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                onClick={() => setCertPreview(cert)}
                              >
                                View Preview
                              </button>
                            )}
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                              onClick={() => handleRevertApproval(cert)}
                              disabled={saving}
                            >
                              Revert Approval
                            </button>
                          </>
                        ) : (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                            disabled={saving || !activeCertTemplate}
                            onClick={() => handleAdminApproveStudent(student)}
                          >
                            Approve Completion
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {students.filter(s => s.group_id).length === 0 && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No active interns in groups found.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {activeTab === 'templates' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Upload Format Form */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Upload Resource Format</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Upload templates for reports, presentations, and certificates that students and mentors can download.</p>
            
            <form onSubmit={handleUploadTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Format Title / Name</label>
                <input 
                  required 
                  placeholder="e.g. Project Proposal Format" 
                  value={newTemplate.name} 
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Resource Type</label>
                <select 
                  value={newTemplate.type} 
                  onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value })}
                >
                  <option value="report">Report / Document (.docx, .pdf)</option>
                  <option value="presentation">Presentation / PPT (.pptx, .ppt)</option>
                  <option value="certificate">Certificate Format / Template (.pdf, .png)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Select File</label>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  required 
                  onChange={(e) => setNewTemplate({ ...newTemplate, file: e.target.files?.[0] || null })} 
                  style={{ border: 'none', background: 'transparent', padding: '0.5rem 0' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <Upload size={16} /> {saving ? 'Uploading...' : 'Upload Format'}
              </button>
            </form>
          </div>

          {/* Formats list */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
            <h3>Uploaded Formats & Templates ({templates.length})</h3>
            <div style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem', maxHeight: '550px', overflowY: 'auto' }}>
              {templates.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No resource formats uploaded yet.</p>
              ) : (
                templates.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t.name}</strong>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span className={`badge ${t.type === 'report' ? 'badge-info' : t.type === 'presentation' ? 'badge-success' : 'badge-warning'}`}>
                          {t.type === 'report' ? 'Report Doc' : t.type === 'presentation' ? 'Presentation PPT' : 'Certificate Format'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Uploaded: {new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <a href={t.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                        Download
                      </a>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '0.35rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                        onClick={() => handleDeleteTemplate(t)}
                        disabled={saving}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'meetings' && (
        <div className="glass animate-fade-in" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <h3><BookOpen size={20} /> Mentorship Meeting Logs</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            Review all scheduled and conducted mentorship sessions, including student attendance logs and uploaded meeting screenshots.
          </p>

          <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {meetings.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No meetings have been logged or scheduled yet.</p>
            ) : (
              meetings.map(m => {
                const isConducted = m.status === 'conducted';
                return (
                  <article key={m.id} style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: isConducted ? '#fff' : 'rgba(59, 130, 246, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={18} style={{ color: isConducted ? 'var(--success)' : 'var(--ieee-blue)' }} />
                        <strong style={{ fontSize: '1rem' }}>Group: {m.group_id} Mentoring Session</strong>
                        <span className={`badge ${isConducted ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.65rem' }}>
                          {isConducted ? 'Conducted' : 'Scheduled'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(m.held_at).toLocaleString()}</span>
                    </div>

                    {isConducted && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, margin: '0.35rem 0 0.5rem' }}>
                        Attendees: {m.attendance || 'None'}
                      </div>
                    )}

                    <p style={{ fontSize: '0.85rem', margin: '0.25rem 0 0.5rem', color: 'var(--text-primary)' }}>
                      <strong>{isConducted ? 'Discussion Notes' : 'Meeting Agenda'}:</strong> {m.notes}
                    </p>

                    {isConducted && m.next_actions && (
                      <div style={{ padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        <strong>Action Items:</strong> {m.next_actions}
                      </div>
                    )}

                    {isConducted && m.screenshot_url && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => handleViewMeetingScreenshot(m.screenshot_url)}
                        >
                          View Meeting Screenshot
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Certificate Printing / Preview Overlay Modal */}
      {certPreview && (() => {
        const isStudent = certPreview.recipient_role === 'student';
        const recipientProfile = (isStudent ? students : mentors).find(p => p.id === certPreview.recipient_id);
        const groupObj = isStudent ? groups.find(g => g.id === certPreview.group_id) : null;
        
        return (
          <CertificatePreviewModal 
            certificate={certPreview} 
            recipientName={recipientProfile?.full_name || 'Recipient Name'} 
            domainName={groupObj?.domain} 
            onClose={() => setCertPreview(null)} 
          />
        );
      })()}
    </div>
  );
}



function ImportPreview({ count, label = 'profiles', detail, onCancel, onConfirm, saving }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
      <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>{count} {label} parsed successfully.</span>
      {detail && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{detail}</span>}
      <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem' }} onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }} disabled={saving} onClick={onConfirm}>
        {saving ? 'Importing…' : 'Confirm Import'}
      </button>
    </div>
  );
}
