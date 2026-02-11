import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc
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
const fallbackVehicleNumbers = ['A001AA', 'A002AA', 'A003AA', 'A004AA', 'A005AA']
const managerSettingsPath = ['systemSettings', 'responsibleAssignment']
const themeStorageKey = 'autotrack_theme'

const application = initializeApp(firebaseConfiguration)
const authentication = getAuth(application)
const database = getFirestore(application)

const elements = {
  authCard: document.getElementById('authCard'),
  themeToggleButton: document.getElementById('themeToggleButton'),
  authStatus: document.getElementById('authStatus'),
  emailAuthForm: document.getElementById('emailAuthForm'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  registerButton: document.getElementById('registerButton'),
  guestLoginButton: document.getElementById('guestLoginButton'),
  accountPanel: document.getElementById('accountPanel'),
  accountMenuButton: document.getElementById('accountMenuButton'),
  accountMenu: document.getElementById('accountMenu'),
  accountLogoutButton: document.getElementById('accountLogoutButton'),
  managerCard: document.getElementById('managerCard'),
  managerStatus: document.getElementById('managerStatus'),
  managerEmailInput: document.getElementById('managerEmailInput'),
  managerEmailList: document.getElementById('managerEmailList'),
  vehicleNumberManagerInput: document.getElementById('vehicleNumberManagerInput'),
  vehicleNumberList: document.getElementById('vehicleNumberList'),
  saveManagerButton: document.getElementById('saveManagerButton'),
  tripCard: document.getElementById('tripCard'),
  tripForm: document.getElementById('tripForm'),
  driverFullNameInput: document.getElementById('driverFullNameInput'),
  tripDateInput: document.getElementById('tripDateInput'),
  vehicleNumberInput: document.getElementById('vehicleNumberInput'),
  mileageInput: document.getElementById('mileageInput'),
  odometerInput: document.getElementById('odometerInput'),
  tripDescriptionInput: document.getElementById('tripDescriptionInput'),
  tripFormStatus: document.getElementById('tripFormStatus'),
  journalCard: document.getElementById('journalCard'),
  dateFromInput: document.getElementById('dateFromInput'),
  dateToInput: document.getElementById('dateToInput'),
  sortOrderInput: document.getElementById('sortOrderInput'),
  applyFilterButton: document.getElementById('applyFilterButton'),
  resetFilterButton: document.getElementById('resetFilterButton'),
  exportAllButton: document.getElementById('exportAllButton'),
  installAppButton: document.getElementById('installAppButton'),
  journalTableBody: document.getElementById('journalTableBody'),
  journalStatus: document.getElementById('journalStatus')
}

const journalColumnTitles = ['ФИО', 'Дата поездки', 'Номер машины', 'Пробег', 'Одометр', 'Текст поездки', 'Дата создания', 'Суточный пробег', 'Одометр на конец дня']

let activeUser = null
let allTripRecords = []
let responsibleEmailAddresses = [fallbackResponsibleEmailAddress]
let managedVehicleNumbers = [...fallbackVehicleNumbers]
let unsubscribeFromTripRecords = null
let unsubscribeFromManagerSettings = null
let managerSettingsSubscriberUserIdentifier = null
let installPromptEvent = null

function normalizeEmail(emailAddress) {
  return String(emailAddress || '').trim().toLowerCase()
}

function normalizeVehicleNumber(vehicleNumber) {
  return String(vehicleNumber || '').trim().toUpperCase()
}

function parseWholeNumber(value) {
  const parsedNumber = Number.parseInt(String(value), 10)
  return Number.isFinite(parsedNumber) ? parsedNumber : NaN
}

function isOwner(user) {
  return normalizeEmail(user?.email) === normalizeEmail(ownerEmailAddress)
}

function isResponsible(user) {
  const userEmail = normalizeEmail(user?.email)
  if (!userEmail) {
    return false
  }
  return responsibleEmailAddresses.includes(userEmail)
}

function canAccessJournal(user) {
  return isOwner(user) || isResponsible(user)
}

function canManageEmailAddresses(user) {
  return isOwner(user)
}

function canManageVehicleNumbers(user) {
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
  const storedTheme = localStorage.getItem(themeStorageKey)
  setTheme(storedTheme === 'dark' ? 'dark' : 'light')
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme')
  setTheme(currentTheme === 'dark' ? 'light' : 'dark')
}

function createTagEditor(inputElement, listElement, normalizer, validator) {
  let values = []
  let isEditable = true

  function removeValue(valueToRemove) {
    if (!isEditable) {
      return
    }
    values = values.filter((value) => value !== valueToRemove)
    render()
  }

  function render() {
    listElement.innerHTML = ''
    const listFragment = document.createDocumentFragment()

    values.forEach((value) => {
      const tagElement = document.createElement('span')
      tagElement.className = 'tag-item'

      const textElement = document.createElement('span')
      textElement.textContent = value
      tagElement.append(textElement)

      if (isEditable) {
        const removeButton = document.createElement('button')
        removeButton.type = 'button'
        removeButton.className = 'tag-remove-button'
        removeButton.textContent = '×'
        removeButton.addEventListener('click', () => removeValue(value))
        tagElement.append(removeButton)
      }

      listFragment.append(tagElement)
    })

    listElement.append(listFragment)
  }

  function addFromInput() {
    if (!isEditable) {
      inputElement.value = ''
      return
    }
    const nextValue = normalizer(inputElement.value)
    inputElement.value = ''
    if (!nextValue || !validator(nextValue) || values.includes(nextValue)) {
      return
    }
    values = [...values, nextValue]
    render()
  }

  inputElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
    addFromInput()
  })

  return {
    setValues(nextValues) {
      values = [...nextValues]
      render()
    },
    setEditable(nextEditableState) {
      isEditable = Boolean(nextEditableState)
      inputElement.disabled = !isEditable
      render()
    },
    getValues() {
      return [...values]
    }
  }
}

const managerEmailEditor = createTagEditor(
  elements.managerEmailInput,
  elements.managerEmailList,
  normalizeEmail,
  (emailAddress) => emailAddress.includes('@') && emailAddress.includes('.')
)

const vehicleNumberEditor = createTagEditor(
  elements.vehicleNumberManagerInput,
  elements.vehicleNumberList,
  normalizeVehicleNumber,
  (vehicleNumber) => vehicleNumber.length >= 3
)

function getManagerSettingsReference() {
  return doc(database, managerSettingsPath[0], managerSettingsPath[1])
}

function setManagerEditors() {
  managerEmailEditor.setValues(responsibleEmailAddresses)
  vehicleNumberEditor.setValues(managedVehicleNumbers)
}

function setManagerEditorAccess(user) {
  managerEmailEditor.setEditable(canManageEmailAddresses(user))
  vehicleNumberEditor.setEditable(canManageVehicleNumbers(user))
}

function populateVehicleNumbers() {
  const selectedVehicleNumber = elements.vehicleNumberInput.value
  const optionsFragment = document.createDocumentFragment()

  managedVehicleNumbers.forEach((vehicleNumber) => {
    const optionElement = document.createElement('option')
    optionElement.value = vehicleNumber
    optionElement.textContent = vehicleNumber
    optionsFragment.append(optionElement)
  })

  elements.vehicleNumberInput.innerHTML = ''
  elements.vehicleNumberInput.append(optionsFragment)

  if (managedVehicleNumbers.includes(selectedVehicleNumber)) {
    elements.vehicleNumberInput.value = selectedVehicleNumber
  }
}

function parseResponsibleEmailAddresses(settingsData) {
  const rawEmails = Array.isArray(settingsData?.responsibleEmails)
    ? settingsData.responsibleEmails
    : [settingsData?.responsibleEmail]
  const normalizedEmails = rawEmails
    .map((emailAddress) => normalizeEmail(emailAddress))
    .filter((emailAddress) => emailAddress.includes('@') && emailAddress.includes('.'))
  return normalizedEmails.length ? normalizedEmails : [fallbackResponsibleEmailAddress]
}

function parseVehicleNumbers(settingsData) {
  const rawVehicleNumbers = Array.isArray(settingsData?.vehicleNumbers) ? settingsData.vehicleNumbers : []
  const normalizedVehicleNumbers = rawVehicleNumbers
    .map((vehicleNumber) => normalizeVehicleNumber(vehicleNumber))
    .filter((vehicleNumber) => vehicleNumber)
  return normalizedVehicleNumbers.length ? normalizedVehicleNumbers : [...fallbackVehicleNumbers]
}

function applyManagerSettings(settingsData) {
  responsibleEmailAddresses = parseResponsibleEmailAddresses(settingsData)
  managedVehicleNumbers = parseVehicleNumbers(settingsData)
  setManagerEditors()
  setManagerEditorAccess(activeUser)
  populateVehicleNumbers()
}

function resetManagerSettingsToFallback() {
  applyManagerSettings({
    responsibleEmails: [fallbackResponsibleEmailAddress],
    vehicleNumbers: fallbackVehicleNumbers
  })
}

function refreshManagerSettingsSubscription() {
  const currentUserIdentifier = activeUser?.uid || null
  if (managerSettingsSubscriberUserIdentifier === currentUserIdentifier) {
    return
  }

  if (unsubscribeFromManagerSettings) {
    unsubscribeFromManagerSettings()
    unsubscribeFromManagerSettings = null
  }

  managerSettingsSubscriberUserIdentifier = currentUserIdentifier

  if (!activeUser) {
    resetManagerSettingsToFallback()
    return
  }

  unsubscribeFromManagerSettings = onSnapshot(getManagerSettingsReference(), (managerSettingsSnapshot) => {
    if (!managerSettingsSnapshot.exists()) {
      resetManagerSettingsToFallback()
      return
    }
    applyManagerSettings(managerSettingsSnapshot.data())
  }, (error) => {
    elements.managerStatus.textContent = `Ошибка загрузки настроек: ${error.message}`
  })
}

async function saveManagerSettings() {
  if (!activeUser || !canManageVehicleNumbers(activeUser)) {
    elements.managerStatus.textContent = 'Недостаточно прав для изменения настроек'
    return
  }

  const nextVehicleNumbers = vehicleNumberEditor.getValues()
  if (!nextVehicleNumbers.length) {
    elements.managerStatus.textContent = 'Добавьте хотя бы один номер машины'
    return
  }

  const canUpdateEmailAddresses = canManageEmailAddresses(activeUser)
  const nextResponsibleEmailAddresses = canUpdateEmailAddresses
    ? managerEmailEditor.getValues()
    : responsibleEmailAddresses

  if (!nextResponsibleEmailAddresses.length) {
    elements.managerStatus.textContent = 'Добавьте хотя бы один email ответственного'
    return
  }

  const settingsForSaving = {
    responsibleEmails: nextResponsibleEmailAddresses,
    responsibleEmail: nextResponsibleEmailAddresses[0],
    vehicleNumbers: nextVehicleNumbers,
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizeEmail(activeUser.email)
  }

  if (!canUpdateEmailAddresses) {
    delete settingsForSaving.responsibleEmails
    delete settingsForSaving.responsibleEmail
  }

  try {
    await setDoc(getManagerSettingsReference(), settingsForSaving, { merge: true })
    elements.managerStatus.textContent = canUpdateEmailAddresses
      ? `Сохранено: ответственных ${nextResponsibleEmailAddresses.length}, машин ${nextVehicleNumbers.length}`
      : `Сохранено: машин ${nextVehicleNumbers.length}`
  } catch (error) {
    elements.managerStatus.textContent = `Ошибка сохранения настроек: ${error.message}`
  }
}

function normalizeTripRecord(documentSnapshot) {
  const rawRecord = documentSnapshot.data()
  return {
    id: documentSnapshot.id,
    driverFullName: String(rawRecord.driverFullName || ''),
    tripDate: convertDateValueToIsoDateString(rawRecord.tripDate),
    vehicleNumber: String(rawRecord.vehicleNumber || ''),
    mileageValue: Number(rawRecord.mileageValue || 0),
    odometerValue: Number(rawRecord.odometerValue || 0),
    tripDescription: String(rawRecord.tripDescription || ''),
    createdAt: rawRecord.createdAt,
    createdByUserId: String(rawRecord.createdByUserId || ''),
    createdByEmail: String(rawRecord.createdByEmail || '')
  }
}

function buildTripMetricsByRecordId(records) {
  const recordsByDateAndVehicle = new Map()

  records.forEach((record) => {
    const groupKey = `${record.tripDate}|${record.vehicleNumber}`
    const groupItems = recordsByDateAndVehicle.get(groupKey) || []
    groupItems.push(record)
    recordsByDateAndVehicle.set(groupKey, groupItems)
  })

  const metricsByRecordId = new Map()

  recordsByDateAndVehicle.forEach((groupItems) => {
    const odometerValues = groupItems
      .map((record) => Number(record.odometerValue))
      .filter((value) => Number.isFinite(value))

    const endOfDayOdometer = odometerValues.length ? Math.max(...odometerValues) : 0
    const startOfDayOdometer = odometerValues.length ? Math.min(...odometerValues) : 0
    const dailyMileage = Math.max(endOfDayOdometer - startOfDayOdometer, 0)

    groupItems.forEach((record) => {
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
    if (sortingMode === 'mileageAsc') {
      return firstRecord.mileageValue - secondRecord.mileageValue
    }
    if (sortingMode === 'mileageDesc') {
      return secondRecord.mileageValue - firstRecord.mileageValue
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

function renderJournal(records) {
  elements.journalTableBody.innerHTML = ''

  if (!records.length) {
    elements.journalStatus.textContent = 'Записи не найдены по текущему фильтру'
    return
  }

  const metricsByRecordId = buildTripMetricsByRecordId(records)
  const rowFragment = document.createDocumentFragment()

  records.forEach((record) => {
    const metrics = metricsByRecordId.get(record.id) || { dailyMileage: 0, endOfDayOdometer: 0 }
    const rowValues = [
      record.driverFullName,
      record.tripDate,
      record.vehicleNumber,
      String(record.mileageValue),
      String(record.odometerValue),
      record.tripDescription,
      convertTimestampToText(record.createdAt),
      String(metrics.dailyMileage),
      String(metrics.endOfDayOdometer)
    ]

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
  const metricsByRecordId = buildTripMetricsByRecordId(records)
  const rows = records.map((record) => {
    const metrics = metricsByRecordId.get(record.id) || { dailyMileage: 0, endOfDayOdometer: 0 }
    return [
      record.driverFullName,
      record.tripDate,
      record.vehicleNumber,
      String(record.mileageValue),
      String(record.odometerValue),
      record.tripDescription,
      convertTimestampToText(record.createdAt),
      String(metrics.dailyMileage),
      String(metrics.endOfDayOdometer)
    ]
  })

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

function refreshTripSubscription() {
  if (unsubscribeFromTripRecords) {
    unsubscribeFromTripRecords()
    unsubscribeFromTripRecords = null
  }

  if (!activeUser || !canAccessJournal(activeUser)) {
    allTripRecords = []
    return
  }

  unsubscribeFromTripRecords = onSnapshot(collection(database, 'tripRecords'), (snapshot) => {
    allTripRecords = snapshot.docs.map((documentSnapshot) => normalizeTripRecord(documentSnapshot))
    applyFiltersAndRenderJournal()
  }, (error) => {
    elements.journalStatus.textContent = `Ошибка чтения журнала: ${error.message}`
  })
}


function closeAccountMenu() {
  elements.accountMenu.classList.add('hidden')
}

function updateAccountPanel(user) {
  elements.accountPanel.classList.toggle('hidden', !user)
  if (!user) {
    closeAccountMenu()
    return
  }
  const emailAddress = normalizeEmail(user.email)
  const userRole = isOwner(user) ? 'владелец' : isResponsible(user) ? 'ответственный' : 'пользователь'
  elements.accountMenuButton.textContent = emailAddress ? `${emailAddress} (${userRole})` : `Гость (${userRole})`
}

function updateVisibilityForUser(user) {
  activeUser = user
  const ownerAccess = isOwner(user)
  const responsibleAccess = isResponsible(user)
  const journalAccess = ownerAccess || responsibleAccess
  const managerAccess = canManageVehicleNumbers(user)

  refreshManagerSettingsSubscription()
  updateAccountPanel(user)
  setManagerEditorAccess(user)

  elements.authCard.classList.toggle('hidden', Boolean(user))
  elements.tripCard.classList.toggle('hidden', !user)
  elements.managerCard.classList.toggle('hidden', !managerAccess)
  elements.journalCard.classList.toggle('hidden', !journalAccess)

  if (!user) {
    elements.authStatus.textContent = 'Выполните вход по email'
    elements.managerStatus.textContent = ''
    elements.journalStatus.textContent = ''
    elements.journalTableBody.innerHTML = ''
    refreshTripSubscription()
    return
  }

  const userRole = ownerAccess ? 'владелец' : responsibleAccess ? 'ответственный' : 'пользователь'
  elements.authStatus.textContent = `Вход выполнен: ${normalizeEmail(user.email) || 'гость'} (${userRole})`

  if (managerAccess) {
    elements.managerStatus.textContent = ownerAccess
      ? 'Настройте список ответственных и машин'
      : 'Вы можете редактировать только список машин'
  } else {
    elements.managerStatus.textContent = ''
  }

  if (!journalAccess) {
    elements.journalStatus.textContent = `Журнал доступен владельцу ${ownerEmailAddress} и назначенным ответственным`
    refreshTripSubscription()
    return
  }

  refreshTripSubscription()
  applyFiltersAndRenderJournal()
}

function getTripRecordFromForm() {
  return {
    driverFullName: elements.driverFullNameInput.value.trim(),
    tripDate: elements.tripDateInput.value,
    vehicleNumber: elements.vehicleNumberInput.value,
    mileageValue: parseWholeNumber(elements.mileageInput.value),
    odometerValue: parseWholeNumber(elements.odometerInput.value),
    tripDescription: elements.tripDescriptionInput.value.trim(),
    createdAt: serverTimestamp(),
    createdByUserId: activeUser.uid,
    createdByEmail: normalizeEmail(activeUser.email)
  }
}

function validateTripRecord(tripRecord) {
  const hasValidDriverName = tripRecord.driverFullName.length >= 3 && tripRecord.driverFullName.length <= 120
  const hasValidTripDate = /^\d{4}-\d{2}-\d{2}$/.test(tripRecord.tripDate)
  const hasValidVehicleNumber = tripRecord.vehicleNumber.length >= 3 && tripRecord.vehicleNumber.length <= 20
  const hasValidMileage = Number.isInteger(tripRecord.mileageValue) && tripRecord.mileageValue >= 0
  const hasValidOdometer = Number.isInteger(tripRecord.odometerValue) && tripRecord.odometerValue >= 0
  const hasValidTripDescription = tripRecord.tripDescription.length >= 3 && tripRecord.tripDescription.length <= 3000

  return hasValidDriverName
    && hasValidTripDate
    && hasValidVehicleNumber
    && hasValidMileage
    && hasValidOdometer
    && hasValidTripDescription
}

async function submitTripRecord(event) {
  event.preventDefault()

  if (!activeUser) {
    elements.tripFormStatus.textContent = 'Сначала выполните вход'
    return
  }

  const tripRecord = getTripRecordFromForm()
  if (!validateTripRecord(tripRecord)) {
    elements.tripFormStatus.textContent = 'Проверьте данные: ФИО от 3 символов, целые значения пробега и одометра, текст от 3 символов'
    return
  }

  try {
    await addDoc(collection(database, 'tripRecords'), tripRecord)
    elements.tripFormStatus.textContent = 'Запись сохранена'
    elements.tripForm.reset()
    setDefaultTripDate()
  } catch (error) {
    elements.tripFormStatus.textContent = `Ошибка сохранения: ${error.message}`
  }
}

async function loginWithEmail(event) {
  event.preventDefault()
  elements.authStatus.textContent = 'Выполняется вход...'

  const emailAddress = normalizeEmail(elements.emailInput.value)
  const passwordValue = elements.passwordInput.value

  try {
    await signInWithEmailAndPassword(authentication, emailAddress, passwordValue)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка входа: ${error.message}`
  }
}

async function registerWithEmail() {
  elements.authStatus.textContent = 'Создаётся аккаунт...'

  const emailAddress = normalizeEmail(elements.emailInput.value)
  const passwordValue = elements.passwordInput.value

  if (!emailAddress || !passwordValue || passwordValue.length < 6) {
    elements.authStatus.textContent = 'Для регистрации укажите email и пароль не короче 6 символов'
    return
  }

  try {
    await createUserWithEmailAndPassword(authentication, emailAddress, passwordValue)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка регистрации: ${error.message}`
  }
}

async function loginAsGuest() {
  elements.authStatus.textContent = 'Выполняется вход гостя...'
  try {
    await signInAnonymously(authentication)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка входа гостя: ${error.message}`
  }
}

async function logoutCurrentUser() {
  closeAccountMenu()
  try {
    await signOut(authentication)
  } catch (error) {
    elements.authStatus.textContent = `Ошибка выхода: ${error.message}`
  }
}

function exportCurrentRecords() {
  if (!canAccessJournal(activeUser)) {
    return
  }
  exportRecords(getCurrentFilteredAndSortedRecords(), 'autotrack-journal')
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

function setInstallButtonState() {
  elements.installAppButton.classList.toggle('hidden', !installPromptEvent)
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
  }
}

function attachEventListeners() {
  elements.themeToggleButton.addEventListener('click', toggleTheme)
  elements.emailAuthForm.addEventListener('submit', loginWithEmail)
  elements.registerButton.addEventListener('click', registerWithEmail)
  elements.guestLoginButton.addEventListener('click', loginAsGuest)
  elements.accountLogoutButton.addEventListener('click', logoutCurrentUser)
  elements.saveManagerButton.addEventListener('click', saveManagerSettings)
  elements.tripForm.addEventListener('submit', submitTripRecord)
  elements.applyFilterButton.addEventListener('click', applyFiltersAndRenderJournal)
  elements.resetFilterButton.addEventListener('click', resetFilters)
  elements.sortOrderInput.addEventListener('change', applyFiltersAndRenderJournal)
  elements.exportAllButton.addEventListener('click', exportCurrentRecords)


  elements.accountMenuButton.addEventListener('click', () => {
    elements.accountMenu.classList.toggle('hidden')
  })

  document.addEventListener('click', (event) => {
    const clickedInsideAccountPanel = elements.accountPanel.contains(event.target)
    if (!clickedInsideAccountPanel) {
      closeAccountMenu()
    }
  })

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPromptEvent = event
    setInstallButtonState()
  })

  elements.installAppButton.addEventListener('click', async () => {
    if (!installPromptEvent) {
      return
    }
    installPromptEvent.prompt()
    await installPromptEvent.userChoice
    installPromptEvent = null
    setInstallButtonState()
  })
}

async function startApplication() {
  initializeTheme()
  setDefaultTripDate()
  attachEventListeners()
  onAuthStateChanged(authentication, updateVisibilityForUser)
  updateVisibilityForUser(authentication.currentUser)
  registerServiceWorker()
}

startApplication()
