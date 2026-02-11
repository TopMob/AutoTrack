# Актуальные правила Firebase для AutoTrack

## 1. Firestore Rules

Опубликуйте эти правила в Firebase Console → Firestore Database → Rules.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function normalizedOwnerEmail() {
      return 'shazak6430@gmail.com';
    }

    function managerSettingsPath() {
      return /databases/$(database)/documents/systemSettings/responsibleAssignment;
    }

    function managerSettingsData() {
      return exists(managerSettingsPath())
        ? get(managerSettingsPath()).data
        : {};
    }

    function getResponsibleEmailsFromSettings() {
      return managerSettingsData().responsibleEmails is list
        ? managerSettingsData().responsibleEmails
        : managerSettingsData().responsibleEmail is string
          ? [managerSettingsData().responsibleEmail]
          : ['responsible@autotrack.local'];
    }

    function getAssistantEmailsFromSettings() {
      return managerSettingsData().assistantEmails is list
        ? managerSettingsData().assistantEmails
        : [];
    }

    function isOwner() {
      return isSignedIn() && request.auth.token.email == normalizedOwnerEmail();
    }

    function isResponsible() {
      return isSignedIn() && request.auth.token.email in getResponsibleEmailsFromSettings();
    }

    function isAssistant() {
      return isSignedIn() && request.auth.token.email in getAssistantEmailsFromSettings();
    }

    function canReadJournal() {
      return isOwner() || isResponsible() || isAssistant();
    }

    function isNonEmptyString(value, minSize, maxSize) {
      return value is string && value.size() >= minSize && value.size() <= maxSize;
    }

    function isValidTripRecordCreate() {
      return request.resource.data.keys().hasOnly([
        'driverFullName',
        'tripDate',
        'vehicleNumber',
        'mileageValue',
        'odometerValue',
        'tripDescription',
        'createdAt',
        'createdByUserId',
        'createdByEmail'
      ])
      && isNonEmptyString(request.resource.data.driverFullName, 3, 120)
      && request.resource.data.tripDate is string
      && request.resource.data.tripDate.matches('^\\d{4}-\\d{2}-\\d{2}$')
      && isNonEmptyString(request.resource.data.vehicleNumber, 3, 20)
      && request.resource.data.mileageValue is int
      && request.resource.data.mileageValue >= 0
      && request.resource.data.odometerValue is int
      && request.resource.data.odometerValue >= 0
      && isNonEmptyString(request.resource.data.tripDescription, 3, 3000)
      && request.resource.data.createdAt == request.time
      && request.resource.data.createdByUserId == request.auth.uid
      && request.resource.data.createdByEmail is string;
    }

    function hasValidResponsibleEmailsField() {
      return !('responsibleEmails' in request.resource.data)
      || (
        request.resource.data.responsibleEmails is list
        && request.resource.data.responsibleEmails.size() > 0
        && request.resource.data.responsibleEmails.size() <= 30
      );
    }

    function hasValidResponsibleEmailField() {
      return !('responsibleEmail' in request.resource.data)
      || isNonEmptyString(request.resource.data.responsibleEmail, 5, 120);
    }

    function hasValidVehicleNumbersField() {
      return !('vehicleNumbers' in request.resource.data)
      || (
        request.resource.data.vehicleNumbers is list
        && request.resource.data.vehicleNumbers.size() > 0
        && request.resource.data.vehicleNumbers.size() <= 200
      );
    }

    function hasValidAssistantEmailsField() {
      return !('assistantEmails' in request.resource.data)
      || (
        request.resource.data.assistantEmails is list
        && request.resource.data.assistantEmails.size() <= 60
      );
    }

    function hasOnlyAllowedManagerSettingsKeys() {
      return request.resource.data.keys().hasOnly([
        'responsibleEmails',
        'responsibleEmail',
        'assistantEmails',
        'vehicleNumbers',
        'updatedAt',
        'updatedByEmail'
      ]);
    }

    function hasValidManagerMetadata() {
      return request.resource.data.updatedAt == request.time
      && request.resource.data.updatedByEmail is string;
    }

    function isValidManagerSettingsWriteByOwner() {
      return hasOnlyAllowedManagerSettingsKeys()
      && hasValidManagerMetadata()
      && hasValidResponsibleEmailsField()
      && hasValidResponsibleEmailField()
      && hasValidAssistantEmailsField()
      && hasValidVehicleNumbersField();
    }

    function isValidManagerSettingsWriteByResponsible() {
      return hasOnlyAllowedManagerSettingsKeys()
      && hasValidManagerMetadata()
      && hasValidAssistantEmailsField()
      && hasValidVehicleNumbersField()
      && request.resource.data.vehicleNumbers is list
      && request.resource.data.updatedByEmail is string
      && request.resource.data.responsibleEmails == resource.data.responsibleEmails
      && request.resource.data.responsibleEmail == resource.data.responsibleEmail;
    }

    match /tripRecords/{recordId} {
      allow create: if isSignedIn() && isValidTripRecordCreate();
      allow read: if canReadJournal();
      allow update, delete: if false;
    }

    match /systemSettings/responsibleAssignment {
      allow read: if isSignedIn();
      allow create: if isOwner() && isValidManagerSettingsWriteByOwner();
      allow update: if (isOwner() && isValidManagerSettingsWriteByOwner())
        || (isResponsible() && isValidManagerSettingsWriteByResponsible());
      allow delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 2. Firebase Storage Rules

Если загрузка файлов не используется, оставьте Storage закрытым.

```rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 3. Firebase Authentication

В Firebase Console → Authentication → Sign-in method включите:

- Email/Password
- Anonymous

## 4. Индекс Firestore

Для списка поездок с сортировкой используйте composite index:

- Collection ID: `tripRecords`
- Fields:
  - `tripDate` Descending
  - `createdAt` Descending

## 5. Что должно совпадать с приложением

- Email владельца: `shazak6430@gmail.com`
- Путь документа настроек: `systemSettings/responsibleAssignment`
- Поля записи поездки должны совпадать с `isValidTripRecordCreate`
- `createdAt` и `updatedAt` должны писаться как server timestamp
