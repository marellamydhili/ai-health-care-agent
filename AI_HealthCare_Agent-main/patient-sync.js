const patientQuery = new URLSearchParams(window.location.search);
const patientDisplayName = patientQuery.get('name');
const approvedBookings = JSON.parse(localStorage.getItem('carepointBookings') || '[]')
    .filter((booking) => booking.patient === patientDisplayName && booking.status === 'approved')
    .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')));
const approvedBooking = approvedBookings[0];

if (approvedBooking) {
    const doctorName = approvedBooking.doctorName || 'Assigned doctor';
    const appointmentDate = approvedBooking.date ?
        new Date(`${approvedBooking.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) :
        'Sep 08, 2026';
    const setIfExists = (selector, value) => {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
    };
    setIfExists('#appointment-type', approvedBooking.type || 'Consultation');
    setIfExists('#appointment-date', appointmentDate);
    setIfExists('#appointment-summary', `${appointmentDate} · ${approvedBooking.time || '02:00 PM'} · ${doctorName} · In person`);
    setIfExists('#appointment-doctor', doctorName);
    setIfExists('#booking-doctor', doctorName);
    setIfExists('#patient-chat-doctor', doctorName);
    setIfExists('#selected-doctor-name', doctorName);
    document.querySelectorAll('.record-doctor').forEach((element) => { element.textContent = doctorName; });
}