const query = new URLSearchParams(window.location.search);
const databaseApi = window.location.protocol === 'file:' ? null : '/api';

function hydrateRecords(type, storageKey) {
    if (!databaseApi) return;
    try {
        const request = new XMLHttpRequest();
        request.open('GET', `${databaseApi}/records?type=${encodeURIComponent(type)}`, false);
        request.send();
        if (request.status === 200) {
            const records = JSON.parse(request.responseText);
            if (records.length) localStorage.setItem(storageKey, JSON.stringify(records));
        }
    } catch (error) {
        // Browser storage remains the fallback when the API is unavailable.
    }
}
hydrateRecords('bookings', 'carepointBookings');
hydrateRecords('prescriptions', 'carepointPrescriptions');
hydrateRecords('patients', 'carepointPatients');
async function persistRecord(type, record) {
    if (!databaseApi) return;
    await fetch(`${databaseApi}/records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, record }) });
}
const registeredAccounts = JSON.parse(localStorage.getItem('carepointAccounts') || '[]');
const storedAccount = registeredAccounts.find((account) => account.email === query.get('email'));
const registeredPatient = JSON.parse(localStorage.getItem('carepointPatients') || '[]').find((patient) => patient.email === query.get('email'));
const profile = storedAccount || registeredPatient || {};
const displayName = profile.name || query.get('name');
const patientName = document.querySelector('#patient-name');
const staffName = document.querySelector('#staff-name');
const doctorName = document.querySelector('#doctor-name');
if (displayName && patientName) patientName.textContent = displayName.split(' ')[0];
if (displayName && staffName) staffName.textContent = displayName.split(' ')[0];
if (displayName && doctorName) doctorName.textContent = displayName;

const profileName = document.querySelector('#profile-name');
const profileInitials = document.querySelector('#profile-initials');
const profileEmail = document.querySelector('#profile-email');
const profilePhone = document.querySelector('#profile-phone');
const profileDob = document.querySelector('#profile-dob');
const profileMedications = document.querySelector('#profile-medications');
if (profileName) {
    const name = displayName || 'Patient profile';
    profileName.textContent = name;
    profileInitials.textContent = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    profileEmail.textContent = profile.email || query.get('email') || 'Not provided';
    profilePhone.textContent = profile.phone || query.get('phone') || 'Not provided';
    profileDob.textContent = profile.dob || query.get('dob') || 'Not provided';
    profileMedications.textContent = profile.medications || query.get('medications') || 'Not provided';
}

const bookingForm = document.querySelector('.booking-form');
const bookingFeedback = document.querySelector('.booking-feedback');
if (bookingForm && bookingFeedback) {
    const dateInput = bookingForm.querySelector('input[name="date"]');
    dateInput.min = new Date().toISOString().split('T')[0];
    bookingForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(bookingForm);
        const booking = {
            patient: displayName || 'New patient',
            initials: (displayName || 'NP').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
            type: formData.get('visitType'),
            date: formData.get('date'),
            time: formData.get('time'),
            notes: formData.get('notes'),
            doctor: activeDoctor,
            status: 'pending'
        };
        const bookings = getBookings();
        bookings.push(booking);
        localStorage.setItem('carepointBookings', JSON.stringify(bookings));
        const bookingRecord = {...booking, id: `booking-${Date.now()}` };
        persistRecord('bookings', bookingRecord);
        persistRecord('followUps', {...bookingRecord, id: `follow-up-${Date.now()}` });
        renderFollowUpRecords();
        bookingFeedback.textContent = 'Request sent. Your care team will confirm the appointment shortly.';
        bookingForm.reset();
        dateInput.min = new Date().toISOString().split('T')[0];
    });
}

const aiForm = document.querySelector('.ai-form');
const aiResponse = document.querySelector('.ai-response');
const aiChatForm = document.querySelector('.ai-chat-form');
const aiChatInput = document.querySelector('#ai-chat-input');
const aiChatThread = document.querySelector('.ai-chat-thread');
if (aiForm && aiResponse) {
    const guidance = {
        cold: { title: 'For cold symptoms', tips: ['Rest and drink plenty of fluids.', 'Try saline nasal spray or a warm shower for congestion.', 'Wash your hands and avoid sharing drinks while symptoms continue.'], medication: 'A pharmacist can advise whether saline spray or an age-appropriate pain or fever reliever is suitable. Check labels and avoid doubling ingredients.', warning: 'Seek medical advice for breathing trouble, severe weakness, dehydration, or symptoms that worsen or last more than 10 days.' },
        cough: { title: 'For a cough', tips: ['Drink warm fluids and consider honey if you are over 1 year old.', 'Use a humidifier and avoid smoke or strong fragrances.', 'Track whether the cough is dry or brings up mucus.'], medication: 'Ask a pharmacist about cough medicines for your age and health conditions. Do not give honey to children under 1 year, and do not combine products without checking ingredients.', warning: 'Get urgent help for trouble breathing, chest pain, blue lips, or coughing blood.' },
        fever: { title: 'For a fever', tips: ['Rest, drink fluids, and wear light clothing.', 'Check your temperature and note when it started.', 'Ask a pharmacist or clinician before taking fever medicine, especially with other medicines.'], medication: 'A pharmacist or clinician can advise whether an appropriate fever reducer is safe for you. Dosing depends on age, weight, health conditions, and other medicines.', warning: 'Seek urgent care for confusion, stiff neck, severe headache, breathing trouble, or a very high or persistent fever.' },
        headache: { title: 'For a headache', tips: ['Rest in a quiet, dim room and drink water.', 'Try a cool compress and take a break from screens.', 'Note possible triggers such as missed meals, stress, or poor sleep.'], medication: 'Ask a pharmacist whether an over-the-counter pain reliever is appropriate for you. Avoid frequent use without medical advice because it can worsen headaches.', warning: 'Get urgent help for a sudden severe headache, weakness, confusion, vision loss, or a headache after an injury.' },
        'sore-throat': { title: 'For a sore throat', tips: ['Sip warm fluids and try a salt-water gargle.', 'Rest your voice and avoid smoke.', 'Choose soft foods and monitor for fever or worsening pain.'], medication: 'A pharmacist can advise about soothing lozenges or pain relief. Antibiotics only help selected infections and require clinician assessment.', warning: 'Seek urgent help for trouble breathing or swallowing, drooling, or swelling of the neck.' }
    };
    aiForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const concern = document.querySelector('#ai-symptom').value.trim();
        const result = guidance[concern.toLowerCase()] || {
            title: `General guidance for ${concern}`,
            tips: ['Track when the concern started and what makes it better or worse.', 'Rest, hydrate, and avoid medicines you have been advised not to take.', 'Ask a licensed clinician or pharmacist about diagnosis and treatment options.'],
            medication: 'Medication choice depends on the diagnosis, allergies, age, pregnancy status, health conditions, and current medicines. Ask a pharmacist or clinician before taking anything new.',
            warning: 'Seek urgent care for trouble breathing, chest pain, severe pain, confusion, fainting, or rapidly worsening symptoms.'
        };
        aiResponse.dataset.concern = concern;
        aiResponse.hidden = false;
        aiResponse.querySelector('.ai-response-title').textContent = result.title;
        aiResponse.querySelector('.ai-response-list').innerHTML = result.tips.map((tip) => `<li>${tip}</li>`).join('');
        const medication = aiResponse.querySelector('.ai-medication');
        if (medication) medication.textContent = result.medication;
        aiResponse.querySelector('.ai-warning').textContent = result.warning;
    });
    document.querySelector('.ai-emergency-button').addEventListener('click', async() => {
        const feedback = aiResponse.querySelector('.ai-assignment-feedback');
        const doctors = [{ id: 'maya', name: 'Dr. Maya Patel' }, { id: 'li', name: 'Dr. Daniel Li' }, { id: 'rivera', name: 'Dr. Sofia Rivera' }];
        const doctor = doctors[Math.floor(Math.random() * doctors.length)];
        const assignment = { id: `emergency-${Date.now()}`, patient: displayName || query.get('email'), concern: aiResponse.dataset.concern, doctor: doctor.id, doctorName: doctor.name, status: 'emergency', createdAt: new Date().toISOString() };
        const bookings = getBookings();
        bookings.push(assignment);
        localStorage.setItem('carepointBookings', JSON.stringify(bookings));
        await persistRecord('emergencyAssignments', assignment);
        feedback.textContent = `${doctor.name} has been alerted for an emergency review. Call emergency services for immediate danger.`;
    });
    aiResponse.querySelector('.ai-chat-button').addEventListener('click', () => {
                const notes = document.querySelector('#ai-notes').value.trim();
                const symptom = document.querySelector('#ai-symptom').value.trim();
                const chatMessage = `I would like to ask about ${symptom.toLowerCase()}.${notes ? ` Details: ${notes}` : ''}`;
    const input = document.querySelector('.chat-input');
    if (input && !input.disabled) {
      input.value = chatMessage;
      input.focus();
      document.querySelector('.chat-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (aiChatForm && aiChatInput && aiChatThread) {
  const emergencyButton = document.querySelector('.ai-emergency-button');
  const seriousTerms = ['chest pain', 'trouble breathing', 'difficulty breathing', 'cannot breathe', 'blue lips', 'fainted', 'fainting', 'unconscious', 'severe bleeding', 'coughing blood', 'vomiting blood', 'stroke', 'seizure', 'suicidal', 'overdose', 'poisoning'];
  function isSeriousConcern(message) {
    const normalizedMessage = message.toLowerCase();
    return seriousTerms.some((term) => normalizedMessage.includes(term));
  }
  function createAiReply(message, serious) {
    const normalizedMessage = message.toLowerCase();
    if (serious) return 'This may be an emergency. Call your local emergency number now. Do not wait for an online response. I can also alert a Carepoint doctor for follow-up.';
    if (normalizedMessage.includes('medicine') || normalizedMessage.includes('medication') || normalizedMessage.includes('prescription')) return 'I can explain common uses, precautions, and questions to ask a pharmacist, but I cannot safely choose a prescription without your medical history. Tell me the medicine name and what you are taking it for.';
    if (normalizedMessage.includes('fever') || normalizedMessage.includes('temperature')) return 'For a fever, rest, drink fluids, and record your temperature and how long it has lasted. Tell me the temperature, your age, and any other symptoms so I can share more relevant general guidance.';
    if (normalizedMessage.includes('headache') || normalizedMessage.includes('migraine')) return 'Headaches can have many causes. Rest somewhere quiet, drink water, and note triggers such as poor sleep or missed meals. Is this sudden, severe, or different from your usual headaches?';
    if (normalizedMessage.includes('cough') || normalizedMessage.includes('cold')) return 'For common cold or cough symptoms, fluids, rest, and avoiding smoke may help. How long have you had it, and is the cough dry or producing mucus?';
    if (normalizedMessage.includes('diabetes') || normalizedMessage.includes('blood sugar')) return 'Diabetes care depends on your readings, medicines, food, and medical history. Keep a record of your blood sugar and discuss changes with your care team. Are you asking about symptoms, readings, or medicines?';
    return `I understand you are asking about ${message}. I can help you think through common symptoms, warning signs, and questions for your clinician. How long has this been happening, and what symptoms are you noticing?`;
  }
  aiChatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = aiChatInput.value.trim();
    if (!message) return;
    const question = document.createElement('p');
    question.className = 'chat-bubble outgoing';
    question.dataset.sender = displayName || 'You';
    question.dataset.time = 'Now';
    question.textContent = message;
    aiChatThread.appendChild(question);
    const serious = isSeriousConcern(message);
    if (emergencyButton) emergencyButton.hidden = !serious;
    const reply = document.createElement('p');
    reply.className = 'chat-bubble incoming';
    reply.dataset.sender = 'Carepoint AI';
    reply.dataset.time = 'Now';
    reply.textContent = createAiReply(message, serious);
    aiChatThread.appendChild(reply);
    aiChatInput.value = '';
    aiChatThread.scrollTop = aiChatThread.scrollHeight;
    persistRecord('aiChats', { id: `ai-chat-${Date.now()}`, patient: displayName || query.get('email'), question: message, answer: reply.textContent, createdAt: new Date().toISOString() });
  });
}

const chatForm = document.querySelector('.chat-form');
const chatInput = document.querySelector('.chat-input');
const chatThread = document.querySelector('.chat-thread');
const patientDirectory = document.querySelector('#registered-patients');
const isPatientPortal = window.location.pathname.endsWith('patient-portal.html');
let activePatient = 'Alex Morgan';
let activeDoctor = query.get('doctor') || 'maya';
const doctors = {
  maya: { name: 'Dr. Maya Patel', initials: 'MP', specialty: 'Primary care physician', email: 'maya.patel@carepoint.example', phone: '(555) 201-0188' },
  li: { name: 'Dr. Daniel Li', initials: 'DL', specialty: 'Internal medicine', email: 'daniel.li@carepoint.example', phone: '(555) 201-0199' },
  rivera: { name: 'Dr. Sofia Rivera', initials: 'SR', specialty: 'Family medicine', email: 'sofia.rivera@carepoint.example', phone: '(555) 201-0177' }
};

const careTeamList = document.querySelector('#care-team-list');
const registeredDoctorKeys = new Set();
function renderCareTeam() {
  if (!careTeamList) return;
  careTeamList.replaceChildren();
  const doctorEntries = registeredDoctorKeys.size
    ? Object.entries(doctors).filter(([key]) => registeredDoctorKeys.has(key))
    : Object.entries(doctors).filter(([key]) => !key.startsWith('account-'));
  doctorEntries.forEach(([, doctor]) => {
    const choice = document.createElement('div');
    choice.className = 'doctor-profile';
    choice.innerHTML = `<span class="doctor-avatar">${doctor.initials}</span><div><strong>${doctor.name}</strong><small>${doctor.specialty}</small><small>${doctor.email}</small></div>`;
    careTeamList.appendChild(choice);
  });
}
renderCareTeam();

JSON.parse(localStorage.getItem('carepointAccounts') || '[]')
  .filter((account) => account.role === 'doctor')
  .forEach((account) => {
    const key = `account-${account.email.replace(/[^a-z0-9]/g, '-')}`;
    registeredDoctorKeys.add(key);
    doctors[key] = {
      name: account.name,
      initials: account.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      specialty: account.specialty || 'Carepoint physician',
      email: account.email,
      phone: account.phone || 'Contact through Carepoint'
    };
  });

if (databaseApi) {
  fetch(`${databaseApi}/accounts`)
    .then((response) => response.ok ? response.json() : [])
    .then((accounts) => {
      localStorage.setItem('carepointAccounts', JSON.stringify(accounts));
      accounts.filter((account) => account.role === 'doctor').forEach((account) => {
        const key = `account-${account.email.replace(/[^a-z0-9]/g, '-')}`;
        registeredDoctorKeys.add(key);
        doctors[key] = { name: account.name, initials: account.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), specialty: account.specialty || 'Carepoint physician', email: account.email, phone: account.phone || 'Contact through Carepoint' };
      });
      renderCareTeam();
      renderDoctorList();
    })
    .catch(() => {});
}

function chatStorageKey(patient, doctor = activeDoctor) {
  return `carepointChat_${patient.toLowerCase().replaceAll(' ', '_')}_${doctor}`;
}

function getBookings() {
  return JSON.parse(localStorage.getItem('carepointBookings') || '[]');
}

function renderCoordinationAgents() {
  const container = document.querySelector('#coordination-agents');
  if (!container || isPatientPortal) return;
  const bookings = getBookings();
  const today = new Date().toISOString().slice(0, 10);
  const overdueFollowUps = bookings.filter((booking) => booking.date && booking.date < today && !['attended', 'completed', 'missed'].includes(booking.status)).length;
  const pendingAppointments = bookings.filter((booking) => booking.status === 'pending').length;
  const bookedSlots = new Set(bookings.filter((booking) => booking.date === today).map((booking) => `${booking.doctor}-${booking.time}`));
  const registeredDoctors = getRegisteredDoctors ? getRegisteredDoctors() : [];
  const availableSlots = (registeredDoctors.length || 3) * 4 - bookedSlots.size;
  const agents = [
    { name: 'Registration Agent', owner: 'Patient access', detail: 'Account and contact details', count: 'Verified accounts', status: 'Monitoring', tone: 'ready' },
    { name: 'Scheduling Agent', owner: 'Appointment coordination', detail: 'Matches visits to doctor availability', count: `${Math.max(0, availableSlots)} slots open`, status: pendingAppointments ? `${pendingAppointments} for review` : 'Up to date', tone: pendingAppointments ? 'attention' : 'ready' },
    { name: 'Lab & Diagnostics Agent', owner: 'Investigation follow-up', detail: 'Lab and imaging result returns', count: 'No verified orders', status: 'Awaiting data', tone: 'waiting' },
    { name: 'Pharmacy Agent', owner: 'Medication coordination', detail: 'Prescription and dispensing workflow', count: 'Review required', status: 'Human review', tone: 'attention' },
    { name: 'Referral Agent', owner: 'Specialist referrals', detail: 'Referral sent and scheduled status', count: 'No verified referrals', status: 'Awaiting data', tone: 'waiting' },
    { name: 'Follow-up Agent', owner: 'Post-care monitoring', detail: 'Missed and overdue follow-ups', count: `${overdueFollowUps} overdue`, status: overdueFollowUps ? 'Staff queue' : 'Monitoring', tone: overdueFollowUps ? 'attention' : 'ready' }
  ];
  container.innerHTML = agents.map((agent) => `<div class="agent-card"><div class="agent-card-heading"><span class="agent-status ${agent.tone}"></span><strong>${agent.name}</strong></div><small>${agent.owner}</small><p>${agent.detail}</p><div class="agent-card-footer"><b>${agent.count}</b><span>${agent.status}</span></div></div>`).join('');
}
function getRegisteredDoctors() {
  return JSON.parse(localStorage.getItem('carepointAccounts') || '[]').filter((account) => account.role === 'doctor');
}

renderCoordinationAgents();

function renderStaffDoctorOptions(accounts = getRegisteredDoctors()) {
  const selects = document.querySelectorAll('.assign-doctor');
  if (!selects.length) return;
  const doctorsForOptions = accounts.length ? accounts.map((account) => ({ value: `account-${account.email.replace(/[^a-z0-9]/g, '-')}`, name: account.name })) : [{ value: 'maya', name: 'Dr. Maya Patel' }, { value: 'li', name: 'Dr. Daniel Li' }, { value: 'rivera', name: 'Dr. Sofia Rivera' }];
  selects.forEach((select) => {
    const selectedValue = select.value;
    select.replaceChildren();
    doctorsForOptions.forEach((doctor) => {
      const option = document.createElement('option');
      option.value = doctor.value;
      option.textContent = doctor.name;
      option.selected = doctor.value === selectedValue;
      select.appendChild(option);
    });
  });
}
renderStaffDoctorOptions();
if (databaseApi && !isPatientPortal) {
  fetch(`${databaseApi}/accounts`)
    .then((response) => response.ok ? response.json() : [])
    .then((accounts) => {
      localStorage.setItem('carepointAccounts', JSON.stringify(accounts));
      renderStaffDoctorOptions(accounts.filter((account) => account.role === 'doctor'));
    })
    .catch(() => {});
}

const selfApprovalReview = document.querySelector('#self-approval-review');
if (selfApprovalReview) {
  selfApprovalReview.addEventListener('click', () => {
    const bookings = getBookings();
    const pending = bookings.filter((booking) => booking.status === 'pending').length;
    const status = document.querySelector('#self-approval-status');
    if (status) status.textContent = `${pending} appointment${pending === 1 ? '' : 's'} prepared for staff approval. Clinical consultations and prescriptions remain locked until a qualified reviewer signs off.`;
    persistRecord('agentReviews', { id: `agent-review-${Date.now()}`, agent: 'Self-Approval Agent', pendingAppointments: pending, status: 'awaiting-human-review', createdAt: new Date().toISOString() });
  });
}

function renderFollowUpRecords() {
  if (!isPatientPortal) return;
  const patientBookings = getBookings().filter((booking) => !displayName || booking.patient === displayName);
  const attended = patientBookings.filter((booking) => ['attended', 'completed'].includes(booking.status));
  const missed = patientBookings.filter((booking) => booking.status === 'missed');
  const upcoming = patientBookings.filter((booking) => !['attended', 'completed', 'missed'].includes(booking.status));
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  setText('#follow-up-attended', attended.length);
  setText('#follow-up-missed', missed.length);
  setText('#follow-up-upcoming', upcoming.length);
  setText('#follow-up-total', `${patientBookings.length} total`);

  const followUpRecords = document.querySelector('#follow-up-records');
  const consultationRecords = document.querySelector('#consultation-records');
  const formatStatus = (status) => status === 'missed' ? 'Missed' : ['attended', 'completed'].includes(status) ? 'Attended' : 'Upcoming';
  const recordMarkup = (booking) => `<div class="record-row"><span class="record-icon">&#9672;</span><div><strong>${booking.type || 'Follow-up consultation'}</strong><small>${booking.doctorName || doctors[booking.doctor || 'maya']?.name || 'Carepoint care team'} &middot; ${formatBookingDate(booking.date)}${booking.time ? ` at ${booking.time}` : ''}</small>${booking.notes ? `<small>${booking.notes}</small>` : ''}</div><span class="record-result ${booking.status === 'missed' ? 'missed' : ['attended', 'completed'].includes(booking.status) ? 'attended' : ''}">${formatStatus(booking.status)}</span></div>`;
  if (followUpRecords) followUpRecords.innerHTML = patientBookings.length ? patientBookings.map(recordMarkup).join('') : '<p class="empty-record">No follow-up records yet.</p>';
  if (consultationRecords) consultationRecords.innerHTML = patientBookings.length ? patientBookings.map(recordMarkup).join('') : '<p class="empty-record">No consultation records yet.</p>';
}

function formatBookingDate(date) {
  if (!date) return 'Date pending';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function syncAppointmentDetails() {
  const booking = acceptedPatientBooking;
  if (isPatientPortal && booking) {
    const type = document.querySelector('#appointment-type');
    const date = document.querySelector('#appointment-date');
    const doctor = document.querySelector('#appointment-doctor');
    const summary = document.querySelector('#appointment-summary');
    if (type) type.textContent = booking.type || 'Consultation';
    if (date) date.textContent = formatBookingDate(booking.date || '2026-09-08');
    if (doctor && booking.doctorName) doctor.textContent = booking.doctorName;
    if (summary) summary.textContent = `${formatBookingDate(booking.date || '2026-09-08')} · ${booking.time || '02:00 PM'} · ${booking.doctorName || 'Assigned doctor'} · In person`;
  }
  if (!isPatientPortal) {
    document.querySelectorAll('.doctor-appointments .appointment-row[data-patient]').forEach((row) => {
      const bookingForPatient = getBookings().find((item) => item.patient === row.dataset.patient && item.status === 'approved' && (!query.get('name') || item.doctorName === query.get('name')));
      if (bookingForPatient) {
        const details = row.querySelector('.appointment-details small');
        if (details) details.textContent = `${bookingForPatient.type || 'Consultation'} · ${formatBookingDate(bookingForPatient.date)}, ${bookingForPatient.time || 'Time pending'}`;
      }
    });
  }
}

const acceptedPatientBooking = isPatientPortal
  ? getBookings().filter((booking) => booking.patient === displayName && booking.status === 'approved').sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')))[0]
  : null;
renderFollowUpRecords();
if (acceptedPatientBooking) activeDoctor = acceptedPatientBooking.doctor || activeDoctor;
syncAppointmentDetails();

function saveBookings(bookings) {
  localStorage.setItem('carepointBookings', JSON.stringify(bookings));
}

function hasApprovedAppointment(patient, doctor) {
  if (patient === 'Alex Morgan' && doctor === 'maya') return true;
  return getBookings().some((booking) => booking.patient === patient && booking.doctor === doctor && booking.status === 'approved');
}

function updatePatientChatAccess() {
  const status = document.querySelector('#patient-chat-status');
  if (!isPatientPortal || !status || !chatInput) return;
  const approved = hasApprovedAppointment(displayName || 'patient', activeDoctor);
  const sendButton = chatForm.querySelector('button');
  status.textContent = approved ? 'Online' : 'Approval required';
  status.classList.toggle('approval-status', !approved);
  chatInput.disabled = !approved;
  sendButton.disabled = !approved;
  chatInput.placeholder = approved ? 'Write a message...' : 'Waiting for appointment approval...';
  const firstMessage = chatThread?.querySelector(':scope > .chat-bubble.incoming');
  const messageTime = chatThread?.querySelector(':scope > .chat-time');
  if (firstMessage) firstMessage.textContent = approved ? 'Your appointment is confirmed. You can now chat with your doctor.' : 'Your doctor chat will open after an appointment is accepted.';
  if (messageTime) messageTime.textContent = approved ? 'Appointment accepted' : 'Appointment approval required';
}

function renderDoctor(doctorId) {
  const acceptedBooking = isPatientPortal ? getBookings().filter((booking) => booking.patient === displayName && booking.doctor === doctorId && booking.status === 'approved').sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')))[0] : null;
  const baseDoctor = doctors[doctorId] || doctors.maya;
  const doctor = acceptedBooking?.doctorName ? { ...baseDoctor, name: acceptedBooking.doctorName, initials: acceptedBooking.doctorName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() } : baseDoctor;
  activeDoctor = doctorId;
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  setText('#appointment-doctor', doctor.name);
  setText('#booking-doctor', doctor.name);
  document.querySelectorAll('.record-doctor').forEach((element) => { element.textContent = doctor.name; });
  setText('#patient-chat-doctor', doctor.name);
  setText('#selected-doctor-avatar', doctor.initials);
  setText('#selected-doctor-name', doctor.name);
  setText('#selected-doctor-specialty', doctor.specialty);
  setText('#selected-doctor-email', doctor.email);
  setText('#selected-doctor-phone', doctor.phone);
  document.querySelectorAll('.doctor-choice').forEach((button) => button.classList.toggle('active', button.dataset.doctor === doctorId));
  if (isPatientPortal && chatThread) {
    chatThread.querySelectorAll('.saved-message').forEach((message) => message.remove());
    const messages = JSON.parse(localStorage.getItem(chatStorageKey(displayName || 'patient', doctorId)) || '[]');
    messages.forEach((message) => {
      const bubble = document.createElement('p');
      bubble.className = `chat-bubble ${message.direction} saved-message`;
      bubble.dataset.sender = message.sender || (message.direction === 'outgoing' ? 'You' : doctor.name);
      bubble.dataset.time = message.time || 'Now';
      bubble.textContent = message.text;
      chatThread.appendChild(bubble);
    });
  }
}

function renderChat(patient) {
  activePatient = patient;
  const chatTitle = document.querySelector('#doctor-chat-name');
  const detailTitle = document.querySelector('#doctor-detail-name');
  const selectedPatient = JSON.parse(localStorage.getItem('carepointPatients') || '[]').find((item) => item.name === patient);
  if (chatTitle) chatTitle.textContent = patient;
  if (detailTitle) detailTitle.textContent = patient;
  const prescriptionPatient = document.querySelector('#prescription-patient');
  if (prescriptionPatient) prescriptionPatient.textContent = patient;
  if (chatInput) chatInput.placeholder = `Reply to ${patient.split(' ')[0]}...`;
  if (selectedPatient) {
    document.querySelector('#doctor-detail-email').textContent = selectedPatient.email;
    document.querySelector('#doctor-detail-phone').textContent = selectedPatient.phone;
    document.querySelector('#doctor-detail-medications').textContent = selectedPatient.medications || 'Not provided';
  } else if (patient !== 'Alex Morgan') {
    document.querySelector('#doctor-detail-email').textContent = 'Not provided';
    document.querySelector('#doctor-detail-phone').textContent = 'Not provided';
    document.querySelector('#doctor-detail-medications').textContent = 'Not provided';
  }
  document.querySelectorAll('.patient-choice').forEach((button) => button.classList.toggle('active', button.dataset.patient === patient));
  if (chatThread) {
    const messages = JSON.parse(localStorage.getItem(chatStorageKey(patient)) || '[]');
    if (patient !== 'Alex Morgan') chatThread.querySelectorAll(':scope > p, :scope > small').forEach((message) => message.remove());
    chatThread.querySelectorAll('.saved-message').forEach((message) => message.remove());
    messages.forEach((message) => {
      const bubble = document.createElement('p');
      bubble.className = `chat-bubble ${message.direction} saved-message`;
      bubble.dataset.sender = message.sender || (message.direction === 'outgoing' ? 'Doctor' : patient);
      bubble.dataset.time = message.time || 'Now';
      bubble.textContent = message.text;
      chatThread.appendChild(bubble);
    });
    chatThread.scrollTop = chatThread.scrollHeight;
  }
}

const prescriptionForm = document.querySelector('.prescription-form');
if (prescriptionForm) {
  prescriptionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(prescriptionForm);
    const prescriptions = JSON.parse(localStorage.getItem('carepointPrescriptions') || '[]');
    const prescription = { id: `prescription-${Date.now()}`, patient: activePatient, medicine: data.get('medicine'), dosage: data.get('dosage'), frequency: data.get('frequency'), instructions: data.get('instructions'), doctor: query.get('name') || 'Logged-in doctor', date: new Date().toISOString().slice(0, 10) };
    prescriptions.push(prescription);
    localStorage.setItem('carepointPrescriptions', JSON.stringify(prescriptions));
    persistRecord('prescriptions', prescription);
    prescriptionForm.reset();
    prescriptionForm.querySelector('.prescription-feedback').textContent = `Prescription saved for ${activePatient}.`;
  });
}

const staffMedicationList = document.querySelector('#staff-medication-list');
if (staffMedicationList) {
  const patients = JSON.parse(localStorage.getItem('carepointPatients') || '[]');
  patients.forEach((patient) => {
    const row = document.createElement('div');
    row.className = 'medication-row';
    row.innerHTML = `<span class="medication-icon">+</span><div><strong>${patient.name}</strong><small>${patient.medications || 'Medication list not yet provided'}</small></div>`;
    staffMedicationList.appendChild(row);
  });
}

const staffPatientRecords = document.querySelector('#staff-patient-records');
if (staffPatientRecords) {
  const existingNames = new Set([...staffPatientRecords.querySelectorAll('.open-record')].map((button) => button.dataset.patient));
  JSON.parse(localStorage.getItem('carepointPatients') || '[]').forEach((patient) => {
    if (existingNames.has(patient.name)) return;
    const row = document.createElement('div');
    row.className = 'patient-record-row';
    row.innerHTML = `<div class="patient-avatar">${patient.initials}</div><div><strong>${patient.name}</strong><small>Registered patient · Record available</small></div><button class="record-result open-record" type="button" data-patient="${patient.name}">View record &rarr;</button>`;
    staffPatientRecords.appendChild(row);
  });
}

document.querySelectorAll('.open-record').forEach((button) => {
  button.addEventListener('click', () => {
    const patient = JSON.parse(localStorage.getItem('carepointPatients') || '[]').find((item) => item.name === button.dataset.patient);
    const prescriptions = JSON.parse(localStorage.getItem('carepointPrescriptions') || '[]').filter((item) => item.patient === button.dataset.patient);
    document.querySelector('#staff-record-detail').hidden = false;
    document.querySelector('#staff-record-name').textContent = button.dataset.patient;
    document.querySelector('#staff-record-email').textContent = patient?.email || 'Not provided';
    document.querySelector('#staff-record-phone').textContent = patient?.phone || 'Not provided';
    document.querySelector('#staff-record-medications').textContent = patient?.medications || 'Not provided';
    document.querySelector('#staff-record-prescriptions').textContent = prescriptions.length ? prescriptions.map((item) => `${item.medicine} ${item.dosage} · ${item.frequency} · by ${item.doctor}`).join(' | ') : 'No prescriptions recorded';
    document.querySelector('#staff-record-detail').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

const doctorList = document.querySelector('#doctor-list');
function renderDoctorList() {
  if (!doctorList) return;
  doctorList.replaceChildren();
  const doctorEntries = registeredDoctorKeys.size
    ? Object.entries(doctors).filter(([key]) => registeredDoctorKeys.has(key))
    : Object.entries(doctors).filter(([key]) => !key.startsWith('account-'));
  doctorEntries.forEach(([key, doctor]) => {
    const choice = document.createElement('button');
    choice.className = 'doctor-choice';
    choice.type = 'button';
    choice.dataset.doctor = key;
    choice.innerHTML = `<span class="doctor-avatar">${doctor.initials}</span><span><strong>${doctor.name}</strong><small>${doctor.specialty}</small></span>`;
    doctorList.appendChild(choice);
  });
}
if (doctorList) {
  renderDoctorList();
  doctorList.addEventListener('click', (event) => {
    const choice = event.target.closest('.doctor-choice');
    if (!choice) return;
    renderDoctor(choice.dataset.doctor);
    const chatSection = document.querySelector('.chat-section');
    if (chatSection) chatSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      if (!chatInput?.disabled) chatInput.focus();
    }, 350);
    const nextUrl = `${window.location.pathname}${window.location.search.replace(/([?&])doctor=[^&]*/, '').replace(/[?&]$/, '')}${window.location.search.includes('?') ? '&' : '?'}doctor=${choice.dataset.doctor}`;
    window.history.replaceState({}, '', nextUrl);
  });
  renderDoctor(activeDoctor);
  if (acceptedPatientBooking?.doctorName) {
    const setIfExists = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = value;
    };
    setIfExists('#patient-chat-doctor', acceptedPatientBooking.doctorName);
    setIfExists('#selected-doctor-name', acceptedPatientBooking.doctorName);
    setIfExists('#appointment-doctor', acceptedPatientBooking.doctorName);
    document.querySelectorAll('.record-doctor').forEach((element) => { element.textContent = acceptedPatientBooking.doctorName; });
  }
}

document.querySelectorAll('.assign-doctor').forEach((select) => {
  Object.entries(doctors).filter(([key]) => key.startsWith('account-')).forEach(([key, doctor]) => {
    if (!select.querySelector(`option[value="${key}"]`)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = doctor.name;
      select.appendChild(option);
    }
  });
});

if (patientDirectory) {
  const patients = JSON.parse(localStorage.getItem('carepointPatients') || '[]');
  patients.forEach((patient) => {
    if (patient.name === 'Alex Morgan') return;
    const choice = document.createElement('button');
    choice.className = 'patient-choice';
    choice.type = 'button';
    choice.dataset.patient = patient.name;
    choice.innerHTML = `<span class="patient-avatar">${patient.initials}</span><span><strong>${patient.name}</strong><small>${patient.email}</small></span>`;
    patientDirectory.appendChild(choice);
  });
  patientDirectory.addEventListener('click', (event) => {
    const choice = event.target.closest('.patient-choice');
    if (choice) renderChat(choice.dataset.patient);
  });
}

const staffConversationPatients = document.querySelector('#staff-conversation-patients');
if (staffConversationPatients) {
  const patients = JSON.parse(localStorage.getItem('carepointPatients') || '[]');
  patients.forEach((patient) => {
    if (patient.name === 'Alex Morgan' || staffConversationPatients.querySelector(`[data-patient="${patient.name}"]`)) return;
    const choice = document.createElement('button');
    choice.className = 'patient-choice';
    choice.type = 'button';
    choice.dataset.patient = patient.name;
    choice.innerHTML = `<span class="patient-avatar">${patient.initials}</span><span><strong>${patient.name}</strong><small>${patient.email}</small></span>`;
    staffConversationPatients.appendChild(choice);
  });
  staffConversationPatients.addEventListener('click', (event) => {
    const choice = event.target.closest('.patient-choice');
    if (!choice) return;
    renderChat(choice.dataset.patient);
    const title = document.querySelector('#staff-chat-patient');
    if (title) title.textContent = choice.dataset.patient;
  });
}

document.querySelectorAll('.chat-open-button').forEach((button) => {
  button.addEventListener('click', () => renderChat(button.dataset.patient));
});

if (chatForm && chatInput && chatThread) {
  if (patientName) {
    chatInput.placeholder = `Message ${displayName ? displayName.split(' ')[0] : 'your doctor'}...`;
  }
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    const bubble = document.createElement('p');
    bubble.className = 'chat-bubble outgoing saved-message';
    bubble.dataset.sender = isPatientPortal ? (displayName || 'You') : (query.get('name') || 'Doctor');
    bubble.dataset.time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    bubble.textContent = message;
    chatThread.appendChild(bubble);
    const conversationPatient = isPatientPortal ? (displayName || 'patient') : activePatient;
    const messages = JSON.parse(localStorage.getItem(chatStorageKey(conversationPatient)) || '[]');
    messages.push({ direction: 'outgoing', sender: bubble.dataset.sender, time: bubble.dataset.time, text: message });
    localStorage.setItem(chatStorageKey(conversationPatient), JSON.stringify(messages));
    persistRecord('chats', { id: `${chatStorageKey(conversationPatient)}-${Date.now()}`, conversation: chatStorageKey(conversationPatient), patient: conversationPatient, sender: bubble.dataset.sender, time: bubble.dataset.time, text: message });
    chatInput.value = '';
    chatInput.focus();
    chatThread.scrollTop = chatThread.scrollHeight;
  });
}

function bindApprovalButtons() {
  document.querySelectorAll('.approve-button').forEach((button) => {
  button.addEventListener('click', () => {
    const appointment = button.closest('.appointment-row');
    const bookings = getBookings();
    const index = Number(appointment.dataset.bookingIndex);
    const loggedDoctor = JSON.parse(localStorage.getItem('carepointAccounts') || '[]').find((account) => account.role === 'doctor' && account.email === query.get('email'));
    const loggedDoctorKey = loggedDoctor ? `account-${loggedDoctor.email.replace(/[^a-z0-9]/g, '-')}` : null;
    const assignedDoctor = Number.isInteger(index) && bookings[index] ? bookings[index].doctor : appointment.dataset.doctor;
    if (loggedDoctorKey && assignedDoctor && assignedDoctor !== loggedDoctorKey && assignedDoctor !== query.get('doctor')) {
      button.textContent = 'Assigned to another doctor';
      button.disabled = true;
      return;
    }
    const approverName = loggedDoctor?.name || query.get('name') || doctors[assignedDoctor || 'maya']?.name || 'Logged-in doctor';
    if (Number.isInteger(index) && bookings[index]) {
      bookings[index].status = 'approved';
      bookings[index].doctorName = approverName;
      saveBookings(bookings);
      persistRecord('bookings', { ...bookings[index], id: bookings[index].id || `booking-${index}` });
      persistRecord('followUps', { ...bookings[index], id: bookings[index].id || `follow-up-${index}` });
    } else if (appointment.dataset.patient) {
      const doctor = appointment.dataset.doctor || 'maya';
      const existing = bookings.find((booking) => booking.patient === appointment.dataset.patient && booking.doctor === doctor);
      if (existing) {
        existing.status = 'approved';
        existing.doctorName = approverName;
        persistRecord('bookings', { ...existing, id: existing.id || `booking-${appointment.dataset.patient}` });
        persistRecord('followUps', { ...existing, id: existing.id || `follow-up-${appointment.dataset.patient}` });
      } else {
        const approvedBooking = { patient: appointment.dataset.patient, doctor, doctorName: approverName, status: 'approved', type: 'Scheduled appointment', date: '2026-09-08', time: '02:00 PM' };
        bookings.push(approvedBooking);
        persistRecord('bookings', { ...approvedBooking, id: `booking-${appointment.dataset.patient}` });
        persistRecord('followUps', { ...approvedBooking, id: `follow-up-${appointment.dataset.patient}` });
      }
      saveBookings(bookings);
    }
    button.textContent = 'Approved';
    button.disabled = true;
    appointment.classList.add('approved');
    appointment.querySelector('.appointment-status').textContent = 'Approved';
  });
});
}

const bookingRequests = document.querySelector('#booking-requests');
if (bookingRequests) {
  function refreshBookingRequests() {
    bookingRequests.replaceChildren(); // Clear existing bookings
    const bookings = getBookings();
    bookings.forEach((booking, index) => {
      const row = document.createElement('div');
      row.dataset.bookingIndex = index;
      row.dataset.patient = booking.patient;
      const readableDate = booking.date ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) : 'Date pending';
      row.className = 'appointment-row';
      row.innerHTML = `<div class="patient-avatar coral">${booking.initials}</div><div class="appointment-details"><strong>${booking.patient}</strong><small>${booking.type} &middot; ${readableDate}, ${booking.time || 'Time pending'}</small></div><select class="assign-doctor" aria-label="Assign doctor"><option value="maya" ${booking.doctor === 'maya' ? 'selected' : ''}>Dr. Maya Patel</option><option value="li" ${booking.doctor === 'li' ? 'selected' : ''}>Dr. Daniel Li</option><option value="rivera" ${booking.doctor === 'rivera' ? 'selected' : ''}>Dr. Sofia Rivera</option></select><span class="appointment-status ${booking.status === 'approved' ? 'approved' : 'pending'}">${booking.status === 'approved' ? 'Approved' : 'Pending'}</span><button class="approve-button" type="button" ${booking.status === 'approved' ? 'disabled' : ''}>${booking.status === 'approved' ? 'Approved' : 'Approve'}</button>`;
      bookingRequests.appendChild(row);
    });
    bookingRequests.querySelectorAll('.assign-doctor').forEach((select) => {
      select.addEventListener('change', () => {
        const row = select.closest('.appointment-row');
        const currentBookings = getBookings();
        currentBookings[Number(row.dataset.bookingIndex)].doctor = select.value;
        currentBookings[Number(row.dataset.bookingIndex)].status = 'pending';
        saveBookings(currentBookings);
      });
    });
    bindApprovalButtons(); // Re-bind approval buttons
  }
  
  refreshBookingRequests();
  
  // Auto-refresh booking requests every 3 seconds and when window regains focus
  setInterval(refreshBookingRequests, 3000);
  window.addEventListener('focus', refreshBookingRequests);
  
  // Listen to storage changes (from other tabs/windows)
  window.addEventListener('storage', (event) => {
    if (event.key === 'carepointBookings') {
      refreshBookingRequests();
    }
  });
}

const doctorAppointments = document.querySelector('.doctor-appointments');
if (doctorAppointments && !isPatientPortal) {
  function refreshDoctorAppointments() {
    const existingRows = new Set([...doctorAppointments.querySelectorAll('[data-patient]')].map((row) => row.dataset.patient));
    const loggedDoctorKey = storedAccount?.role === 'doctor' ? `account-${storedAccount.email.replace(/[^a-z0-9]/g, '-')}` : null;
    getBookings().forEach((booking, index) => {
      if (existingRows.has(booking.patient)) return; // Skip already displayed
      const assignedToDoctor = !loggedDoctorKey || booking.doctor === loggedDoctorKey || booking.doctorName === displayName;
      if (!assignedToDoctor) return;
      const row = document.createElement('div');
      row.className = 'appointment-row';
      row.dataset.bookingIndex = index;
      row.dataset.patient = booking.patient;
      row.dataset.doctor = booking.doctor || '';
      const readableDate = booking.date ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Date pending';
      const approved = booking.status === 'approved';
      const attended = booking.status === 'attended';
      row.innerHTML = `<div class="patient-avatar">${booking.initials || booking.patient.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div class="appointment-details"><strong>${booking.patient}</strong><small>${booking.type || 'Consultation'} · ${readableDate}, ${booking.time || 'Time pending'}</small></div><span class="appointment-status ${approved || attended ? 'approved' : 'pending'}">${attended ? 'Attended' : approved ? 'Approved' : 'Pending'}</span>${approved ? `<button class="attended-button" type="button" data-patient="${booking.patient}" data-doctor="${booking.doctor || ''}" ${attended ? 'disabled' : ''}>${attended ? 'Attended' : 'Mark attended'}</button>` : `<button class="approve-button" type="button">Approve</button>`}<button class="chat-open-button" type="button" data-patient="${booking.patient}">Chat</button>`;
      doctorAppointments.appendChild(row);
      existingRows.add(booking.patient);
    });
  }
  
  refreshDoctorAppointments();
  
  // Auto-refresh doctor appointments every 3 seconds
  setInterval(refreshDoctorAppointments, 3000);
  window.addEventListener('focus', refreshDoctorAppointments);
  window.addEventListener('storage', (event) => {
    if (event.key === 'carepointBookings') {
      refreshDoctorAppointments();
    }
  });
}
bindApprovalButtons();
document.querySelectorAll('.attended-button').forEach((button) => {
  button.addEventListener('click', () => {
    const appointment = button.closest('.appointment-row');
    const bookings = getBookings();
    const index = Number(appointment.dataset.bookingIndex);
    const booking = Number.isInteger(index) && bookings[index]
      ? bookings[index]
      : bookings.find((item) => item.patient === appointment.dataset.patient && item.doctor === appointment.dataset.doctor);
    if (!booking || booking.status !== 'approved') return;
    booking.status = 'attended';
    booking.attendedAt = new Date().toISOString();
    saveBookings(bookings);
    persistRecord('bookings', { ...booking, id: booking.id || `booking-${booking.patient}` });
    persistRecord('followUps', { ...booking, id: booking.id || `follow-up-${booking.patient}` });
    button.textContent = 'Attended';
    button.disabled = true;
    appointment.classList.add('approved');
    appointment.querySelector('.appointment-status').textContent = 'Attended';
  });
});
updatePatientChatAccess();

// Auto-refresh patient chat access every 2 seconds to detect approved bookings
if (isPatientPortal) {
  setInterval(updatePatientChatAccess, 2000);
  window.addEventListener('focus', updatePatientChatAccess);
  window.addEventListener('storage', (event) => {
    if (event.key === 'carepointBookings') {
      updatePatientChatAccess();
    }
  });
}

if (isPatientPortal && acceptedPatientBooking?.doctorName) {
  window.setTimeout(() => {
    const approved = getBookings().find((booking) => booking.patient === displayName && booking.status === 'approved');
    const acceptedDoctor = approved?.doctorName;
    if (!acceptedDoctor) return;
    document.querySelector('#patient-chat-doctor').textContent = acceptedDoctor;
    document.querySelector('#selected-doctor-name').textContent = acceptedDoctor;
    document.querySelector('#appointment-doctor').textContent = acceptedDoctor;
    document.querySelectorAll('.record-doctor').forEach((element) => { element.textContent = acceptedDoctor; });
  }, 0);
}