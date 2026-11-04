const roleButtons = document.querySelectorAll('.role-button');
const modeButtons = document.querySelectorAll('.form-tab');
const registerFields = document.querySelectorAll('.register-only');
const loginFields = document.querySelectorAll('.login-only');
const form = document.querySelector('#auth-form');
const formTitle = document.querySelector('#form-title');
const formSubtitle = document.querySelector('#form-subtitle');
const submitLabel = document.querySelector('#submit-label');
const feedback = document.querySelector('.form-feedback');
const passwordToggle = document.querySelector('.password-toggle');
const passwordInput = document.querySelector('#password');

let selectedRole = 'patient';
let selectedMode = 'login';
const databaseApi = window.location.protocol === 'file:' ? null : '/api';

const demoAccounts = {
  'patient@carepoint.demo': { password: 'Patient123!', role: 'patient', name: 'Alex Morgan' },
  'doctor@carepoint.demo': { password: 'Doctor123!', role: 'doctor', name: 'Dr. Maya Patel' },
  'staff@carepoint.demo': { password: 'Staff123!', role: 'staff', name: 'Carepoint Staff' }
};

async function getAccounts() {
  if (!databaseApi) return JSON.parse(localStorage.getItem('carepointAccounts') || '[]');
  const response = await fetch(`${databaseApi}/accounts`);
  return response.ok ? response.json() : [];
}

async function saveAccount(account) {
  if (databaseApi) {
    await fetch(`${databaseApi}/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) });
    return;
  }
  const accounts = JSON.parse(localStorage.getItem('carepointAccounts') || '[]');
  const existingIndex = accounts.findIndex((item) => item.email === account.email);
  if (existingIndex >= 0) accounts[existingIndex] = account;
  else accounts.push(account);
  localStorage.setItem('carepointAccounts', JSON.stringify(accounts));
}

async function getAccount(email, password) {
  const identifier = email.trim().toLowerCase();
  const normalizedPhone = identifier.replace(/\D/g, '');
  const demoAccount = Object.entries(demoAccounts).find(([address, account]) => address === identifier && account.password === password);
  if (demoAccount) return { ...demoAccount[1], email: demoAccount[0] };
  const registeredAccounts = await getAccounts();
  return registeredAccounts.find((account) => {
    const matchesIdentifier = account.email === identifier || account.username?.toLowerCase() === identifier || (normalizedPhone && account.phone?.replace(/\D/g, '') === normalizedPhone);
    return matchesIdentifier && account.password === password;
  }) || null;
}

function updateForm() {
  const roleLabel = selectedRole === 'patient' ? 'patient' : selectedRole === 'doctor' ? 'doctor' : 'staff member';
  const isRegistering = selectedMode === 'register';

  registerFields.forEach((field) => {
    field.hidden = !isRegistering;
    const control = field.querySelector('input, textarea');
    if (control) control.required = isRegistering;
  });
  loginFields.forEach((field) => { field.hidden = isRegistering; });
  passwordInput.autocomplete = isRegistering ? 'new-password' : 'current-password';
  formTitle.textContent = isRegistering ? `Create your ${roleLabel} account` : `Sign in as a ${roleLabel}`;
  formSubtitle.textContent = isRegistering ? 'Set up secure access to your care portal.' : 'Use your email and password to continue.';
  submitLabel.textContent = isRegistering ? 'Create account' : 'Sign in';
  feedback.textContent = '';
}

roleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedRole = button.dataset.role;
    roleButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active);
    });
    updateForm();
  });
});

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedMode = button.dataset.mode;
    modeButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active);
    });
    form.reset();
    document.querySelectorAll('.field-group').forEach((field) => field.classList.remove('invalid'));
    updateForm();
  });
});

passwordToggle.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  passwordToggle.textContent = showing ? 'Show' : 'Hide';
  passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
});

function showError(input, message) {
  const field = input.closest('.field-group');
  field.classList.toggle('invalid', Boolean(message));
  field.querySelector('.error-message').textContent = message;
  return !message;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#email');
  const fullName = document.querySelector('#full-name');
  const phone = document.querySelector('#phone');
  const dateOfBirth = document.querySelector('#date-of-birth');
  const medications = document.querySelector('#medications');
  const username = document.querySelector('#username');
  const confirmPassword = document.querySelector('#confirm-password');
  let valid = true;

  const emailIsValid = selectedMode === 'register' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) : Boolean(email.value.trim());
  valid = showError(email, emailIsValid ? '' : selectedMode === 'register' ? 'Enter a valid email address.' : 'Enter your username, email, or mobile number.') && valid;
  valid = showError(passwordInput, passwordInput.validity.valid ? '' : 'Use at least 6 characters.') && valid;
  if (selectedMode === 'register') {
    valid = showError(fullName, fullName.value.trim() ? '' : 'Enter your full name.') && valid;
    valid = showError(username, username.value.trim() ? '' : 'Choose a username.') && valid;
    valid = showError(phone, phone.value.trim() ? '' : 'Enter your phone number.') && valid;
    valid = showError(dateOfBirth, dateOfBirth.value ? '' : 'Enter your date of birth.') && valid;
    valid = showError(confirmPassword, confirmPassword.value === passwordInput.value ? '' : 'Passwords do not match.') && valid;
  }

  if (valid) {
    let account;
    if (selectedMode === 'login') {
      account = await getAccount(email.value, passwordInput.value);
      if (!account) {
        feedback.textContent = 'Account not found or password is incorrect.';
        return;
      }
      if (account.role !== selectedRole) {
        feedback.textContent = `This account belongs to the ${account.role} portal. Select ${account.role} and try again.`;
        return;
      }
      document.querySelector('#full-name').value = account.name || '';
    }
    const action = selectedMode === 'register' ? 'Account created' : 'Signed in';
    const role = selectedRole === 'patient' ? 'patient' : selectedRole === 'doctor' ? 'doctor' : 'staff';
    const portal = selectedRole === 'patient' ? 'patient-portal.html' : selectedRole === 'doctor' ? 'doctor-portal.html' : 'staff-portal.html';
    const name = document.querySelector('#full-name').value.trim();
    const profile = account || {
      name,
      email: email.value.trim().toLowerCase(),
      phone: phone.value.trim(),
      dob: dateOfBirth.value,
      medications: medications.value.trim()
    };
    const details = new URLSearchParams({
      name: profile.name || name,
      email: profile.email,
      phone: profile.phone || '',
      dob: profile.dob || '',
      medications: profile.medications || ''
    });
    if (selectedMode === 'register') {
      const account = {
        email: email.value.trim().toLowerCase(),
        username: username.value.trim().toLowerCase(),
        password: passwordInput.value,
        role: selectedRole,
        name,
        phone: phone.value.trim(),
        dob: dateOfBirth.value,
        medications: medications.value.trim()
      };
      await saveAccount(account);
    }
    if (selectedMode === 'register' && selectedRole === 'patient') {
      const patients = JSON.parse(localStorage.getItem('carepointPatients') || '[]');
      const patient = {
        name,
        email: email.value.trim(),
        phone: phone.value.trim(),
        dob: dateOfBirth.value,
        medications: medications.value.trim(),
        initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
      };
      const existingIndex = patients.findIndex((item) => item.email === patient.email);
      if (existingIndex >= 0) patients[existingIndex] = patient;
      else patients.push(patient);
      localStorage.setItem('carepointPatients', JSON.stringify(patients));
      if (databaseApi) {
        await fetch(`${databaseApi}/records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'patients', record: { ...patient, id: `patient-${patient.email}` } }) });
      }
    }
    feedback.textContent = `${action} successfully. Opening your ${role} portal...`;
    window.setTimeout(() => {
      window.location.href = `${portal}?${details.toString()}`;
    }, 450);
  }
});

updateForm();
