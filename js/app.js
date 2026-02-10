import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'

const firebaseConfiguration = {
  apiKey: 'AIzaSyA-wqdvLVBIhHfdMTjRdObSAGrbJFhHoEo',
  authDomain: 'autotrack-a6dff.firebaseapp.com',
  projectId: 'autotrack-a6dff',
  storageBucket: 'autotrack-a6dff.firebasestorage.app',
  messagingSenderId: '448195063700',
  appId: '1:448195063700:web:e9215305235ed2a7512981',
  measurementId: 'G-KHDYP2KJJ2'
}

const responsibleEmailAddress = 'responsible@autotrack.local'
const vehicleNumbers = ['A001AA', 'A002AA', 'A003AA', 'A004AA', 'A005AA']

const application = initializeApp(firebaseConfiguration)
const authentication = getAuth(application)
const database = getFirestore(application)
const googleProvider = new GoogleAuthProvider()

const elements = {
  authStatus: document.getElementById('authStatus'),
  emailAuthForm: document.getElementById('emailAuthForm'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  emailLoginButton: document.getElementById('emailLoginButton'),
  emailRegisterButton: document.getElementById('emailRegisterButton'),
  googleLoginButton: document.getElementById('googleLoginButton'),
  guestLoginButton: document.getElementById('guestLoginButton'),
  logoutButton: document.getElementById('logoutButton'),
  tripCard: document.getElementById('tripCard'),
  tripForm: document.getElementById('tripForm'),
  driverFullNameInput: document.getElementById('driverFullNameInput'),
  tripDateInput: document.getElementById('tripDateInput'),
  vehicleNumberInput: document.getElementById('vehicleNumberInput'),
  odometerInput: document.getElementById('odometerInput'),
  tripDescriptionInput: document.getElementById('tripDescriptionInput'),
  tripFormStatus: document.getElementById('tripFormStatus'),
  journalCard: document.getElementById('journalCard'),
  dateFromInput: document.getElementById('dateFromInput'),
  dateToInput: document.getElementById('dateToInput'),
  applyFilterButton: document.getElementById('applyFilterButton'),
  resetFilterButton: document.getElementById('resetFilterButton'),
  exportFilteredButton: document.getElementById('exportFilteredButton'),
  exportAllButton: document.getElementById('exportAllButton'),
  journalTableBody: document.getElementById('journalTableBody'),
  journalStatus: document.getElementById('journalStatus')
}

let activeUser = null
let allTripRecords = []

function populateVehicleNumbers() {
  const fragment = document.createDocumentFragment()
  vehicleNumbers.forEach((vehicleNumber) => {
    const option = document.createElement('option')
    option.value = vehicleNumber
    option.textContent = vehicleNumber
    fragment.append(option)
  })
  elements.vehicleNumberInput.innerHTML = ''
  elements.vehicleNumberInput.append(fragment)
}

function isResponsibleUser(user) {
  return user?.email?.toLowerCase() === responsibleEmailAddress.toLowerCase()
}

function convertTimestampToText(timestampValue) {
  if (!timestampValue?.toDate) {
    return 'Ожидает фиксации сервера'
  }
  return timestampValue.toDate().toLocaleString('ru-RU')
}

function buildTripMetrics(records) {
  const recordsByDayAndVehicle = new Map()
  records.forEach((record) => {
    const key = `${record.tripDate}|${record.vehicleNumber}`
    if (!recordsByDayAndVehicle.has(key)) {
      recordsByDayAndVehicle.set(key, [])
    }
    recordsByDayAndVehicle.get(key).push(record)
  })

  const metricsByRecordId = new Map()

  recordsByDayAndVehicle.forEach((recordsGroup) => {
    const odometerValues = recordsGroup.map((record) => Number(record.odometerValue)).filter((value) => Number.isFinite(value))
    const dayStartOdometer = odometerValues.length ? Math.min(...odometerValues) : 0
    const dayEndOdometer = odometerValues.length ? Math.max(...odometerValues) : 0
    const dailyMileage = Math.max(dayEndOdometer - dayStartOdometer, 0)
    recordsGroup.forEach((record) => {
      metricsByRecordId.set(record.id, {
        dailyMileage,
        endOfDayOdometer: dayEndOdometer
      })
    })
  })

  return metricsByRecordId
}

function filterRecordsByDates(records, fromDate, toDate) {
  return records.filter((record) => {
    const passesFrom = fromDate ? record.tripDate >= fromDate : true
    const passesTo = toDate ? record.tripDate <= toDate : true
    return passesFrom && passesTo
  })
}

function renderJournal(records) {
  const metricsByRecordId = buildTripMetrics(records)
  elements.journalTableBody.innerHTML = ''

  if (!records.length) {
    elements.journalStatus.textContent = 'Записей не найдено'
    return
  }

  const fragment = document.createDocumentFragment()

  records.forEach((record) => {
    const row = document.createElement('tr')
    const metrics = metricsByRecordId.get(record.id) || { dailyMileage: 0, endOfDayOdometer: 0 }

    const values = [
      record.driverFullName,
      record.tripDate,
      record.vehicleNumber,
      String(record.odometerValue),
      record.tripDescription,
      convertTimestampToText(record.createdAt),
      String(metrics.dailyMileage),
      String(metrics.endOfDayOdometer)
    ]

    values.forEach((value) => {
      const cell = document.createElement('td')
      cell.textContent = value
      row.append(cell)
    })

    fragment.append(row)
  })

  elements.journalTableBody.append(fragment)
  elements.journalStatus.textContent = `Показано записей: ${records.length}`
}

function createCsvContent(records) {
  const metricsByRecordId = buildTripMetrics(records)
  const header = ['ФИО', 'Дата поездки', 'Номер машины', 'Пробег', 'Текст поездки', 'Дата создания', 'Суточный пробег', 'Одометр на конец дня']
  const rows = records.map((record) => {
    const metrics = metricsByRecordId.get(record.id) || { dailyMileage: 0, endOfDayOdometer: 0 }
    return [
      record.driverFullName,
      record.tripDate,
      record.vehicleNumber,
      String(record.odometerValue),
      record.tripDescription,
      convertTimestampToText(record.createdAt),
      String(metrics.dailyMileage),
      String(metrics.endOfDayOdometer)
    ]
  })

  const csvRows = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'))
  return `\uFEFF${csvRows.join('\n')}`
}

function downloadCsvFile(fileName, records) {
  const csvContent = createCsvContent(records)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function updateVisibilityForUser(user) {
  activeUser = user
  const responsibleUser = isResponsibleUser(user)
  elements.tripCard.classList.toggle('hidden', !user)
  elements.logoutButton.classList.toggle('hidden', !user)
  elements.journalCard.classList.toggle('hidden', !responsibleUser)

  if (!user) {
    elements.authStatus.textContent = 'Выполните вход для работы с журналом'
    elements.journalTableBody.innerHTML = ''
    elements.journalStatus.textContent = ''
    return
  }

  if (user.isAnonymous) {
    elements.authStatus.textContent = 'Вход выполнен как гость'
  } else {
    elements.authStatus.textContent = `Вход выполнен: ${user.email}`
  }

  if (!responsibleUser) {
    elements.journalStatus.textContent = `Все отправленные записи попадают ответственному: ${responsibleEmailAddress}`
  }
}

async function submitTripRecord(event) {
  event.preventDefault()

  if (!activeUser) {
    elements.tripFormStatus.textContent = 'Сначала выполните вход'
    return
  }

  const tripRecord = {
    driverFullName: elements.driverFullNameInput.value.trim(),
    tripDate: elements.tripDateInput.value,
    vehicleNumber: elements.vehicleNumberInput.value,
    odometerValue: Number(elements.odometerInput.value),
    tripDescription: elements.tripDescriptionInput.value.trim(),
    createdAt: serverTimestamp(),
    createdByUserId: activeUser.uid,
    createdByEmail: activeUser.email || 'guest'
  }

  const isFormValid = tripRecord.driverFullName && tripRecord.tripDate && tripRecord.vehicleNumber && Number.isFinite(tripRecord.odometerValue) && tripRecord.tripDescription
  if (!isFormValid) {
    elements.tripFormStatus.textContent = 'Заполните все поля корректно'
    return
  }

  try {
    await addDoc(collection(database, 'tripRecords'), tripRecord)
    elements.tripFormStatus.textContent = 'Запись отправлена ответственному'
    elements.tripForm.reset()
    const today = new Date().toISOString().slice(0, 10)
    elements.tripDateInput.value = today
  } catch (error) {
    elements.tripFormStatus.textContent = `Ошибка отправки: ${error.message}`
  }
}

async function loginWithEmail(event) {
  event.preventDefault()
  const email = elements.emailInput.value.trim()
  const password = elements.passwordInput.value

  try {
    await signInWithEmailAndPassword(authentication, email, password)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка входа: ${error.message}`
  }
}

async function registerWithEmail() {
  const email = elements.emailInput.value.trim()
  const password = elements.passwordInput.value

  try {
    await createUserWithEmailAndPassword(authentication, email, password)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка регистрации: ${error.message}`
  }
}

async function loginWithGoogle() {
  try {
    await signInWithPopup(authentication, googleProvider)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка Google входа: ${error.message}`
  }
}

async function loginAsGuest() {
  try {
    await signInAnonymously(authentication)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка гостевого входа: ${error.message}`
  }
}

async function logoutCurrentUser() {
  try {
    await signOut(authentication)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка выхода: ${error.message}`
  }
}

function applyDateFilter() {
  if (!isResponsibleUser(activeUser)) {
    return
  }

  const filteredRecords = filterRecordsByDates(allTripRecords, elements.dateFromInput.value, elements.dateToInput.value)
  renderJournal(filteredRecords)
}

function resetDateFilter() {
  elements.dateFromInput.value = ''
  elements.dateToInput.value = ''
  applyDateFilter()
}

function subscribeToTripRecords() {
  const tripRecordsQuery = query(collection(database, 'tripRecords'), orderBy('tripDate', 'desc'), orderBy('createdAt', 'desc'))

  onSnapshot(tripRecordsQuery, (snapshot) => {
    allTripRecords = snapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
    if (isResponsibleUser(activeUser)) {
      applyDateFilter()
    }
  }, (error) => {
    elements.journalStatus.textContent = `Ошибка чтения журнала: ${error.message}`
  })
}

function exportFilteredRecords() {
  if (!isResponsibleUser(activeUser)) {
    return
  }
  const filteredRecords = filterRecordsByDates(allTripRecords, elements.dateFromInput.value, elements.dateToInput.value)
  downloadCsvFile('autotrack-journal-filtered.csv', filteredRecords)
}

function exportAllRecords() {
  if (!isResponsibleUser(activeUser)) {
    return
  }
  downloadCsvFile('autotrack-journal-all.csv', allTripRecords)
}

function setDefaultTripDate() {
  elements.tripDateInput.value = new Date().toISOString().slice(0, 10)
}

function attachEventListeners() {
  elements.emailAuthForm.addEventListener('submit', loginWithEmail)
  elements.emailRegisterButton.addEventListener('click', registerWithEmail)
  elements.googleLoginButton.addEventListener('click', loginWithGoogle)
  elements.guestLoginButton.addEventListener('click', loginAsGuest)
  elements.logoutButton.addEventListener('click', logoutCurrentUser)
  elements.tripForm.addEventListener('submit', submitTripRecord)
  elements.applyFilterButton.addEventListener('click', applyDateFilter)
  elements.resetFilterButton.addEventListener('click', resetDateFilter)
  elements.exportFilteredButton.addEventListener('click', exportFilteredRecords)
  elements.exportAllButton.addEventListener('click', exportAllRecords)
}

function startApplication() {
  populateVehicleNumbers()
  setDefaultTripDate()
  attachEventListeners()
  subscribeToTripRecords()
  onAuthStateChanged(authentication, updateVisibilityForUser)
}

startApplication()
