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
  apiKey: 'AIzaSyBHNAoWoxfV4Eyc1vKO_6ZaY7otxNa7rJA',
  authDomain: 'autotrack-2112.firebaseapp.com',
  projectId: 'autotrack-2112',
  storageBucket: 'autotrack-2112.firebasestorage.app',
  messagingSenderId: '956840493468',
  appId: '1:956840493468:web:3242c81dde85b873380859',
  measurementId: 'G-Z9X89L5VG5'
}

const ownerEmailAddress = 'shazak6430@gmail.com'
const fallbackResponsibleEmailAddress = 'responsible@autotrack.local'
const fallbackVehicleNumbers = ['Т572СР799', 'А482АС799', 'Н827НТ197', 'Т876ХВ197', 'А561АО777', 'К323АМ777', 'А096АС799', 'А241АС799', 'А045ОЕ799', 'А203ОЕ799', 'Х354НТ799', 'Р891ТН799', 'Т563СР799', 'Т422СР799', 'О768ХК799', 'М962ХМ799', 'К196ВЕ977', 'К052ОА797', 'Х350СВ797', 'Х853СК797', 'Х912СК797', 'Х673СМ797']
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
  responsibleField: document.getElementById('responsibleField'),
  managerEmailInput: document.getElementById('managerEmailInput'),
  managerEmailList: document.getElementById('managerEmailList'),
  assistantField: document.getElementById('assistantField'),
  assistantEmailInput: document.getElementById('assistantEmailInput'),
  assistantEmailList: document.getElementById('assistantEmailList'),
  vehicleNumberManagerInput: document.getElementById('vehicleNumberManagerInput'),
  vehicleNumberList: document.getElementById('vehicleNumberList'),
  saveManagerButton: document.getElementById('saveManagerButton'),
  tripCard: document.getElementById('tripCard'),
  tripForm: document.getElementById('tripForm'),
  driverFullNameInput: document.getElementById('driverFullNameInput'),
  tripDateInput: document.getElementById('tripDateInput'),
  vehicleNumberSearchInput: document.getElementById('vehicleNumberSearchInput'),
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
  installAppButtonAuth: document.getElementById('installAppButtonAuth'),
  installAppButton: document.getElementById('installAppButton'),
  journalTableBody: document.getElementById('journalTableBody'),
  journalStatus: document.getElementById('journalStatus')
}

const journalColumnTitles = ['ФИО', 'Дата поездки', 'Номер машины', 'Пробег', 'Одометр', 'Текст поездки', 'Дата создания']

let activeUser = null
let allTripRecords = []
let responsibleEmailAddresses = [fallbackResponsibleEmailAddress]
let assistantEmailAddresses = []
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

function getVehicleNumberFirstThreeDigitsValue(vehicleNumber) {
  const normalizedVehicleNumber = normalizeVehicleNumber(vehicleNumber)
  const match = normalizedVehicleNumber.match(/(\d{3})/)
  if (!match) {
    return Number.POSITIVE_INFINITY
  }
  return Number.parseInt(match[1], 10)
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

function isAssistant(user) {
  const userEmail = normalizeEmail(user?.email)
  if (!userEmail) {
    return false
  }
  return assistantEmailAddresses.includes(userEmail)
}

function canAccessJournal(user) {
  return isOwner(user) || isResponsible(user) || isAssistant(user)
}

function canManageResponsibleEmails(user) {
  return isOwner(user)
}

function canManageAssistantEmails(user) {
  return isResponsible(user)
}

function canManageVehicleNumbers(user) {
  return isOwner(user) || isResponsible(user)
}

function canCreateTripRecords(user) {
  return Boolean(user)
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

const assistantEmailEditor = createTagEditor(
  elements.assistantEmailInput,
  elements.assistantEmailList,
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

function getSortedVehicleNumbers(vehicleNumbers) {
  return [...vehicleNumbers].sort((firstVehicleNumber, secondVehicleNumber) => {
    const firstDigitsValue = getVehicleNumberFirstThreeDigitsValue(firstVehicleNumber)
    const secondDigitsValue = getVehicleNumberFirstThreeDigitsValue(secondVehicleNumber)
    if (firstDigitsValue !== secondDigitsValue) {
      return firstDigitsValue - secondDigitsValue
    }
    return firstVehicleNumber.localeCompare(secondVehicleNumber, 'ru-RU')
  })
}

function setManagerEditors() {
  managerEmailEditor.setValues(responsibleEmailAddresses)
  assistantEmailEditor.setValues(assistantEmailAddresses)
  vehicleNumberEditor.setValues(managedVehicleNumbers)
}

function setManagerEditorAccess(user) {
  managerEmailEditor.setEditable(canManageResponsibleEmails(user))
  assistantEmailEditor.setEditable(canManageAssistantEmails(user))
  vehicleNumberEditor.setEditable(canManageVehicleNumbers(user))
}

function populateVehicleNumbers() {
  const selectedVehicleNumber = elements.vehicleNumberInput.value
  const searchQuery = normalizeVehicleNumber(elements.vehicleNumberSearchInput.value)
  const optionsFragment = document.createDocumentFragment()
  const sortedVehicleNumbers = getSortedVehicleNumbers(managedVehicleNumbers)
  const filteredVehicleNumbers = sortedVehicleNumbers.filter((vehicleNumber) => vehicleNumber.includes(searchQuery))

  filteredVehicleNumbers.forEach((vehicleNumber) => {
    const optionElement = document.createElement('option')
    optionElement.value = vehicleNumber
    optionElement.textContent = vehicleNumber
    optionsFragment.append(optionElement)
  })

  elements.vehicleNumberInput.innerHTML = ''
  elements.vehicleNumberInput.append(optionsFragment)

  if (filteredVehicleNumbers.includes(selectedVehicleNumber)) {
    elements.vehicleNumberInput.value = selectedVehicleNumber
  }

  if (!elements.vehicleNumberInput.value && filteredVehicleNumbers.length) {
    elements.vehicleNumberInput.value = filteredVehicleNumbers[0]
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

function parseAssistantEmailAddresses(settingsData) {
  const rawAssistantEmails = Array.isArray(settingsData?.assistantEmails) ? settingsData.assistantEmails : []
  const normalizedAssistantEmails = rawAssistantEmails
    .map((emailAddress) => normalizeEmail(emailAddress))
    .filter((emailAddress) => emailAddress.includes('@') && emailAddress.includes('.'))
  return normalizedAssistantEmails
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
  assistantEmailAddresses = parseAssistantEmailAddresses(settingsData)
  managedVehicleNumbers = getSortedVehicleNumbers(parseVehicleNumbers(settingsData))
  setManagerEditors()
  setManagerEditorAccess(activeUser)
  populateVehicleNumbers()
  updateVisibilityByCurrentAccess()
}

function resetManagerSettingsToFallback() {
  applyManagerSettings({
    responsibleEmails: [fallbackResponsibleEmailAddress],
    assistantEmails: [],
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

  const normalizedActiveUserEmail = normalizeEmail(activeUser.email)
  const nextVehicleNumbers = getSortedVehicleNumbers(vehicleNumberEditor.getValues())
  if (!nextVehicleNumbers.length) {
    elements.managerStatus.textContent = 'Добавьте хотя бы один номер машины'
    return
  }

  const canUpdateResponsibleEmails = canManageResponsibleEmails(activeUser)
  const canUpdateAssistantEmails = canManageAssistantEmails(activeUser)
  const nextResponsibleEmailAddresses = canUpdateResponsibleEmails
    ? managerEmailEditor.getValues()
    : responsibleEmailAddresses
  const nextAssistantEmailAddresses = canUpdateAssistantEmails
    ? assistantEmailEditor.getValues()
    : assistantEmailAddresses

  if (canUpdateResponsibleEmails && !nextResponsibleEmailAddresses.length) {
    elements.managerStatus.textContent = 'Добавьте хотя бы один email ответственного'
    return
  }

  if (canUpdateAssistantEmails && !nextAssistantEmailAddresses.includes(normalizedActiveUserEmail)) {
    elements.managerStatus.textContent = 'Ответственный не может удалить себя из помощников'
    return
  }

  const settingsForSaving = {
    vehicleNumbers: nextVehicleNumbers,
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizedActiveUserEmail
  }

  if (canUpdateResponsibleEmails) {
    settingsForSaving.responsibleEmails = nextResponsibleEmailAddresses
    settingsForSaving.responsibleEmail = nextResponsibleEmailAddresses[0]
  }

  if (canUpdateAssistantEmails) {
    settingsForSaving.assistantEmails = nextAssistantEmailAddresses
  }

  try {
    await setDoc(getManagerSettingsReference(), settingsForSaving, { merge: true })
    if (canUpdateResponsibleEmails) {
      elements.managerStatus.textContent = `Сохранено: ответственных ${nextResponsibleEmailAddresses.length}, машин ${nextVehicleNumbers.length}`
      return
    }
    if (canUpdateAssistantEmails) {
      elements.managerStatus.textContent = `Сохранено: помощников ${nextAssistantEmailAddresses.length}, машин ${nextVehicleNumbers.length}`
      return
    }
    elements.managerStatus.textContent = `Сохранено: машин ${nextVehicleNumbers.length}`
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
    if (sortingMode === 'vehicleNumberDigitsAsc') {
      const firstDigitsValue = getVehicleNumberFirstThreeDigitsValue(firstRecord.vehicleNumber)
      const secondDigitsValue = getVehicleNumberFirstThreeDigitsValue(secondRecord.vehicleNumber)
      if (firstDigitsValue !== secondDigitsValue) {
        return firstDigitsValue - secondDigitsValue
      }
      return firstRecord.vehicleNumber.localeCompare(secondRecord.vehicleNumber, 'ru-RU')
    }
    if (sortingMode === 'vehicleNumberDigitsDesc') {
      const firstDigitsValue = getVehicleNumberFirstThreeDigitsValue(firstRecord.vehicleNumber)
      const secondDigitsValue = getVehicleNumberFirstThreeDigitsValue(secondRecord.vehicleNumber)
      if (firstDigitsValue !== secondDigitsValue) {
        return secondDigitsValue - firstDigitsValue
      }
      return secondRecord.vehicleNumber.localeCompare(firstRecord.vehicleNumber, 'ru-RU')
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

  const rowFragment = document.createDocumentFragment()

  records.forEach((record) => {
    const rowValues = [
      record.driverFullName,
      record.tripDate,
      record.vehicleNumber,
      String(record.mileageValue),
      String(record.odometerValue),
      record.tripDescription,
      convertTimestampToText(record.createdAt)
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
  const rows = records.map((record) => {
    return [
      record.driverFullName,
      record.tripDate,
      record.vehicleNumber,
      String(record.mileageValue),
      String(record.odometerValue),
      record.tripDescription,
      convertTimestampToText(record.createdAt)
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

function getUserRoleLabel(user) {
  if (isOwner(user)) {
    return 'владелец'
  }
  if (isResponsible(user)) {
    return 'ответственный'
  }
  if (isAssistant(user)) {
    return 'помощник'
  }
  return 'пользователь'
}

function updateAccountPanel(user) {
  elements.accountPanel.classList.toggle('hidden', !user)
  if (!user) {
    closeAccountMenu()
    return
  }
  const emailAddress = normalizeEmail(user.email)
  const userRole = getUserRoleLabel(user)
  elements.accountMenuButton.textContent = emailAddress ? `${emailAddress} (${userRole})` : `Гость (${userRole})`
}

function updateVisibilityByCurrentAccess() {
  const ownerAccess = isOwner(activeUser)
  const responsibleAccess = isResponsible(activeUser)
  const assistantAccess = isAssistant(activeUser)
  const journalAccess = canAccessJournal(activeUser)
  const managerAccess = canManageVehicleNumbers(activeUser)
  const tripFormAccess = canCreateTripRecords(activeUser)

  updateAccountPanel(activeUser)
  setManagerEditorAccess(activeUser)
  elements.responsibleField.classList.toggle('hidden', !ownerAccess)
  elements.assistantField.classList.toggle('hidden', !responsibleAccess)

  elements.authCard.classList.toggle('hidden', Boolean(activeUser))
  elements.tripCard.classList.toggle('hidden', !tripFormAccess)
  elements.managerCard.classList.toggle('hidden', !managerAccess)
  elements.journalCard.classList.toggle('hidden', !journalAccess)

  if (!activeUser) {
    elements.authStatus.textContent = 'Выполните вход'
    elements.managerStatus.textContent = ''
    elements.journalStatus.textContent = ''
    elements.journalTableBody.innerHTML = ''
    refreshTripSubscription()
    return
  }

  const userRole = getUserRoleLabel(activeUser)
  elements.authStatus.textContent = `Вход выполнен: ${normalizeEmail(activeUser.email) || 'гость'} (${userRole})`

  if (ownerAccess) {
    elements.managerStatus.textContent = 'Вы назначаете ответственных и управляете списком машин'
  } else if (responsibleAccess) {
    elements.managerStatus.textContent = 'Вы назначаете помощников и управляете списком машин'
  } else {
    elements.managerStatus.textContent = ''
  }

  if (!journalAccess) {
    elements.journalStatus.textContent = `Журнал доступен владельцу ${ownerEmailAddress}, ответственным и помощникам`
    refreshTripSubscription()
    return
  }

  if (assistantAccess) {
    elements.journalStatus.textContent = 'Доступ помощника: фильтрация и скачивание таблицы'
  }

  refreshTripSubscription()
  applyFiltersAndRenderJournal()
}

function updateVisibilityForUser(user) {
  activeUser = user
  refreshManagerSettingsSubscription()
  updateVisibilityByCurrentAccess()
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

  if (!activeUser || !canCreateTripRecords(activeUser)) {
    elements.tripFormStatus.textContent = 'Недостаточно прав для отправки записи'
    return
  }

  const confirmedByUser = window.confirm('Подтвердите отправку записи')
  if (!confirmedByUser) {
    elements.tripFormStatus.textContent = 'Отправка отменена'
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
    if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/user-not-found') {
      elements.authStatus.textContent = 'Ошибка входа: аккаунт не зарегистрирован'
      return
    }
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
    if (error?.code === 'auth/email-already-in-use') {
      elements.authStatus.textContent = 'Ошибка регистрации: аккаунт уже зарегистрирован'
      return
    }
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
  elements.installAppButtonAuth.classList.toggle('hidden', !installPromptEvent)
  elements.installAppButton.classList.toggle('hidden', !installPromptEvent)
}

async function installApplication() {
  if (!installPromptEvent) {
    return
  }
  installPromptEvent.prompt()
  await installPromptEvent.userChoice
  installPromptEvent = null
  setInstallButtonState()
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
  elements.vehicleNumberSearchInput.addEventListener('input', populateVehicleNumbers)
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

  elements.installAppButtonAuth.addEventListener('click', installApplication)
  elements.installAppButton.addEventListener('click', installApplication)
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
