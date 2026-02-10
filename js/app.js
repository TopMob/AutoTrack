import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
  serverTimestamp,
  doc,
  setDoc,
  getDoc
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

const ownerEmailAddress = 'shazak6430@gmail.com'
const fallbackResponsibleEmailAddress = 'responsible@autotrack.local'
const vehicleNumbers = ['A001AA', 'A002AA', 'A003AA', 'A004AA', 'A005AA']
const managerSettingsDocumentPath = ['systemSettings', 'responsibleAssignment']

const application = initializeApp(firebaseConfiguration)
const authentication = getAuth(application)
const database = getFirestore(application)

const elements = {
  authStatus: document.getElementById('authStatus'),
  emailAuthForm: document.getElementById('emailAuthForm'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  emailRegisterButton: document.getElementById('emailRegisterButton'),
  logoutButton: document.getElementById('logoutButton'),
  managerCard: document.getElementById('managerCard'),
  managerStatus: document.getElementById('managerStatus'),
  managerEmailInput: document.getElementById('managerEmailInput'),
  saveManagerButton: document.getElementById('saveManagerButton'),
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
  sortOrderInput: document.getElementById('sortOrderInput'),
  applyFilterButton: document.getElementById('applyFilterButton'),
  resetFilterButton: document.getElementById('resetFilterButton'),
  exportFilteredButton: document.getElementById('exportFilteredButton'),
  exportAllButton: document.getElementById('exportAllButton'),
  journalTableBody: document.getElementById('journalTableBody'),
  journalStatus: document.getElementById('journalStatus')
}

let activeUser = null
let allTripRecords = []
let responsibleEmailAddress = fallbackResponsibleEmailAddress

function normalizeEmail(emailAddress) {
  return String(emailAddress || '').trim().toLowerCase()
}

function isOwner(user) {
  return normalizeEmail(user?.email) === normalizeEmail(ownerEmailAddress)
}

function isResponsible(user) {
  return normalizeEmail(user?.email) === normalizeEmail(responsibleEmailAddress)
}

function canAccessJournal(user) {
  return isOwner(user) || isResponsible(user)
}

function getManagerSettingsReference() {
  return doc(database, managerSettingsDocumentPath[0], managerSettingsDocumentPath[1])
}

async function loadResponsibleEmailAddress() {
  const managerSettingsSnapshot = await getDoc(getManagerSettingsReference())
  if (!managerSettingsSnapshot.exists()) {
    responsibleEmailAddress = fallbackResponsibleEmailAddress
    elements.managerEmailInput.value = responsibleEmailAddress
    return
  }
  const managerSettings = managerSettingsSnapshot.data()
  const storedEmailAddress = normalizeEmail(managerSettings.responsibleEmail)
  responsibleEmailAddress = storedEmailAddress || fallbackResponsibleEmailAddress
  elements.managerEmailInput.value = responsibleEmailAddress
}

async function saveResponsibleEmailAddress() {
  if (!isOwner(activeUser)) {
    return
  }

  const emailAddressCandidate = normalizeEmail(elements.managerEmailInput.value)
  const isValidEmailAddress = emailAddressCandidate.includes('@') && emailAddressCandidate.includes('.')

  if (!isValidEmailAddress) {
    elements.managerStatus.textContent = 'Введите корректный email ответственного'
    return
  }

  await setDoc(getManagerSettingsReference(), {
    responsibleEmail: emailAddressCandidate,
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizeEmail(activeUser.email)
  })

  responsibleEmailAddress = emailAddressCandidate
  elements.managerStatus.textContent = `Ответственный сохранен: ${responsibleEmailAddress}`
  updateVisibilityForUser(activeUser)
  applyFiltersAndRenderJournal()
}

function populateVehicleNumbers() {
  const optionsFragment = document.createDocumentFragment()
  vehicleNumbers.forEach((vehicleNumber) => {
    const optionElement = document.createElement('option')
    optionElement.value = vehicleNumber
    optionElement.textContent = vehicleNumber
    optionsFragment.append(optionElement)
  })
  elements.vehicleNumberInput.innerHTML = ''
  elements.vehicleNumberInput.append(optionsFragment)
}

function convertTimestampToText(timestampValue) {
  if (!timestampValue?.toDate) {
    return 'Ожидает фиксации сервера'
  }
  return timestampValue.toDate().toLocaleString('ru-RU')
}

function getTimestampMilliseconds(timestampValue) {
  if (!timestampValue?.toMillis) {
    return 0
  }
  return timestampValue.toMillis()
}

function buildTripMetricsByRecordId(records) {
  const recordsByDateAndVehicle = new Map()

  records.forEach((record) => {
    const groupingKey = `${record.tripDate}|${record.vehicleNumber}`
    const groupedRecords = recordsByDateAndVehicle.get(groupingKey) || []
    groupedRecords.push(record)
    recordsByDateAndVehicle.set(groupingKey, groupedRecords)
  })

  const metricsByRecordId = new Map()

  recordsByDateAndVehicle.forEach((groupedRecords) => {
    const odometerValues = groupedRecords.map((record) => Number(record.odometerValue)).filter(Number.isFinite)
    const startOfDayOdometer = odometerValues.length ? Math.min(...odometerValues) : 0
    const endOfDayOdometer = odometerValues.length ? Math.max(...odometerValues) : 0
    const dailyMileage = Math.max(endOfDayOdometer - startOfDayOdometer, 0)

    groupedRecords.forEach((record) => {
      metricsByRecordId.set(record.id, {
        dailyMileage,
        endOfDayOdometer
      })
    })
  })

  return metricsByRecordId
}

function filterRecordsByDateRange(records, fromDate, toDate) {
  return records.filter((record) => {
    const passesFromBoundary = fromDate ? record.tripDate >= fromDate : true
    const passesToBoundary = toDate ? record.tripDate <= toDate : true
    return passesFromBoundary && passesToBoundary
  })
}

function sortRecords(records, sortingMode) {
  const recordsCopy = [...records]

  recordsCopy.sort((firstRecord, secondRecord) => {
    if (sortingMode === 'tripDateAsc') {
      return firstRecord.tripDate.localeCompare(secondRecord.tripDate)
    }
    if (sortingMode === 'tripDateDesc') {
      return secondRecord.tripDate.localeCompare(firstRecord.tripDate)
    }
    if (sortingMode === 'createdAtAsc') {
      return getTimestampMilliseconds(firstRecord.createdAt) - getTimestampMilliseconds(secondRecord.createdAt)
    }
    if (sortingMode === 'createdAtDesc') {
      return getTimestampMilliseconds(secondRecord.createdAt) - getTimestampMilliseconds(firstRecord.createdAt)
    }
    if (sortingMode === 'odometerAsc') {
      return Number(firstRecord.odometerValue) - Number(secondRecord.odometerValue)
    }
    if (sortingMode === 'odometerDesc') {
      return Number(secondRecord.odometerValue) - Number(firstRecord.odometerValue)
    }
    return 0
  })

  return recordsCopy
}

function getCurrentFilteredAndSortedRecords() {
  const filteredRecords = filterRecordsByDateRange(allTripRecords, elements.dateFromInput.value, elements.dateToInput.value)
  return sortRecords(filteredRecords, elements.sortOrderInput.value)
}

function renderJournal(records) {
  elements.journalTableBody.innerHTML = ''

  if (!records.length) {
    elements.journalStatus.textContent = 'Записей не найдено'
    return
  }

  const metricsByRecordId = buildTripMetricsByRecordId(records)
  const tableRowsFragment = document.createDocumentFragment()

  records.forEach((record) => {
    const rowElement = document.createElement('tr')
    const metrics = metricsByRecordId.get(record.id) || { dailyMileage: 0, endOfDayOdometer: 0 }

    const valuesForRow = [
      record.driverFullName,
      record.tripDate,
      record.vehicleNumber,
      String(record.odometerValue),
      record.tripDescription,
      convertTimestampToText(record.createdAt),
      String(metrics.dailyMileage),
      String(metrics.endOfDayOdometer)
    ]

    valuesForRow.forEach((value) => {
      const cellElement = document.createElement('td')
      cellElement.textContent = value
      rowElement.append(cellElement)
    })

    tableRowsFragment.append(rowElement)
  })

  elements.journalTableBody.append(tableRowsFragment)
  elements.journalStatus.textContent = `Показано записей: ${records.length}`
}

function applyFiltersAndRenderJournal() {
  if (!canAccessJournal(activeUser)) {
    return
  }
  const recordsForDisplay = getCurrentFilteredAndSortedRecords()
  renderJournal(recordsForDisplay)
}

function createCsvContent(records) {
  const metricsByRecordId = buildTripMetricsByRecordId(records)
  const headerColumns = ['ФИО', 'Дата поездки', 'Номер машины', 'Пробег', 'Текст поездки', 'Дата создания', 'Суточный пробег', 'Одометр на конец дня']

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

  const csvRows = [headerColumns, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'))

  return `\uFEFF${csvRows.join('\n')}`
}

function downloadCsvFile(fileName, records) {
  const csvContent = createCsvContent(records)
  const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const objectUrl = URL.createObjectURL(csvBlob)
  const downloadLink = document.createElement('a')
  downloadLink.href = objectUrl
  downloadLink.download = fileName
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  URL.revokeObjectURL(objectUrl)
}

function updateVisibilityForUser(user) {
  activeUser = user
  const owner = isOwner(user)
  const responsible = isResponsible(user)
  const journalAccess = owner || responsible

  elements.logoutButton.classList.toggle('hidden', !user)
  elements.tripCard.classList.toggle('hidden', !user)
  elements.managerCard.classList.toggle('hidden', !owner)
  elements.journalCard.classList.toggle('hidden', !journalAccess)

  if (!user) {
    elements.authStatus.textContent = 'Выполните вход по email'
    elements.journalTableBody.innerHTML = ''
    elements.journalStatus.textContent = ''
    elements.managerStatus.textContent = ''
    return
  }

  elements.authStatus.textContent = `Вход выполнен: ${normalizeEmail(user.email)}`

  if (owner) {
    elements.managerStatus.textContent = `Владелец. Текущий ответственный: ${responsibleEmailAddress}`
  } else {
    elements.managerStatus.textContent = ''
  }

  if (!journalAccess) {
    elements.journalStatus.textContent = `Журнал доступен владельцу ${ownerEmailAddress} и ответственному ${responsibleEmailAddress}`
    return
  }

  applyFiltersAndRenderJournal()
}

function getTripRecordFromForm() {
  return {
    driverFullName: elements.driverFullNameInput.value.trim(),
    tripDate: elements.tripDateInput.value,
    vehicleNumber: elements.vehicleNumberInput.value,
    odometerValue: Number(elements.odometerInput.value),
    tripDescription: elements.tripDescriptionInput.value.trim(),
    createdAt: serverTimestamp(),
    createdByUserId: activeUser.uid,
    createdByEmail: normalizeEmail(activeUser.email)
  }
}

function validateTripRecord(tripRecord) {
  return Boolean(
    tripRecord.driverFullName
    && tripRecord.tripDate
    && tripRecord.vehicleNumber
    && Number.isFinite(tripRecord.odometerValue)
    && tripRecord.odometerValue >= 0
    && tripRecord.tripDescription
  )
}

async function submitTripRecord(event) {
  event.preventDefault()

  if (!activeUser) {
    elements.tripFormStatus.textContent = 'Сначала выполните вход'
    return
  }

  const tripRecord = getTripRecordFromForm()
  if (!validateTripRecord(tripRecord)) {
    elements.tripFormStatus.textContent = 'Заполните поля корректно'
    return
  }

  try {
    await addDoc(collection(database, 'tripRecords'), tripRecord)
    elements.tripFormStatus.textContent = 'Запись сохранена'
    elements.tripForm.reset()
    elements.tripDateInput.value = new Date().toISOString().slice(0, 10)
  } catch (error) {
    elements.tripFormStatus.textContent = `Ошибка сохранения: ${error.message}`
  }
}

async function loginWithEmail(event) {
  event.preventDefault()
  const emailAddress = normalizeEmail(elements.emailInput.value)
  const passwordValue = elements.passwordInput.value

  try {
    await signInWithEmailAndPassword(authentication, emailAddress, passwordValue)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка входа: ${error.message}`
  }
}

async function registerWithEmail() {
  const emailAddress = normalizeEmail(elements.emailInput.value)
  const passwordValue = elements.passwordInput.value

  try {
    await createUserWithEmailAndPassword(authentication, emailAddress, passwordValue)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка регистрации: ${error.message}`
  }
}

async function logoutCurrentUser() {
  try {
    await signOut(authentication)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка выхода: ${error.message}`
  }
}

function subscribeToTripRecords() {
  const tripRecordsQuery = query(collection(database, 'tripRecords'), orderBy('tripDate', 'desc'), orderBy('createdAt', 'desc'))

  onSnapshot(tripRecordsQuery, (snapshot) => {
    allTripRecords = snapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
    applyFiltersAndRenderJournal()
  }, (error) => {
    elements.journalStatus.textContent = `Ошибка чтения журнала: ${error.message}`
  })
}

function exportFilteredRecords() {
  if (!canAccessJournal(activeUser)) {
    return
  }
  downloadCsvFile('autotrack-journal-filtered.csv', getCurrentFilteredAndSortedRecords())
}

function exportAllRecords() {
  if (!canAccessJournal(activeUser)) {
    return
  }
  const sortedRecords = sortRecords(allTripRecords, elements.sortOrderInput.value)
  downloadCsvFile('autotrack-journal-all.csv', sortedRecords)
}

function resetFilters() {
  elements.dateFromInput.value = ''
  elements.dateToInput.value = ''
  elements.sortOrderInput.value = 'tripDateDesc'
  applyFiltersAndRenderJournal()
}

function setDefaultTripDate() {
  elements.tripDateInput.value = new Date().toISOString().slice(0, 10)
}

function attachEventListeners() {
  elements.emailAuthForm.addEventListener('submit', loginWithEmail)
  elements.emailRegisterButton.addEventListener('click', registerWithEmail)
  elements.logoutButton.addEventListener('click', logoutCurrentUser)
  elements.saveManagerButton.addEventListener('click', saveResponsibleEmailAddress)
  elements.tripForm.addEventListener('submit', submitTripRecord)
  elements.applyFilterButton.addEventListener('click', applyFiltersAndRenderJournal)
  elements.resetFilterButton.addEventListener('click', resetFilters)
  elements.sortOrderInput.addEventListener('change', applyFiltersAndRenderJournal)
  elements.exportFilteredButton.addEventListener('click', exportFilteredRecords)
  elements.exportAllButton.addEventListener('click', exportAllRecords)
}

async function startApplication() {
  populateVehicleNumbers()
  setDefaultTripDate()
  attachEventListeners()
  await loadResponsibleEmailAddress()
  subscribeToTripRecords()
  onAuthStateChanged(authentication, updateVisibilityForUser)
}

startApplication()
