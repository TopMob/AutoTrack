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
const managerSettingsPath = ['systemSettings', 'responsibleAssignment']
const themeStorageKey = 'autotrack_theme'
const journalColumnTitles = ['ФИО', 'Дата поездки', 'Номер машины', 'Одометр', 'Суточный пробег', 'Одометр на конец дня', 'Текст поездки', 'Дата создания']

const application = initializeApp(firebaseConfiguration)
const authentication = getAuth(application)
const database = getFirestore(application)

const elements = {
  themeToggleButton: document.getElementById('themeToggleButton'),
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
  dailyMileageInput: document.getElementById('dailyMileageInput'),
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
let stopTripRecordsSubscription = null

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

function convertDateValueToIsoDateString(dateValue) {
  if (!dateValue) {
    return ''
  }
  if (typeof dateValue === 'string') {
    return dateValue.slice(0, 10)
  }
  if (dateValue.toDate) {
    return dateValue.toDate().toISOString().slice(0, 10)
  }
  if (dateValue instanceof Date) {
    return dateValue.toISOString().slice(0, 10)
  }
  return ''
}

function convertTimestampToText(timestampValue) {
  if (timestampValue?.toDate) {
    return timestampValue.toDate().toLocaleString('ru-RU')
  }
  return 'Ожидает фиксации сервера'
}

function getTimestampMilliseconds(timestampValue) {
  if (timestampValue?.toMillis) {
    return timestampValue.toMillis()
  }
  return 0
}

function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName)
  localStorage.setItem(themeStorageKey, themeName)
}

function initializeTheme() {
  setTheme(localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light')
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme')
  setTheme(currentTheme === 'dark' ? 'light' : 'dark')
}

function getManagerSettingsReference() {
  return doc(database, managerSettingsPath[0], managerSettingsPath[1])
}

async function loadResponsibleEmailAddress() {
  try {
    const managerSettingsSnapshot = await getDoc(getManagerSettingsReference())
    if (!managerSettingsSnapshot.exists()) {
      responsibleEmailAddress = fallbackResponsibleEmailAddress
      elements.managerEmailInput.value = responsibleEmailAddress
      return
    }

    const managerSettingsData = managerSettingsSnapshot.data()
    const storedResponsibleEmail = normalizeEmail(managerSettingsData.responsibleEmail)
    responsibleEmailAddress = storedResponsibleEmail || fallbackResponsibleEmailAddress
    elements.managerEmailInput.value = responsibleEmailAddress
  } catch {
    responsibleEmailAddress = fallbackResponsibleEmailAddress
    elements.managerEmailInput.value = responsibleEmailAddress
  }
}

async function saveResponsibleEmailAddress() {
  if (!isOwner(activeUser)) {
    return
  }

  const responsibleEmailCandidate = normalizeEmail(elements.managerEmailInput.value)
  const isValidEmail = responsibleEmailCandidate.includes('@') && responsibleEmailCandidate.includes('.')

  if (!isValidEmail) {
    elements.managerStatus.textContent = 'Введите корректный email ответственного'
    return
  }

  await setDoc(getManagerSettingsReference(), {
    responsibleEmail: responsibleEmailCandidate,
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizeEmail(activeUser.email)
  })

  responsibleEmailAddress = responsibleEmailCandidate
  elements.managerStatus.textContent = `Ответственный сохранен: ${responsibleEmailAddress}`
  updateJournalSubscriptionForUser()
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

function normalizeTripRecord(documentSnapshot) {
  const rawRecord = documentSnapshot.data()
  return {
    id: documentSnapshot.id,
    driverFullName: String(rawRecord.driverFullName || ''),
    tripDate: convertDateValueToIsoDateString(rawRecord.tripDate),
    vehicleNumber: String(rawRecord.vehicleNumber || ''),
    odometerValue: Number(rawRecord.odometerValue || 0),
    dailyMileageValue: Number(rawRecord.dailyMileageValue || 0),
    tripDescription: String(rawRecord.tripDescription || ''),
    createdAt: rawRecord.createdAt,
    createdByUserId: String(rawRecord.createdByUserId || ''),
    createdByEmail: String(rawRecord.createdByEmail || '')
  }
}

function buildFallbackMetricsByRecordId(records) {
  const recordsByDateAndVehicle = new Map()

  records.forEach((record) => {
    const groupKey = `${record.tripDate}|${record.vehicleNumber}`
    const groupItems = recordsByDateAndVehicle.get(groupKey) || []
    groupItems.push(record)
    recordsByDateAndVehicle.set(groupKey, groupItems)
  })

  const fallbackMetricsByRecordId = new Map()

  recordsByDateAndVehicle.forEach((groupItems) => {
    const odometerValues = groupItems.map((record) => Number(record.odometerValue)).filter((value) => Number.isFinite(value))
    const dayStartOdometer = odometerValues.length ? Math.min(...odometerValues) : 0
    const dayEndOdometer = odometerValues.length ? Math.max(...odometerValues) : 0
    const fallbackDailyMileage = Math.max(dayEndOdometer - dayStartOdometer, 0)

    groupItems.forEach((record) => {
      fallbackMetricsByRecordId.set(record.id, {
        dailyMileageValue: fallbackDailyMileage,
        endOfDayOdometer: dayEndOdometer
      })
    })
  })

  return fallbackMetricsByRecordId
}

function filterRecordsByDateRange(records, fromDate, toDate) {
  return records.filter((record) => {
    if (!record.tripDate) {
      return false
    }
    const passesFromBoundary = fromDate ? record.tripDate >= fromDate : true
    const passesToBoundary = toDate ? record.tripDate <= toDate : true
    return passesFromBoundary && passesToBoundary
  })
}

function sortRecords(records, sortingMode) {
  const sortedRecords = [...records]

  sortedRecords.sort((firstRecord, secondRecord) => {
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
      return firstRecord.odometerValue - secondRecord.odometerValue
    }
    if (sortingMode === 'odometerDesc') {
      return secondRecord.odometerValue - firstRecord.odometerValue
    }
    return 0
  })

  return sortedRecords
}

function getCurrentFilteredAndSortedRecords() {
  const filteredRecords = filterRecordsByDateRange(allTripRecords, elements.dateFromInput.value, elements.dateToInput.value)
  return sortRecords(filteredRecords, elements.sortOrderInput.value)
}

function buildRowValues(record, fallbackMetricsByRecordId) {
  const fallbackMetrics = fallbackMetricsByRecordId.get(record.id) || { dailyMileageValue: 0, endOfDayOdometer: record.odometerValue }
  const dailyMileageValue = Number.isFinite(record.dailyMileageValue) && record.dailyMileageValue >= 0 ? record.dailyMileageValue : fallbackMetrics.dailyMileageValue
  const endOfDayOdometer = record.odometerValue + dailyMileageValue

  return [
    record.driverFullName,
    record.tripDate,
    record.vehicleNumber,
    String(record.odometerValue),
    String(dailyMileageValue),
    String(endOfDayOdometer),
    record.tripDescription,
    convertTimestampToText(record.createdAt)
  ]
}

function renderJournal(records) {
  elements.journalTableBody.innerHTML = ''

  if (!records.length) {
    elements.journalStatus.textContent = 'Записи не найдены по текущему фильтру'
    return
  }

  const fallbackMetricsByRecordId = buildFallbackMetricsByRecordId(records)
  const rowFragment = document.createDocumentFragment()

  records.forEach((record) => {
    const rowValues = buildRowValues(record, fallbackMetricsByRecordId)
    const rowElement = document.createElement('tr')

    rowValues.forEach((value, index) => {
      const cellElement = document.createElement('td')
      cellElement.textContent = value
      cellElement.setAttribute('data-label', journalColumnTitles[index])
      rowElement.append(cellElement)
    })

    rowFragment.append(rowElement)
  })

  elements.journalTableBody.append(rowFragment)
  elements.journalStatus.textContent = `Показано записей: ${records.length}`
}

function applyFiltersAndRenderJournal() {
  if (!canAccessJournal(activeUser)) {
    return
  }
  renderJournal(getCurrentFilteredAndSortedRecords())
}

function createCsvContent(records) {
  const fallbackMetricsByRecordId = buildFallbackMetricsByRecordId(records)
  const rows = records.map((record) => buildRowValues(record, fallbackMetricsByRecordId))
  const csvRows = [journalColumnTitles, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'))
  return `\uFEFF${csvRows.join('\n')}`
}

function buildExportFileName(prefixText) {
  const nowDate = new Date()
  const datePart = nowDate.toISOString().slice(0, 10)
  const timePart = nowDate.toTimeString().slice(0, 8).replaceAll(':', '-')
  return `${prefixText}-${datePart}-${timePart}.csv`
}

function triggerFileDownload(fileName, fileContent, mimeType) {
  const fileBlob = new Blob([fileContent], { type: mimeType })
  const objectUrl = URL.createObjectURL(fileBlob)
  const downloadLink = document.createElement('a')
  downloadLink.href = objectUrl
  downloadLink.download = fileName
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 1000)
}

function exportRecords(records, prefixText) {
  if (!records.length) {
    elements.journalStatus.textContent = 'Нет данных для скачивания'
    return
  }

  const csvContent = createCsvContent(records)
  const fileName = buildExportFileName(prefixText)
  triggerFileDownload(fileName, csvContent, 'text/csv;charset=utf-8;')
  elements.journalStatus.textContent = `Скачано записей: ${records.length}`
}

function stopExistingTripRecordsSubscription() {
  if (!stopTripRecordsSubscription) {
    return
  }
  stopTripRecordsSubscription()
  stopTripRecordsSubscription = null
}

function updateJournalSubscriptionForUser() {
  stopExistingTripRecordsSubscription()

  if (!canAccessJournal(activeUser)) {
    allTripRecords = []
    elements.journalTableBody.innerHTML = ''
    return
  }

  stopTripRecordsSubscription = onSnapshot(collection(database, 'tripRecords'), (snapshot) => {
    allTripRecords = snapshot.docs.map((documentSnapshot) => normalizeTripRecord(documentSnapshot))
    applyFiltersAndRenderJournal()
  }, (error) => {
    elements.journalStatus.textContent = `Ошибка чтения журнала: ${error.message}`
  })
}

function updateVisibilityForUser(user) {
  activeUser = user
  const ownerAccess = isOwner(user)
  const journalAccess = canAccessJournal(user)

  elements.logoutButton.classList.toggle('hidden', !user)
  elements.tripCard.classList.toggle('hidden', !user)
  elements.managerCard.classList.toggle('hidden', !ownerAccess)
  elements.journalCard.classList.toggle('hidden', !journalAccess)

  if (!user) {
    elements.authStatus.textContent = 'Выполните вход по email'
    elements.managerStatus.textContent = ''
    elements.journalStatus.textContent = ''
    elements.journalTableBody.innerHTML = ''
    updateJournalSubscriptionForUser()
    return
  }

  elements.authStatus.textContent = `Вход выполнен: ${normalizeEmail(user.email)}`

  if (ownerAccess) {
    elements.managerStatus.textContent = `Владелец. Текущий ответственный: ${responsibleEmailAddress}`
  } else {
    elements.managerStatus.textContent = ''
  }

  if (!journalAccess) {
    elements.journalStatus.textContent = `Журнал доступен владельцу ${ownerEmailAddress} и ответственному ${responsibleEmailAddress}`
    updateJournalSubscriptionForUser()
    return
  }

  updateJournalSubscriptionForUser()
  applyFiltersAndRenderJournal()
}

function getTripRecordFromForm() {
  return {
    driverFullName: elements.driverFullNameInput.value.trim(),
    tripDate: elements.tripDateInput.value,
    vehicleNumber: elements.vehicleNumberInput.value,
    odometerValue: Number(elements.odometerInput.value),
    dailyMileageValue: Number(elements.dailyMileageInput.value),
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
    && Number.isFinite(tripRecord.dailyMileageValue)
    && tripRecord.dailyMileageValue >= 0
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

function exportFilteredRecords() {
  if (!canAccessJournal(activeUser)) {
    return
  }
  exportRecords(getCurrentFilteredAndSortedRecords(), 'autotrack-journal-filtered')
}

function exportAllRecords() {
  if (!canAccessJournal(activeUser)) {
    return
  }
  exportRecords(sortRecords(allTripRecords, elements.sortOrderInput.value), 'autotrack-journal-all')
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
  elements.themeToggleButton.addEventListener('click', toggleTheme)
  elements.emailAuthForm.addEventListener('submit', loginWithEmail)
  elements.emailRegisterButton.addEventListener('click', registerWithEmail)
  elements.logoutButton.addEventListener('click', logoutCurrentUser)
  elements.saveManagerButton.addEventListener('click', saveResponsibleEmailAddress)
  elements.tripForm.addEventListener('submit', submitTripRecord)
  elements.applyFilterButton.addEventListener('click', applyFiltersAndRenderJournal)
  elements.resetFilterButton.addEventListener('click', resetFilters)
  elements.dateFromInput.addEventListener('change', applyFiltersAndRenderJournal)
  elements.dateToInput.addEventListener('change', applyFiltersAndRenderJournal)
  elements.sortOrderInput.addEventListener('change', applyFiltersAndRenderJournal)
  elements.exportFilteredButton.addEventListener('click', exportFilteredRecords)
  elements.exportAllButton.addEventListener('click', exportAllRecords)
}

async function startApplication() {
  initializeTheme()
  populateVehicleNumbers()
  setDefaultTripDate()
  attachEventListeners()
  onAuthStateChanged(authentication, async (user) => {
    activeUser = user
    await loadResponsibleEmailAddress()
    updateVisibilityForUser(user)
  })
}

startApplication()
