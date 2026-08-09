/* =====================================================================
   WELL NEST — script.js
   This file is organised top-to-bottom in the order things happen:
   1. Seed / demo data (and localStorage load-or-create)
   2. Small helpers (toast, formatting, element lookup)
   3. View + navigation routing (landing / auth / app shell)
   4. Auth: login + register validation
   5. Sidebar + subview switching, per role (patient / doctor / admin)
   6. Patient dashboard rendering (overview, doctors, appointments,
      records, prescriptions, notifications, profile)
   7. Booking modal (create appointment) + appointment actions
   8. Doctor dashboard rendering + actions
   9. Admin dashboard rendering (stats, charts, beds, billing)
   10. Shared UI wiring (modals, mobile menu, notifications bell, print)
   ===================================================================== */

/* --------------------------------------------------------------
   1. SEED DATA
   In a real app this would come from a Java/Spring Boot REST API.
   Here we seed localStorage once, then always read/write from it,
   so appointments and notifications survive a page refresh.
   -------------------------------------------------------------- */
const DB_KEY = 'wellnest_db_v1';

function seedDatabase(){
  return {
    doctors: [
      {id:'doc1', name:'Dr. Ananya Sharma', spec:'Cardiologist', dept:'Cardiology', exp:8, location:'Main Campus', rating:4.8, avail:'Today'},
      {id:'doc2', name:'Dr. Rahul Mehta', spec:'Dermatologist', dept:'Dermatology', exp:6, location:'North Wing', rating:4.6, avail:'This week'},
      {id:'doc3', name:'Dr. Priya Sen', spec:'General Physician', dept:'General Medicine', exp:10, location:'Main Campus', rating:4.9, avail:'Today'},
      {id:'doc4', name:'Dr. Karan Verma', spec:'Orthopedist', dept:'Orthopedics', exp:12, location:'South Wing', rating:4.7, avail:'This week'},
      {id:'doc5', name:'Dr. Neha Kapoor', spec:'Pediatrician', dept:'Pediatrics', exp:7, location:'North Wing', rating:4.8, avail:'Today'},
      {id:'doc6', name:'Dr. Arjun Nair', spec:'Neurologist', dept:'Neurology', exp:9, location:'Main Campus', rating:4.5, avail:'This week'}
    ],
    departments: [
      {name:'Cardiology', patients:210}, {name:'Dermatology', patients:130},
      {name:'General Medicine', patients:340}, {name:'Orthopedics', patients:180},
      {name:'Pediatrics', patients:250}, {name:'Neurology', patients:140}
    ],
    // every appointment references a doctorId and patientEmail so both
    // dashboards can filter the same underlying list
    appointments: [
      {id:'a1', doctorId:'doc1', patientName:'Rahul Sharma', patientEmail:'patient@demo.com', dept:'Cardiology', date:'2026-08-15', time:'10:30 AM', reason:'Routine heart checkup', status:'Confirmed'},
      {id:'a2', doctorId:'doc3', patientName:'Rahul Sharma', patientEmail:'patient@demo.com', dept:'General Medicine', date:'2026-07-20', time:'11:00 AM', reason:'Fever and cold', status:'Completed'},
      {id:'a3', doctorId:'doc2', patientName:'Rahul Sharma', patientEmail:'patient@demo.com', dept:'Dermatology', date:'2026-06-02', time:'3:00 PM', reason:'Skin rash', status:'Completed'},
      {id:'a4', doctorId:'doc1', patientName:'Isha Patel', patientEmail:'isha@demo.com', dept:'Cardiology', date:'2026-08-09', time:'9:00 AM', reason:'Chest pain follow-up', status:'Confirmed'},
      {id:'a5', doctorId:'doc1', patientName:'Meera Iyer', patientEmail:'meera@demo.com', dept:'Cardiology', date:'2026-08-09', time:'11:30 AM', reason:'Blood pressure review', status:'Pending'}
    ],
    records: [
      {date:'2026-08-12', title:'General Consultation', doctor:'Dr. Priya Sen', dept:'General Medicine', notes:'Mild seasonal cold. Advised rest and fluids.'},
      {date:'2026-08-05', title:'Blood Test', doctor:'City Diagnostic Centre', dept:'Pathology', notes:'CBC panel — results within normal range.'},
      {date:'2026-07-20', title:'Dental Consultation', doctor:'Dr. Rahul Mehta', dept:'Dental', notes:'Routine cleaning, no cavities found.'}
    ],
    prescriptions: [
      {id:'rx1', patient:'Rahul Sharma', patientEmail:'patient@demo.com', doctor:'Dr. Ananya Sharma', date:'2026-08-10',
        meds:[{name:'Medicine A', dosage:'1 tablet', freq:'Morning'},{name:'Medicine B', dosage:'1 tablet', freq:'Night'}],
        instructions:"Take medicines according to the doctor's instructions.", followup:'2026-08-20'}
    ],
    notifications: [
      {id:'n1', icon:'fa-calendar-check', text:'Your appointment with Dr. Ananya Sharma is tomorrow.', time:'2 hours ago', read:false},
      {id:'n2', icon:'fa-prescription-bottle-medical', text:'Your prescription has been updated.', time:'1 day ago', read:false},
      {id:'n3', icon:'fa-circle-check', text:'Your appointment has been confirmed.', time:'3 days ago', read:true}
    ],
    // demo accounts — a real backend would never store plaintext passwords
    users: [
      {name:'Rahul Sharma', email:'patient@demo.com', password:'patient123', role:'patient', phone:'98765 43210', dob:'1994-03-12'},
      {name:'Dr. Ananya Sharma', email:'doctor@demo.com', password:'doctor123', role:'doctor', doctorId:'doc1'},
      {name:'Admin User', email:'admin@demo.com', password:'admin123', role:'admin'}
    ],
    schedule: {} // doctorId -> {day: [slot,...]} populated lazily in Schedule tab
  };
}

function loadDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(raw){ try{ return JSON.parse(raw); }catch(e){ /* fall through to reseed */ } }
  const fresh = seedDatabase();
  localStorage.setItem(DB_KEY, JSON.stringify(fresh));
  return fresh;
}
function saveDB(){ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }

let DB = loadDB();
let currentUser = null; // set on login

/* --------------------------------------------------------------
   2. SMALL HELPERS
   -------------------------------------------------------------- */
const $  = (sel, scope=document) => scope.querySelector(sel);
const $$ = (sel, scope=document) => [...scope.querySelectorAll(sel)];

function showToast(message, icon='fa-circle-check'){
  const t = $('#toast');
  t.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=>t.classList.remove('show'), 2800);
}

function formatDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
}
function initials(name){
  return name.split(' ').filter(Boolean).slice(1,3).map(w=>w[0].toUpperCase()).join('');
}
function statusClass(status){
  return {Confirmed:'status-confirmed', Pending:'status-pending', Cancelled:'status-cancelled', Completed:'status-completed'}[status] || '';
}
function doctorById(id){ return DB.doctors.find(d=>d.id===id); }

/* --------------------------------------------------------------
   3. VIEW ROUTING
   Three top-level views live in #app: landing, auth, app-shell.
   data-nav="landing|auth" on any element switches between them.
   -------------------------------------------------------------- */
function goToView(name, {pushHistory=true} = {}){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $('#publicNav').style.display = (name==='app') ? 'none' : 'flex';
  window.scrollTo({top:0, behavior:'instant'});
  // record this view in browser history so the Back button can return to it,
  // instead of leaving the page entirely (this was the "stuck" bug)
  if(pushHistory) history.pushState({view:name}, '', '#'+name);
}

// when the user presses the browser/device Back button, replay whatever
// view is in that history entry instead of doing nothing
window.addEventListener('popstate', (e)=>{
  const name = e.state?.view || 'landing';
  // logging out of the app shell via Back should behave like a real logout
  if(name!=='app' && currentUser && $('#view-app').classList.contains('active')){
    currentUser = null;
  }
  goToView(name, {pushHistory:false});
});

document.addEventListener('click', (e)=>{
  const navBtn = e.target.closest('[data-nav]');
  if(navBtn){
    e.preventDefault();
    const target = navBtn.dataset.nav;
    goToView(target);
    if(target==='auth' && navBtn.dataset.authmode){
      setAuthMode(navBtn.dataset.authmode);
      if(navBtn.dataset.role) $('#regRole').value = navBtn.dataset.role;
    }
  }
  // smooth-scroll helper used by "Find a doctor" button on the hero
  const scrollBtn = e.target.closest('[data-scroll]');
  if(scrollBtn){
    document.getElementById(scrollBtn.dataset.scroll)?.scrollIntoView({behavior:'smooth'});
  }
});

/* mobile hamburger for the public nav */
$('#publicNavToggle').addEventListener('click', ()=> $('#publicNavLinks').classList.toggle('open'));

/* --------------------------------------------------------------
   4. AUTH — login + register, both with inline validation
   -------------------------------------------------------------- */
function setAuthMode(mode){
  $$('.auth-tab').forEach(t=>t.classList.toggle('active', t.dataset.authmode===mode));
  $('#loginForm').classList.toggle('hidden', mode!=='login');
  $('#registerForm').classList.toggle('hidden', mode!=='register');
}
$$('[data-authmode]').forEach(el=>{
  el.addEventListener('click', (e)=>{ if(el.tagName!=='BUTTON' || el.closest('.public-nav')===null){ e.preventDefault(); } setAuthMode(el.dataset.authmode); });
});

function setFieldError(id, message){
  const input = $('#'+id);
  const err = $('#err-'+id);
  if(err) err.textContent = message || '';
  if(input) input.classList.toggle('invalid', !!message);
  return !message; // returns true when the field is VALID
}

/* ---- Login ---- */
$('#loginForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const id = $('#loginId').value.trim();
  const pw = $('#loginPassword').value;
  const role = $('#loginRole').value;

  let ok = true;
  ok = setFieldError('loginId', id ? '' : 'Please enter your email or username') && ok;
  ok = setFieldError('loginPassword', pw ? '' : 'Please enter your password') && ok;
  if(!ok) return;

  // demo auth: match against seeded users, else auto-create a session
  // for that role so every part of the prototype stays reachable
  let user = DB.users.find(u => u.email.toLowerCase()===id.toLowerCase() && u.password===pw);
  if(!user){
    user = DB.users.find(u => u.email.toLowerCase()===id.toLowerCase());
    if(user && user.password!==pw){ setFieldError('loginPassword','Incorrect password'); return; }
    if(!user){
      // unknown id — sign them in as a fresh demo user of the chosen role
      user = {name: id.includes('@') ? id.split('@')[0] : id, email:id, role};
    }
  }
  logInAs(user);
});

/* ---- Register ---- */
$('#registerForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = $('#regName').value.trim();
  const email = $('#regEmail').value.trim();
  const phone = $('#regPhone').value.trim();
  const dob = $('#regDob').value;
  const pw = $('#regPassword').value;
  const confirm = $('#regConfirmPassword').value;
  const role = $('#regRole').value;

  let ok = true;
  ok = setFieldError('regName', name ? '' : 'Full name is required') && ok;
  ok = setFieldError('regEmail', /^\S+@\S+\.\S+$/.test(email) ? '' : 'Enter a valid email address') && ok;
  ok = setFieldError('regPhone', /^[\d\s+-]{7,15}$/.test(phone) ? '' : 'Enter a valid phone number') && ok;
  ok = setFieldError('regDob', dob ? '' : 'Date of birth is required') && ok;
  ok = setFieldError('regPassword', pw.length>=6 ? '' : 'Password must be at least 6 characters') && ok;
  ok = setFieldError('regConfirmPassword', pw===confirm ? '' : "Passwords don't match") && ok;
  if(!ok) return;

  const newUser = {name, email, phone, dob, password:pw, role};
  DB.users.push(newUser);
  saveDB();
  showToast('Account created — welcome to Well Nest');
  logInAs(newUser);
});

$('#forgotPasswordLink').addEventListener('click', (e)=>{
  e.preventDefault();
  showToast('Password reset link sent (demo only)', 'fa-envelope');
});

function logInAs(user){
  currentUser = user;
  goToView('app');
  applyRole(user.role || 'patient');
  $('#topbarAvatar').textContent = initials(user.name || user.email);
  $('#topbarUsername').textContent = user.name || user.email;
}

/* --------------------------------------------------------------
   5. SIDEBAR + SUBVIEW SWITCHING (role-aware)
   -------------------------------------------------------------- */
function applyRole(role){
  $$('.side-nav').forEach(nav => nav.classList.toggle('hidden', nav.dataset.roleNav !== role));
  $$('.subview').forEach(sv => sv.classList.toggle('hidden', sv.dataset.role !== role));
  // activate the first sub-view for this role
  const firstNav = $(`.side-nav[data-role-nav="${role}"] .side-link`);
  if(firstNav) activateSub(firstNav.dataset.sub, role);
  renderAll(role);
}

function activateSub(subId, role){
  $$(`.side-nav[data-role-nav="${role}"] .side-link`).forEach(l=>l.classList.toggle('active', l.dataset.sub===subId));
  $$('.subview').forEach(sv => sv.classList.toggle('hidden', sv.id !== `sub-${subId}`));
  const label = $(`.side-nav[data-role-nav="${role}"] .side-link[data-sub="${subId}"]`)?.textContent.trim();
  if(label) $('#topbarTitle').textContent = label;
  closeSidebarOnMobile();
}

document.addEventListener('click', (e)=>{
  const link = e.target.closest('.side-link[data-sub]');
  if(link){ e.preventDefault(); activateSub(link.dataset.sub, currentUser.role); }
});

/* --------------------------------------------------------------
   6. PATIENT DASHBOARD RENDERING
   -------------------------------------------------------------- */
function myAppointments(){
  return DB.appointments.filter(a => a.patientEmail === currentUser.email || a.patientName === currentUser.name);
}

function renderPatientOverview(){
  const mine = myAppointments();
  const upcoming = mine.filter(a => a.status!=='Completed' && a.status!=='Cancelled');
  const previous = mine.filter(a => a.status==='Completed' || a.status==='Cancelled');
  $('#statUpcoming').textContent = upcoming.length;
  $('#statPrevious').textContent = previous.length;
  $('#statRecords').textContent = DB.records.length;
  $('#statPrescriptions').textContent = DB.prescriptions.length;

  const next = upcoming.sort((a,b)=> a.date.localeCompare(b.date))[0];
  const card = $('#nextAppointmentCard');
  if(!next){ card.innerHTML = `<p style="color:#B9CDC1;margin:0">No upcoming appointments — book one from "Find Doctors".</p>`; return; }
  const doc = doctorById(next.doctorId);
  card.innerHTML = `
    <div class="info">
      <strong>${doc?.name || 'Doctor'}</strong>
      <span>${doc?.spec || next.dept} · ${formatDate(next.date)} · ${next.time}</span>
    </div>
    <div class="actions">
      <span class="status-pill">${next.status}</span>
      <button class="btn btn-ghost btn-sm" style="color:var(--sage);border-color:rgba(255,255,255,.4)" data-view-appt="${next.id}">View Details</button>
    </div>`;
}

function populateDoctorFilters(){
  const specSel = $('#docSpecFilter'), locSel = $('#docLocFilter');
  const specs = [...new Set(DB.doctors.map(d=>d.spec))];
  const locs = [...new Set(DB.doctors.map(d=>d.location))];
  specSel.innerHTML = '<option value="">All specializations</option>' + specs.map(s=>`<option value="${s}">${s}</option>`).join('');
  locSel.innerHTML = '<option value="">All locations</option>' + locs.map(l=>`<option value="${l}">${l}</option>`).join('');
}

function doctorCardHTML(doc, {bookable=true} = {}){
  return `
    <div class="doctor-card" data-doctor-id="${doc.id}">
      <div class="doctor-avatar">${initials(doc.name)}</div>
      <h3>${doc.name}</h3>
      <div class="doctor-spec">${doc.spec}</div>
      <div class="doctor-meta">${doc.exp} years experience · ${doc.location}</div>
      <div class="doctor-rating">${'★'.repeat(Math.round(doc.rating))}${'☆'.repeat(5-Math.round(doc.rating))} ${doc.rating}</div>
      <div class="doctor-actions">
        <button class="btn-outline-sm" data-view-doctor="${doc.id}">View Profile</button>
        ${bookable ? `<button class="btn btn-primary btn-sm" data-book-doctor="${doc.id}">Book Appointment</button>` : ''}
      </div>
    </div>`;
}

function renderLandingDoctors(){
  $('#landingDoctorGrid').innerHTML = DB.doctors.slice(0,3).map(d=>doctorCardHTML(d,{bookable:false})).join('');
}

function renderDoctorSearch(){
  const q = $('#docSearchInput').value.trim().toLowerCase();
  const spec = $('#docSpecFilter').value;
  const loc = $('#docLocFilter').value;
  const avail = $('#docAvailFilter').value;
  const filtered = DB.doctors.filter(d =>
    (!q || d.name.toLowerCase().includes(q)) &&
    (!spec || d.spec===spec) &&
    (!loc || d.location===loc) &&
    (!avail || d.avail===avail)
  );
  const grid = $('#doctorSearchGrid');
  grid.innerHTML = filtered.length ? filtered.map(d=>doctorCardHTML(d)).join('')
    : `<div class="empty-state">No doctors match your filters. Try widening your search.</div>`;
}
['docSearchInput','docSpecFilter','docLocFilter','docAvailFilter'].forEach(id=>{
  document.addEventListener('input', (e)=>{ if(e.target.id===id) renderDoctorSearch(); });
  document.addEventListener('change', (e)=>{ if(e.target.id===id) renderDoctorSearch(); });
});

function apptRowHTML(a){
  const doc = doctorById(a.doctorId);
  const canCancel = a.status==='Confirmed' || a.status==='Pending';
  return `
    <tr>
      <td>${doc?.name || '—'}</td>
      <td>${a.dept}</td>
      <td>${formatDate(a.date)}</td>
      <td>${a.time}</td>
      <td><span class="status-pill ${statusClass(a.status)}">${a.status}</span></td>
      <td><div class="row-actions">
        <button class="btn-outline-sm" data-view-appt="${a.id}">View</button>
        ${canCancel ? `<button class="btn-outline-sm" style="color:var(--clay);border-color:var(--clay)" data-cancel-appt="${a.id}">Cancel</button>` : ''}
      </div></td>
    </tr>`;
}

function renderPatientAppointments(){
  const mine = myAppointments();
  const upcoming = mine.filter(a => a.status!=='Completed' && a.status!=='Cancelled').sort((a,b)=>a.date.localeCompare(b.date));
  const previous = mine.filter(a => a.status==='Completed' || a.status==='Cancelled').sort((a,b)=>b.date.localeCompare(a.date));
  $('#apptTableUpcoming tbody').innerHTML = upcoming.map(apptRowHTML).join('') || `<tr><td colspan="6" class="muted">No upcoming appointments.</td></tr>`;
  $('#apptTablePrevious tbody').innerHTML = previous.map(apptRowHTML).join('') || `<tr><td colspan="6" class="muted">No previous appointments yet.</td></tr>`;
}

function renderRecords(){
  $('#recordsTimeline').innerHTML = DB.records.map(r=>`
    <div class="timeline-item">
      <span class="timeline-date">${formatDate(r.date)}</span>
      <h4>${r.title}</h4>
      <p>${r.doctor} · ${r.dept}<br>${r.notes}</p>
      <button class="btn-outline-sm" data-view-record="${r.date}">View Report</button>
    </div>`).join('');
}

function prescriptionCardHTML(rx, {printable=true} = {}){
  return `
    <div class="rx-card">
      <div class="rx-head">
        <div><span>Patient</span><strong>${rx.patient}</strong></div>
        <div><span>Doctor</span><strong>${rx.doctor}</strong></div>
        <div><span>Date</span><strong>${formatDate(rx.date)}</strong></div>
      </div>
      ${rx.meds.map(m=>`<div class="rx-med"><span>${m.name}</span><span>${m.dosage} · ${m.freq}</span></div>`).join('')}
      <p style="margin-top:14px"><strong>Instructions:</strong> ${rx.instructions}</p>
      <div class="rx-footer">
        <span class="muted">Follow-up: ${formatDate(rx.followup)}</span>
        ${printable ? `<button class="btn btn-primary btn-sm" data-print-rx="${rx.id}"><i class="fa-solid fa-print"></i> Print Prescription</button>` : ''}
      </div>
    </div>`;
}
function renderPrescriptions(){
  // show only prescriptions that belong to the logged-in patient's account
  const mine = DB.prescriptions.filter(rx => rx.patientEmail === currentUser.email);
  $('#prescriptionList').innerHTML = mine.length ? mine.map(rx=>prescriptionCardHTML(rx)).join('')
    : `<div class="empty-state">No prescriptions on file yet for ${currentUser.name}.</div>`;
}

function notifBadgeCount(){ return DB.notifications.filter(n=>!n.read).length; }
function renderNotifBadge(){
  const count = notifBadgeCount();
  $('#patientNotifBadge').textContent = count || '';
  $('#bellDot').style.display = count ? 'block' : 'none';
}
function renderNotifDropdown(){
  const list = DB.notifications;
  $('#notifDropdown').innerHTML = list.length ? list.map(n=>`
    <div class="notif-item ${n.read?'':'unread'}" data-mark-read="${n.id}">
      <i class="fa-solid ${n.icon}"></i>
      <div>${n.text}<span class="notif-time">${n.time}</span></div>
    </div>`).join('') : `<div class="notif-empty">You're all caught up.</div>`;
}
function renderNotifPage(){
  $('#notifListPage').innerHTML = DB.notifications.map(n=>`
    <div class="notif-row ${n.read?'':'unread'}" data-mark-read="${n.id}">
      <i class="fa-solid ${n.icon}"></i>
      <div>${n.text}<span class="time">${n.time}</span></div>
    </div>`).join('');
}
document.addEventListener('click', (e)=>{
  const item = e.target.closest('[data-mark-read]');
  if(item){
    const n = DB.notifications.find(x=>x.id===item.dataset.markRead);
    if(n){ n.read = true; saveDB(); renderNotifBadge(); renderNotifDropdown(); renderNotifPage(); }
  }
});

function renderPatientProfile(){
  $('#patientProfileCard').innerHTML = `
    <h3>${currentUser.name}</h3>
    <div class="profile-row"><span>Email</span><span>${currentUser.email}</span></div>
    <div class="profile-row"><span>Phone</span><span>${currentUser.phone || '—'}</span></div>
    <div class="profile-row"><span>Date of birth</span><span>${currentUser.dob ? formatDate(currentUser.dob) : '—'}</span></div>
    <div class="profile-row"><span>Role</span><span>Patient</span></div>`;
}

/* --------------------------------------------------------------
   7. BOOKING MODAL + APPOINTMENT ACTIONS
   -------------------------------------------------------------- */
const SLOT_TEMPLATE = ['9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','2:00 PM','2:30 PM','3:00 PM','4:00 PM'];

function openModal(id){ $('#'+id).classList.remove('hidden'); }
function closeModal(id){ $('#'+id).classList.add('hidden'); }
document.addEventListener('click', (e)=>{
  const closer = e.target.closest('[data-close-modal]');
  if(closer) closeModal(closer.dataset.closeModal);
  if(e.target.classList.contains('modal-backdrop')) e.target.classList.add('hidden');
});

function openBookingModal(doctorId){
  const sel = $('#bookDoctor');
  sel.innerHTML = DB.doctors.map(d=>`<option value="${d.id}">${d.name} — ${d.spec}</option>`).join('');
  sel.value = doctorId || DB.doctors[0].id;
  updateBookDept();
  $('#bookDate').value = '';
  $('#bookSlot').innerHTML = '<option value="">Select a date first</option>';
  $('#bookReason').value = '';
  ['bookDate','bookSlot','bookReason'].forEach(id=>setFieldError(id,''));
  openModal('bookingModal');
}
function updateBookDept(){
  const doc = doctorById($('#bookDoctor').value);
  $('#bookDepartment').value = doc ? doc.dept : '';
}
$('#bookDoctor').addEventListener('change', updateBookDept);

$('#bookDate').addEventListener('change', ()=>{
  // "available" slots = template slots minus ones already booked with this doctor on this date
  const doctorId = $('#bookDoctor').value;
  const date = $('#bookDate').value;
  const taken = DB.appointments.filter(a=>a.doctorId===doctorId && a.date===date && a.status!=='Cancelled').map(a=>a.time);
  const free = SLOT_TEMPLATE.filter(s=>!taken.includes(s));
  const slotSel = $('#bookSlot');
  slotSel.innerHTML = free.length ? free.map(s=>`<option value="${s}">${s}</option>`).join('') : '<option value="">No slots available that day</option>';
});

$('#bookingForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const doctorId = $('#bookDoctor').value;
  const date = $('#bookDate').value;
  const slot = $('#bookSlot').value;
  const reason = $('#bookReason').value.trim();

  const todayISO = new Date().toISOString().slice(0,10);
  let ok = true;
  ok = setFieldError('bookDate', date ? (date>=todayISO ? '' : 'Choose today or a future date') : 'Please choose a date') && ok;
  ok = setFieldError('bookSlot', slot ? '' : 'Please choose an available time slot') && ok;
  ok = setFieldError('bookReason', reason ? '' : 'Please add a brief reason for the visit') && ok;
  if(!ok) return;

  const doc = doctorById(doctorId);
  const appt = {
    id: 'a' + Date.now(),
    doctorId, patientName: currentUser.name, patientEmail: currentUser.email,
    dept: doc.dept, date, time: slot, reason, status:'Confirmed'
  };
  DB.appointments.push(appt);
  DB.notifications.unshift({id:'n'+Date.now(), icon:'fa-calendar-check', text:`Your appointment with ${doc.name} is confirmed for ${formatDate(date)}.`, time:'Just now', read:false});
  saveDB();
  closeModal('bookingModal');
  showToast('Appointment booked successfully');
  renderAll(currentUser.role);
});

document.addEventListener('click', (e)=>{
  const bookBtn = e.target.closest('[data-book-doctor]');
  if(bookBtn) openBookingModal(bookBtn.dataset.bookDoctor);

  const viewApptBtn = e.target.closest('[data-view-appt]');
  if(viewApptBtn){
    const a = DB.appointments.find(x=>x.id===viewApptBtn.dataset.viewAppt);
    const doc = doctorById(a.doctorId);
    $('#detailsModalBody').innerHTML = `
      <div class="detail-row"><span>Doctor</span><span>${doc?.name}</span></div>
      <div class="detail-row"><span>Specialization</span><span>${doc?.spec}</span></div>
      <div class="detail-row"><span>Date</span><span>${formatDate(a.date)}</span></div>
      <div class="detail-row"><span>Time</span><span>${a.time}</span></div>
      <div class="detail-row"><span>Reason</span><span>${a.reason}</span></div>
      <div class="detail-row"><span>Status</span><span class="status-pill ${statusClass(a.status)}">${a.status}</span></div>`;
    openModal('detailsModal');
  }

  const cancelBtn = e.target.closest('[data-cancel-appt]');
  if(cancelBtn){
    const a = DB.appointments.find(x=>x.id===cancelBtn.dataset.cancelAppt);
    if(a && confirm('Cancel this appointment?')){
      a.status = 'Cancelled';
      saveDB();
      showToast('Appointment cancelled', 'fa-circle-xmark');
      renderAll(currentUser.role);
    }
  }

  const viewDocBtn = e.target.closest('[data-view-doctor]');
  if(viewDocBtn){
    const d = doctorById(viewDocBtn.dataset.viewDoctor);
    $('#detailsModalBody').innerHTML = `
      <div class="detail-row"><span>Name</span><span>${d.name}</span></div>
      <div class="detail-row"><span>Specialization</span><span>${d.spec}</span></div>
      <div class="detail-row"><span>Experience</span><span>${d.exp} years</span></div>
      <div class="detail-row"><span>Location</span><span>${d.location}</span></div>
      <div class="detail-row"><span>Rating</span><span>${d.rating} / 5</span></div>
      <div class="detail-row"><span>Availability</span><span>${d.avail}</span></div>`;
    $('#detailsModal h3').textContent = 'Doctor profile';
    openModal('detailsModal');
  }

  const printRxBtn = e.target.closest('[data-print-rx]');
  if(printRxBtn) printPrescription(printRxBtn.dataset.printRx);
});

function printPrescription(rxId){
  const rx = DB.prescriptions.find(r=>r.id===rxId);
  if(!rx) return;
  $('#printArea').innerHTML = `
    <h2>Well Nest — Prescription</h2>
    <p><strong>Patient:</strong> ${rx.patient}<br><strong>Doctor:</strong> ${rx.doctor}<br><strong>Date:</strong> ${formatDate(rx.date)}</p>
    <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
      <tr><th>Medicine</th><th>Dosage</th><th>Frequency</th></tr>
      ${rx.meds.map(m=>`<tr><td>${m.name}</td><td>${m.dosage}</td><td>${m.freq}</td></tr>`).join('')}
    </table>
    <p><strong>Instructions:</strong> ${rx.instructions}</p>
    <p><strong>Follow-up:</strong> ${formatDate(rx.followup)}</p>`;
  window.print();
}

/* --------------------------------------------------------------
   8. DOCTOR DASHBOARD
   -------------------------------------------------------------- */
function myDoctorId(){ return currentUser.doctorId || DB.doctors[0].id; }
function doctorAppointments(){ return DB.appointments.filter(a=>a.doctorId===myDoctorId()); }

function renderDoctorOverview(){
  const appts = doctorAppointments();
  const todayISO = new Date().toISOString().slice(0,10);
  const today = appts.filter(a=>a.date===todayISO);
  const patients = new Set(appts.map(a=>a.patientEmail));
  $('#dStatToday').textContent = today.length || appts.filter(a=>a.date==='2026-08-09').length;
  $('#dStatPatients').textContent = patients.size;
  $('#dStatCompleted').textContent = appts.filter(a=>a.status==='Completed').length;
  $('#dStatPending').textContent = appts.filter(a=>a.status==='Pending'||a.status==='Confirmed').length;

  const rows = (today.length ? today : appts.filter(a=>a.date==='2026-08-09'));
  $('#doctorTodayTable tbody').innerHTML = rows.map(a=>`
    <tr>
      <td>${a.patientName}</td><td>${a.time}</td><td>${a.reason}</td>
      <td><span class="status-pill ${statusClass(a.status)}">${a.status}</span></td>
      <td><div class="row-actions">
        ${a.status!=='Completed' ? `<button class="btn-outline-sm" data-complete-appt="${a.id}">Mark Completed</button>` : ''}
        <button class="btn-outline-sm" data-view-appt="${a.id}">View</button>
      </div></td>
    </tr>`).join('') || `<tr><td colspan="5" class="muted">No appointments scheduled for today.</td></tr>`;
}

function renderDoctorAppointments(){
  const appts = doctorAppointments().sort((a,b)=>b.date.localeCompare(a.date));
  $('#doctorApptTable tbody').innerHTML = appts.map(a=>`
    <tr>
      <td>${a.patientName}</td><td>${formatDate(a.date)}</td><td>${a.time}</td><td>${a.reason}</td>
      <td><span class="status-pill ${statusClass(a.status)}">${a.status}</span></td>
      <td><div class="row-actions">
        ${a.status!=='Completed' ? `<button class="btn-outline-sm" data-complete-appt="${a.id}">Mark Completed</button>` : ''}
        <button class="btn-outline-sm" data-view-appt="${a.id}">View</button>
      </div></td>
    </tr>`).join('');
}

function renderDoctorPatients(){
  const names = [...new Map(doctorAppointments().map(a=>[a.patientEmail, a])).values()];
  $('#doctorPatientGrid').innerHTML = names.map(a=>`
    <div class="doctor-card">
      <div class="doctor-avatar">${initials(a.patientName)}</div>
      <h3>${a.patientName}</h3>
      <div class="doctor-meta">${a.patientEmail}</div>
      <div class="doctor-actions">
        <button class="btn-outline-sm" data-view-appt="${a.id}">Last visit</button>
        <button class="btn btn-primary btn-sm" data-new-rx-for="${a.patientEmail}">Prescribe</button>
      </div>
    </div>`).join('') || `<div class="empty-state">No patients yet.</div>`;
}

function renderDoctorRecords(){
  $('#doctorRecordsTimeline').innerHTML = DB.records.map(r=>`
    <div class="timeline-item">
      <span class="timeline-date">${formatDate(r.date)}</span>
      <h4>${r.title}</h4>
      <p>${r.doctor} · ${r.dept}<br>${r.notes}</p>
    </div>`).join('');
}

function renderDoctorPrescriptions(){
  $('#doctorPrescriptionList').innerHTML = DB.prescriptions.map(rx=>prescriptionCardHTML(rx)).join('') || `<div class="empty-state">No prescriptions written yet.</div>`;
}

function renderSchedule(){
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  const docId = myDoctorId();
  DB.schedule[docId] = DB.schedule[docId] || days.flatMap(d=>SLOT_TEMPLATE.slice(0,4).map(s=>`${d} ${s}`)).reduce((acc,k)=>({...acc,[k]:true}),{});
  const entries = Object.keys(DB.schedule[docId]);
  $('#scheduleGrid').innerHTML = entries.map(key=>`
    <button type="button" class="slot-toggle ${DB.schedule[docId][key] ? 'on':''}" data-slot-key="${key}">${key}</button>`).join('');
}
document.addEventListener('click', (e)=>{
  const slot = e.target.closest('[data-slot-key]');
  if(slot){
    const docId = myDoctorId();
    const key = slot.dataset.slotKey;
    DB.schedule[docId][key] = !DB.schedule[docId][key];
    saveDB();
    slot.classList.toggle('on');
  }
});

function renderDoctorProfile(){
  const doc = doctorById(myDoctorId());
  $('#doctorProfileCard').innerHTML = `
    <h3>${currentUser.name}</h3>
    <div class="profile-row"><span>Specialization</span><span>${doc?.spec || '—'}</span></div>
    <div class="profile-row"><span>Department</span><span>${doc?.dept || '—'}</span></div>
    <div class="profile-row"><span>Experience</span><span>${doc?.exp || '—'} years</span></div>
    <div class="profile-row"><span>Location</span><span>${doc?.location || '—'}</span></div>
    <div class="profile-row"><span>Role</span><span>Doctor</span></div>`;
}

document.addEventListener('click', (e)=>{
  const completeBtn = e.target.closest('[data-complete-appt]');
  if(completeBtn){
    const a = DB.appointments.find(x=>x.id===completeBtn.dataset.completeAppt);
    if(a){ a.status='Completed'; saveDB(); showToast('Appointment marked completed'); renderAll('doctor'); }
  }
  const newRxFor = e.target.closest('[data-new-rx-for]');
  if(newRxFor) openPrescriptionModal(newRxFor.dataset.newRxFor);
});

$('#newPrescriptionBtn').addEventListener('click', ()=>openPrescriptionModal());
function openPrescriptionModal(patientEmail){
  // build the dropdown from this doctor's actual patients (email = value, name = label)
  // so the saved prescription links to the right account, not just a typed name
  const patients = [...new Map(doctorAppointments().map(a=>[a.patientEmail, a.patientName])).entries()];
  $('#rxPatient').innerHTML = patients.length
    ? patients.map(([email,name])=>`<option value="${email}" ${email===patientEmail?'selected':''}>${name}</option>`).join('')
    : `<option value="${currentUser.email}">${currentUser.name}</option>`;
  $('#prescriptionForm').reset();
  if(patientEmail) $('#rxPatient').value = patientEmail;
  openModal('prescriptionModal');
}
$('#prescriptionForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const patientEmail = $('#rxPatient').value;
  const patientName = $('#rxPatient').selectedOptions[0]?.textContent || patientEmail;
  const rx = {
    id:'rx'+Date.now(),
    patient: patientName,
    patientEmail: patientEmail,
    doctor: currentUser.name,
    date: new Date().toISOString().slice(0,10),
    meds:[{name:$('#rxMedName').value || 'Medicine', dosage:$('#rxDosage').value || '1 tablet', freq:$('#rxFrequency').value || 'As needed'}],
    instructions: $('#rxInstructions').value || "Take medicines according to the doctor's instructions.",
    followup: $('#rxFollowup').value || new Date().toISOString().slice(0,10)
  };
  DB.prescriptions.unshift(rx);
  saveDB();
  closeModal('prescriptionModal');
  showToast('Prescription saved');
  renderAll('doctor');
});

/* --------------------------------------------------------------
   9. ADMIN DASHBOARD (stats, lightweight charts, beds, billing)
   -------------------------------------------------------------- */
function renderAdminOverview(){
  const monthly = [42,55,60,48,70,86]; // Mar–Aug demo counts
  const months = ['Mar','Apr','May','Jun','Jul','Aug'];
  const max = Math.max(...monthly);
  const barsHTML = monthly.map((v,i)=>`
    <div class="bar-col"><div class="bar" style="height:${(v/max*100)}%"></div><span class="bar-label">${months[i]}</span></div>`).join('');
  $('#chartMonthly').innerHTML = barsHTML;
  $('#chartMonthly2').innerHTML = barsHTML;

  // donut: completed vs cancelled, drawn as two SVG arcs via stroke-dasharray
  const completed = 74, cancelled = 12, pending = 14; // percent
  const donut = $('#chartDonut');
  const r = 50, c = 2*Math.PI*r;
  let offset = 0;
  const seg = (value, color) => {
    const len = c*value/100;
    const circle = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${len} ${c-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;
    offset += len;
    return circle;
  };
  donut.innerHTML = seg(completed,'#4F8F73') + seg(pending,'#E8A33D') + seg(cancelled,'#C96A4E');
  $('#donutLegend').innerHTML = `
    <li><span class="swatch" style="background:#4F8F73"></span>Completed — ${completed}%</li>
    <li><span class="swatch" style="background:#E8A33D"></span>Pending — ${pending}%</li>
    <li><span class="swatch" style="background:#C96A4E"></span>Cancelled — ${cancelled}%</li>`;

  const maxDept = Math.max(...DB.departments.map(d=>d.patients));
  $('#chartDept').innerHTML = DB.departments.map(d=>`
    <div class="bar-col">
      <span class="bar-label">${d.name}</span>
      <div class="hbar-track"><div class="bar" style="width:${(d.patients/maxDept*100)}%"></div></div>
    </div>`).join('');
}

function renderAdminPatients(){
  const rows = [
    {name:'Rahul Sharma', age:32, contact:'98765 43210', last:'2026-08-12', doc:'Dr. Priya Sen'},
    {name:'Isha Patel', age:28, contact:'91234 56780', last:'2026-08-09', doc:'Dr. Ananya Sharma'},
    {name:'Meera Iyer', age:45, contact:'99887 66554', last:'2026-08-09', doc:'Dr. Ananya Sharma'},
    {name:'Karthik Rao', age:51, contact:'90011 22334', last:'2026-07-28', doc:'Dr. Karan Verma'}
  ];
  $('#adminPatientTable tbody').innerHTML = rows.map(p=>`
    <tr><td>${p.name}</td><td>${p.age}</td><td>${p.contact}</td><td>${formatDate(p.last)}</td><td>${p.doc}</td></tr>`).join('');
}
function renderAdminDoctors(){ $('#adminDoctorGrid').innerHTML = DB.doctors.map(d=>doctorCardHTML(d,{bookable:false})).join(''); }
function renderAdminDepartments(){
  $('#adminDeptGrid').innerHTML = DB.departments.map(d=>`
    <div class="service-card"><i class="fa-solid fa-hospital"></i><h3>${d.name}</h3><p>${d.patients} patients under care</p></div>`).join('');
}
function renderAdminAppointments(){
  $('#adminApptTable tbody').innerHTML = DB.appointments.map(a=>{
    const doc = doctorById(a.doctorId);
    return `<tr><td>${a.patientName}</td><td>${doc?.name}</td><td>${a.dept}</td><td>${formatDate(a.date)}</td><td>${a.time}</td>
      <td><span class="status-pill ${statusClass(a.status)}">${a.status}</span></td></tr>`;
  }).join('');
}
function renderInvoice(){
  const items = [{label:'Consultation', amount:500},{label:'Blood Test', amount:300},{label:'Medical Report', amount:150}];
  const total = items.reduce((s,i)=>s+i.amount,0);
  $('#invoiceCard').innerHTML = `
    <div class="invoice-head">
      <div><span>Invoice #</span><strong>WN-2026-0842</strong></div>
      <div><span>Date</span><strong>${formatDate('2026-08-09')}</strong></div>
    </div>
    <p><strong>Patient:</strong> Rahul Sharma</p>
    ${items.map(i=>`<div class="invoice-line"><span>${i.label}</span><span>₹${i.amount}</span></div>`).join('')}
    <div class="invoice-total"><span>Total</span><span>₹${total}</span></div>
    <button class="btn btn-primary btn-block" style="margin-top:20px" id="printInvoiceBtn"><i class="fa-solid fa-print"></i> Print Invoice</button>`;
  $('#printInvoiceBtn').addEventListener('click', ()=>{
    $('#printArea').innerHTML = $('#invoiceCard').innerHTML.replace(/<button.*<\/button>/,'');
    $('#printArea').insertAdjacentHTML('afterbegin', '<h2>Well Nest — Invoice</h2>');
    window.print();
  });
}

/* --------------------------------------------------------------
   10. SHARED UI WIRING
   -------------------------------------------------------------- */
// tabs (patient appointments: upcoming / previous)
document.addEventListener('click', (e)=>{
  const tab = e.target.closest('.tab');
  if(tab){
    $$('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    $('#apptTableUpcoming').closest('.table-wrap').classList.toggle('hidden', tab.dataset.tab!=='upcoming');
    $('#apptTableWrapPrevious').classList.toggle('hidden', tab.dataset.tab!=='previous');
  }
});

// mobile sidebar
function closeSidebarOnMobile(){
  $('#sidebar').classList.remove('open');
  $('#sidebarOverlay').classList.remove('show');
}
$('#sidebarToggle').addEventListener('click', ()=>{
  $('#sidebar').classList.add('open');
  $('#sidebarOverlay').classList.add('show');
});
$('#sidebarOverlay').addEventListener('click', closeSidebarOnMobile);

// notifications bell dropdown
$('#bellBtn').addEventListener('click', (e)=>{
  e.stopPropagation();
  $('#notifDropdown').classList.toggle('hidden');
});
document.addEventListener('click', ()=> $('#notifDropdown').classList.add('hidden'));
$('#notifDropdown').addEventListener('click', e=>e.stopPropagation());

// logout with confirmation
$('#logoutBtn').addEventListener('click', ()=>openModal('logoutModal'));
$('#confirmLogoutBtn').addEventListener('click', ()=>{
  closeModal('logoutModal');
  currentUser = null;
  goToView('landing');
  showToast('You have been logged out', 'fa-arrow-right-from-bracket');
});

/* --------------------------------------------------------------
   MASTER RENDER — called on login and after any data change
   -------------------------------------------------------------- */
function renderAll(role){
  populateDoctorFilters();
  renderNotifBadge();
  renderNotifDropdown();
  renderNotifPage();

  if(role==='patient'){
    renderPatientOverview();
    renderDoctorSearch();
    renderPatientAppointments();
    renderRecords();
    renderPrescriptions();
    renderPatientProfile();
  }
  if(role==='doctor'){
    renderDoctorOverview();
    renderDoctorAppointments();
    renderDoctorPatients();
    renderDoctorRecords();
    renderDoctorPrescriptions();
    renderSchedule();
    renderDoctorProfile();
  }
  if(role==='admin'){
    renderAdminOverview();
    renderAdminPatients();
    renderAdminDoctors();
    renderAdminDepartments();
    renderAdminAppointments();
    renderInvoice();
  }
}

/* --------------------------------------------------------------
   INITIAL PAGE LOAD
   -------------------------------------------------------------- */
renderLandingDoctors();
history.replaceState({view:'landing'}, '', '#landing');
goToView('landing', {pushHistory:false});